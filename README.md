# Sixtyfour Workflow Engine — Take-Home Assessment

A fullstack implementation of Sixtyfour's Workflow Engine: a drag-and-drop interface for configuring and executing modular data processing pipelines against CSV data, powered by Sixtyfour's AI enrichment APIs.

---

## Challenge Overview

Build a simplified replica of Sixtyfour's Workflow Engine with a frontend and backend that allows users to configure and execute workflows made up of chainable processing blocks.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, Python, uvicorn, pandas, httpx |
| Frontend | React, TypeScript, Vite, React Flow, Tailwind CSS, Zustand |

---

## Features

### Backend
Five fully chainable processing blocks:

- **Read CSV** — Load a CSV file into a dataframe
- **Filter** — Apply pandas-style filter expressions (e.g., `df[df['name'].str.contains('64')]`); only rows evaluating to `True` pass downstream
- **Enrich Lead** — Call Sixtyfour's `/enrich-lead` endpoint per row
- **Find Email** — Call Sixtyfour's `/find-email` endpoint per row
- **Save CSV** — Write the current dataframe to a CSV file

Execution is handled asynchronously with parallel API calls (`asyncio.Semaphore`) and real-time progress streamed to the frontend via WebSocket.

### Frontend
- **Drag-and-drop canvas** (React Flow) for building workflows visually
- **Block configuration panel** — per-block parameter editing (filter conditions, field selections, API key, etc.)
- **Live job progress** — WebSocket-powered progress bar and status updates
- **Results viewer** — tabbed display of intermediate and final dataframe state

---

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- A Sixtyfour API key (sign up at [app.sixtyfour.ai](https://app.sixtyfour.ai) for $25 in free credits)

### Backend

Create a `.env` file in the `backend/` directory with your Sixtyfour API key:

```bash
SIXTYFOUR_API_KEY=your_api_key_here
```

> The backend will refuse to start without this. Sign up at [app.sixtyfour.ai](https://app.sixtyfour.ai) to get your key.

```bash
cd project/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API available at `http://localhost:8000`

### Frontend

```bash
cd project/frontend
npm install
npm run dev
```

UI available at `http://localhost:5173`

---

## Sample Data

`backend/uploads/take-home-sample-data.csv` — 10 rows with columns:
`name`, `company`, `email`, `company_location`, `linkedin`

---

## Example Workflows

**Basic:**
```
Read CSV → Enrich Lead → Save CSV
```

**Filtered Enrichment:**
```
Read CSV
→ Filter (company name contains 'Ariglad Inc')
→ Enrich Lead (return educational background, including undergrad university)
→ Filter (is_american_education = True)
→ Save CSV
```

---

## Architecture Notes

- **Job management**: In-memory job store with subscriber pattern for WebSocket broadcast
- **Block execution**: Linear chain — each block receives the output dataframe of the previous block
- **Parallelization**: Sixtyfour API calls run concurrently with `asyncio.Semaphore(5)` to stay fast without overwhelming the API
- **API key**: Read from `SIXTYFOUR_API_KEY` env var at startup and injected into each block config at runtime by the job manager
- **Storage**: No persistent storage — local files only

---

## Evaluation Criteria

| Criteria | Description |
|----------|-------------|
| Product Experience | Intuitive, smooth UI feel |
| Backend Stability | Reliable execution; fast parallel API calls |
| State Management | Clean transitions between data states |

---

## Discussion Topics (Follow-up)

1. **How would you implement the `enrich_company` endpoint?**
2. **How to prevent incompatible block chains** (e.g., `enrich_company` should not connect to a lead block)?
3. **Scaling to thousands of rows** — how to keep execution fast?
4. **Product decisions and tradeoffs** — what was built, what was cut, what would change with more time?
5. **Sixtyfour API learnings** — observations, suggested improvements?
