import os
import pandas as pd
from typing import Callable, Awaitable
from .base import Block

# Resolve to the uploads/ directory relative to the backend package root
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_UPLOADS_DIR = os.path.join(_BACKEND_DIR, "uploads")


class ReadCSVBlock(Block):
    type = "read_csv"

    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        file_path = config.get("file_path", "")
        if not file_path:
            raise ValueError("ReadCSV block requires a 'file_path' config value")

        # Resolve relative paths: "uploads/foo.csv" → absolute path in backend/uploads/
        if not os.path.isabs(file_path):
            candidate = os.path.join(_BACKEND_DIR, file_path)
            if os.path.exists(candidate):
                file_path = candidate
            else:
                # Try directly under uploads/
                basename = os.path.basename(file_path)
                candidate2 = os.path.join(_UPLOADS_DIR, basename)
                if os.path.exists(candidate2):
                    file_path = candidate2

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path}")

        await progress_cb({"message": f"Reading CSV from {file_path}"})
        result = pd.read_csv(file_path)
        await progress_cb({"message": f"Loaded {len(result)} rows, {len(result.columns)} columns"})
        return result
