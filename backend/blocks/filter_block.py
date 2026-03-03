import pandas as pd
from typing import Callable, Awaitable
from .base import Block


class FilterBlock(Block):
    type = "filter"

    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        expression = config.get("expression", "")
        if not expression:
            raise ValueError("Filter block requires an 'expression' config value")

        await progress_cb({"message": f"Applying filter: {expression}"})

        try:
            # Try pandas query() first
            result = df.query(expression)
        except Exception:
            try:
                # Fall back to eval with df prefix
                mask = df.eval(expression)
                result = df[mask]
            except Exception as e:
                raise ValueError(f"Invalid filter expression: {expression}. Error: {e}")

        await progress_cb({
            "message": f"Filter passed {len(result)}/{len(df)} rows"
        })
        return result.reset_index(drop=True)
