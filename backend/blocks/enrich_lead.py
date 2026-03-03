import asyncio
import math
import pandas as pd
import httpx
from typing import Callable, Awaitable
from .base import Block

SIXTYFOUR_API_URL = "https://api.sixtyfour.ai/enrich-lead"
MAX_CONCURRENCY = 5


def _clean_row(row: dict) -> dict:
    """Omit NaN/Inf fields entirely — sending null can confuse some APIs."""
    return {k: v for k, v in row.items()
            if not (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))}


class EnrichLeadBlock(Block):
    type = "enrich_lead"

    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        api_key = config.get("api_key", "")
        struct = config.get("struct", {})
        research_plan = config.get("research_plan", "")

        if not api_key:
            raise ValueError("EnrichLead block requires an 'api_key' config value")
        if not struct:
            raise ValueError("EnrichLead block requires a non-empty 'struct' config value")

        total = len(df)
        await progress_cb({"message": f"Enriching {total} leads with {MAX_CONCURRENCY} concurrent requests", "row_progress": {"processed": 0, "total": total}})

        results = [None] * total
        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        processed_count = 0

        async def enrich_row(idx: int, row: dict):
            nonlocal processed_count
            async with semaphore:
                async with httpx.AsyncClient(timeout=900) as client:
                    payload = {
                        "lead_info": _clean_row(row),
                        "struct": struct,
                    }
                    if research_plan:
                        payload["research_plan"] = research_plan

                    try:
                        response = await client.post(
                            SIXTYFOUR_API_URL,
                            json=payload,
                            headers={
                                "x-api-key": api_key,
                                "Content-Type": "application/json",
                            },
                        )
                        if not response.is_success:
                            body = response.text[:300]
                            results[idx] = {"_enrich_error": f"HTTP {response.status_code}: {body}"}
                        else:
                            data = response.json()
                            structured_data = data.get("structured_data", {})
                            results[idx] = structured_data
                    except Exception as e:
                        results[idx] = {"_enrich_error": str(e)}

                    processed_count += 1
                    await progress_cb({
                        "message": f"Enriched row {processed_count}/{total}",
                        "row_progress": {"processed": processed_count, "total": total},
                    })

        rows = df.to_dict(orient="records")
        tasks = [enrich_row(i, row) for i, row in enumerate(rows)]
        await asyncio.gather(*tasks)

        # Merge enrichment results back into DataFrame.
        # Only write new enriched values — never overwrite original data with None
        # when a row errored (keeps the original name/company/etc. intact).
        result_df = df.copy()
        enrich_cols: set[str] = set()
        for r in results:
            if r:
                enrich_cols.update(r.keys())

        for col in enrich_cols:
            original = result_df[col].tolist() if col in result_df.columns else [None] * total
            new_col = []
            for i in range(total):
                r = results[i]
                if r is None or "_enrich_error" in r:
                    # Enrichment failed — keep the original value
                    new_col.append(original[i])
                else:
                    new_col.append(r.get(col))
            result_df[col] = new_col

        new_cols = enrich_cols - {"_enrich_error"} - set(df.columns)
        errors = sum(1 for r in results if r and "_enrich_error" in r)
        summary = f"Enrichment complete. Added columns: {', '.join(new_cols)}"
        if errors:
            summary += f" ({errors}/{total} rows failed — original data preserved)"
        await progress_cb({"message": summary})
        return result_df
