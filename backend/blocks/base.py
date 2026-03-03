from abc import ABC, abstractmethod
from typing import Callable, Awaitable
import pandas as pd


class Block(ABC):
    type: str = "base"

    @abstractmethod
    async def execute(
        self,
        df: pd.DataFrame,
        config: dict,
        progress_cb: Callable[[dict], Awaitable[None]],
    ) -> pd.DataFrame:
        """Execute this block on the input DataFrame and return the result."""
        ...
