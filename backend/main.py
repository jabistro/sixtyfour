import asyncio
import os
from typing import List

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass  # python-dotenv optional; set env var manually if needed

import job_manager

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_API_KEY = os.environ.get("SIXTYFOUR_API_KEY", "")
if not _API_KEY:
    raise RuntimeError("SIXTYFOUR_API_KEY is not set. Add it to backend/.env")

app = FastAPI(title="Sixtyfour Workflow Engine")

_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# ── Models ────────────────────────────────────────────────────────────────────

class BlockConfig(BaseModel):
    type: str
    config: dict = {}


class ExecuteWorkflowRequest(BaseModel):
    blocks: List[BlockConfig]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV (or XLSX) file and return the saved filename."""
    filename = file.filename or "upload.csv"
    # Sanitize
    filename = os.path.basename(filename)
    save_path = os.path.join(UPLOADS_DIR, filename)

    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    # If xlsx, convert to csv
    if filename.lower().endswith((".xlsx", ".xls")):
        csv_filename = os.path.splitext(filename)[0] + ".csv"
        csv_path = os.path.join(UPLOADS_DIR, csv_filename)
        df = pd.read_excel(save_path)
        df.to_csv(csv_path, index=False)
        return {"filename": csv_filename, "rows": len(df), "columns": list(df.columns)}

    df = pd.read_csv(save_path)
    return {"filename": filename, "rows": len(df), "columns": list(df.columns)}


@app.get("/csv-preview/{filename}")
async def csv_preview(filename: str):
    """Return the first 100 rows of a CSV for preview."""
    filename = os.path.basename(filename)
    path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    df = pd.read_csv(path)
    return {
        "rows": df.head(100).where(pd.notnull(df.head(100)), None).to_dict(orient="records"),
        "columns": list(df.columns),
        "total_rows": len(df),
    }


@app.post("/workflows/execute")
async def execute_workflow(request: ExecuteWorkflowRequest):
    """Create and start a workflow job."""
    block_configs = [{"type": b.type, "config": b.config} for b in request.blocks]
    job = job_manager.create_job(block_configs, _API_KEY)
    # Start execution as background task
    asyncio.create_task(job_manager.execute_job(job))
    return {"job_id": job.id}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Return full job state."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    snapshots = {}
    for i, snap in enumerate(job.snapshots):
        if snap is not None:
            snapshots[str(i)] = {
                "rows": snap.where(pd.notnull(snap), None).to_dict(orient="records"),
                "columns": list(snap.columns),
                "row_count": len(snap),
            }

    return {
        "job_id": job.id,
        "status": job.status,
        "current_block_index": job.current_block_index,
        "error": job.error,
        "snapshots": snapshots,
        "logs": job.logs[-200:],  # last 200 log entries
        "created_at": job.created_at.isoformat(),
    }


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running job (marks it as cancelled; tasks may still finish)."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "cancelled"
    return {"job_id": job_id, "status": "cancelled"}


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await websocket.accept()

    job = job_manager.get_job(job_id)
    if not job:
        await websocket.send_json({"type": "error", "message": "Job not found"})
        await websocket.close()
        return

    # If job is already done, send the logs immediately then close
    if job.status in ("done", "error", "cancelled"):
        for log in job.logs:
            await websocket.send_json(log)
        await websocket.close()
        return

    q = job_manager.subscribe(job_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=1.0)
                await websocket.send_json(event)
                if event.get("type") in ("job_done", "error"):
                    break
            except asyncio.TimeoutError:
                # Check if job finished while we weren't listening
                if job.status in ("done", "error", "cancelled"):
                    break
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        job_manager.unsubscribe(job_id, q)
        try:
            await websocket.close()
        except Exception:
            pass
