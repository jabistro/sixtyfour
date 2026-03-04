import re
import pandas as pd
from typing import Callable, Awaitable
from .base import Block


def _make_case_insensitive(expression: str) -> str:
    """Make string comparisons case-insensitive in filter expressions."""

    # str.contains() → inject case=False, na=False
    def inject_contains(m: re.Match) -> str:
        args = m.group(1)
        if 'case=' not in args:
            args += ', case=False'
        if 'na=' not in args:
            args += ', na=False'
        return f'.str.contains({args})'
    expression = re.sub(r'\.str\.contains\(([^)]*)\)', inject_contains, expression)

    # column == 'value' → column.str.lower() == 'value' (handles single and double quotes)
    for op in ('==', '!='):
        expression = re.sub(
            rf"(\w+)\s*{re.escape(op)}\s*(['\"])([^'\"]*)\2",
            lambda m, op=op: f"{m.group(1)}.str.lower() {op} '{m.group(3).lower()}'",
            expression,
        )

    return expression


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

        expression = _make_case_insensitive(expression)
        await progress_cb({"message": f"Applying filter: {expression}"})

        try:
            # Try pandas query() first (works well for simple comparisons)
            result = df.query(expression)
        except Exception:
            try:
                # Fall back to Python eval with df columns in scope.
                # This supports the full Series API including str.contains(case=False).
                local_env = {col: df[col] for col in df.columns}
                mask = eval(expression, {"__builtins__": {}}, local_env)  # noqa: S307
                result = df[mask]
            except Exception as e:
                raise ValueError(f"Invalid filter expression: {expression}. Error: {e}")

        await progress_cb({
            "message": f"Filter passed {len(result)}/{len(df)} rows"
        })
        return result.reset_index(drop=True)
