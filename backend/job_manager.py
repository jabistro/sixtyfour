import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import pandas as pd

from blocks import BLOCK_REGISTRY


@dataclass
class Job:
    id: str
    status: str  # pending | running | done | error
    block_configs: List[dict]
    api_key: str
    snapshots: List[Optional[pd.DataFrame]] = field(default_factory=list)
    logs: List[dict] = field(default_factory=list)
    current_block_index: int = 0
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


# In-memory job store
_jobs: Dict[str, Job] = {}
# WebSocket subscribers: job_id -> list of async queues
_subscribers: Dict[str, List[asyncio.Queue]] = {}


def create_job(block_configs: List[dict], api_key: str) -> Job:
    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        status="pending",
        block_configs=block_configs,
        api_key=api_key,
        snapshots=[None] * len(block_configs),
    )
    _jobs[job_id] = job
    _subscribers[job_id] = []
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def subscribe(job_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    if job_id not in _subscribers:
        _subscribers[job_id] = []
    _subscribers[job_id].append(q)
    return q


def unsubscribe(job_id: str, q: asyncio.Queue):
    if job_id in _subscribers:
        try:
            _subscribers[job_id].remove(q)
        except ValueError:
            pass


async def _broadcast(job_id: str, event: dict):
    for q in list(_subscribers.get(job_id, [])):
        await q.put(event)


def _snapshot_to_rows(df: Optional[pd.DataFrame]) -> Optional[List[dict]]:
    if df is None:
        return None
    return df.where(pd.notnull(df), None).to_dict(orient="records")


async def execute_job(job: Job):
    job.status = "running"
    await _broadcast(job.id, {"type": "job_start", "job_id": job.id})

    df = pd.DataFrame()

    for block_index, block_config in enumerate(job.block_configs):
        block_type = block_config.get("type")
        config = block_config.get("config", {})
        # Inject api_key into block config so blocks can use it
        config = {**config, "api_key": job.api_key}

        block_cls = BLOCK_REGISTRY.get(block_type)
        if block_cls is None:
            job.status = "error"
            job.error = f"Unknown block type: {block_type}"
            await _broadcast(job.id, {
                "type": "error",
                "block_index": block_index,
                "message": job.error,
            })
            return

        block = block_cls()
        job.current_block_index = block_index

        await _broadcast(job.id, {
            "type": "block_start",
            "block_index": block_index,
            "block_type": block_type,
            "message": f"Starting {block_type}",
        })

        async def make_progress_cb(idx: int):
            async def progress_cb(event: dict):
                log_entry = {
                    "type": "block_progress",
                    "block_index": idx,
                    **event,
                }
                job.logs.append(log_entry)
                await _broadcast(job.id, log_entry)
            return progress_cb

        progress_cb = await make_progress_cb(block_index)

        try:
            df = await block.execute(df, config, progress_cb)
            job.snapshots[block_index] = df.copy()

            snapshot_rows = _snapshot_to_rows(df)
            done_event = {
                "type": "block_done",
                "block_index": block_index,
                "block_type": block_type,
                "message": f"Completed {block_type} — {len(df)} rows",
                "row_count": len(df),
                "columns": list(df.columns),
                "snapshot": snapshot_rows,
            }
            job.logs.append(done_event)
            await _broadcast(job.id, done_event)

        except Exception as e:
            job.status = "error"
            job.error = str(e)
            error_event = {
                "type": "error",
                "block_index": block_index,
                "block_type": block_type,
                "message": str(e),
            }
            job.logs.append(error_event)
            await _broadcast(job.id, error_event)
            return

    job.status = "done"
    final_event = {
        "type": "job_done",
        "job_id": job.id,
        "message": f"Workflow completed — {len(df)} rows",
        "row_count": len(df),
    }
    job.logs.append(final_event)
    await _broadcast(job.id, final_event)
