import os
import pandas as pd
from typing import Callable, Awaitable
from .base import Block

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


class SaveCSVBlock(Block):
    type = "save_csv"

    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        output_filename = config.get("output_filename", "results.csv")
        # Sanitize filename — strip any directory components
        output_filename = os.path.basename(output_filename)
        if not output_filename.endswith(".csv"):
            output_filename += ".csv"

        output_path = os.path.join(UPLOADS_DIR, output_filename)
        os.makedirs(UPLOADS_DIR, exist_ok=True)

        await progress_cb({"message": f"Saving {len(df)} rows to {output_filename}"})
        df.to_csv(output_path, index=False)
        await progress_cb({"message": f"Saved to uploads/{output_filename}", "download_path": f"/uploads/{output_filename}"})
        return df
