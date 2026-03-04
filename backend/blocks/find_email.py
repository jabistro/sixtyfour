import asyncio
import math
import pandas as pd
import httpx
from typing import Callable, Awaitable
from .base import Block


def _clean_row(row: dict) -> dict:
    """Omit NaN/Inf/empty fields — matches enrich-lead API conventions."""
    result = {}
    for k, v in row.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            continue
        if v is None or v == "":
            continue
        result[k] = v
    return result

SIXTYFOUR_API_URL = "https://api.sixtyfour.ai/find-email"
MAX_CONCURRENCY = 5


class FindEmailBlock(Block):
    type = "find_email"

    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        api_key = config.get("api_key", "")
        mode = config.get("mode", "PROFESSIONAL")

        if not api_key:
            raise ValueError("FindEmail block requires an 'api_key' config value")

        def _has_valid_email(val) -> bool:
            if val is None:
                return False
            if isinstance(val, float):
                return False  # NaN or inf
            s = str(val).strip().lower()
            return s not in ("", "nan", "none", "not found")

        # Skip rows that already have an email
        has_email = "email" in df.columns
        total = len(df)
        rows_to_process = [
            i for i in range(total)
            if not has_email or not _has_valid_email(df.iloc[i].get("email"))
        ]
        skipped = total - len(rows_to_process)

        await progress_cb({
            "message": f"Finding emails for {len(rows_to_process)} rows ({skipped} skipped — already have email)",
            "row_progress": {"processed": 0, "total": len(rows_to_process)},
        })

        emails = [""] * total
        # Preserve existing emails
        if has_email:
            for i in range(total):
                emails[i] = str(df.iloc[i]["email"]) if df.iloc[i].get("email") else ""

        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        processed_count = 0

        # API only accepts these fields in the lead object
        LEAD_FIELDS = {"name", "company", "title", "phone", "linkedin"}

        async def find_email_for_row(idx: int, row: dict):
            nonlocal processed_count
            async with semaphore:
                async with httpx.AsyncClient(timeout=900) as client:
                    lead = {k: v for k, v in _clean_row(row).items() if k in LEAD_FIELDS}
                    payload = {"lead": lead, "mode": mode}
                    try:
                        response = await client.post(
                            SIXTYFOUR_API_URL,
                            json=payload,
                            headers={
                                "x-api-key": api_key,
                                "Content-Type": "application/json",
                            },
                        )
                        response.raise_for_status()
                        data = response.json()
                        # Response: {"email": [[addr, status, type], ...], ...}
                        # Pick first OK email, fallback to first available
                        candidates = data.get("email", [])
                        best = ""
                        for entry in candidates:
                            if isinstance(entry, list) and len(entry) >= 2 and entry[1] == "OK":
                                best = entry[0]
                                break
                        if not best:
                            for entry in candidates:
                                if isinstance(entry, list) and entry[0]:
                                    best = entry[0]
                                    break
                        emails[idx] = best
                    except Exception as e:
                        emails[idx] = f"ERROR: {e}"

                    processed_count += 1
                    await progress_cb({
                        "message": f"Found email for row {processed_count}/{len(rows_to_process)}",
                        "row_progress": {"processed": processed_count, "total": len(rows_to_process)},
                    })

        rows = df.to_dict(orient="records")
        tasks = [find_email_for_row(i, rows[i]) for i in rows_to_process]
        await asyncio.gather(*tasks)

        result_df = df.copy()
        result_df["email"] = emails

        await progress_cb({"message": "Email finding complete"})
        return result_df
