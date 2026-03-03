import { useEffect } from 'react'
import { WorkflowCanvas } from './components/WorkflowCanvas'
import { BlockConfigPanel } from './components/BlockConfigPanel'
import { JobProgress } from './components/JobProgress'
import { ResultsTable } from './components/ResultsTable'
import { useWorkflowStore } from './store/workflowStore'
import { getJob } from './api/client'

function App() {
  const { activeJobId, jobs, selectedNodeId, applyJobPoll, handleWsEvent } = useWorkflowStore()

  const jobStatus = activeJobId ? jobs[activeJobId]?.status : null
  const showResults = activeJobId && (
    jobStatus === 'done' ||
    (jobs[activeJobId] && Object.keys(jobs[activeJobId]?.snapshots ?? {}).length > 0)
  )

  // Polling fallback — catches state when WS events are missed (fast jobs, proxy issues)
  useEffect(() => {
    if (!activeJobId) return
    if (jobStatus === 'done' || jobStatus === 'error' || jobStatus === 'cancelled') return

    const poll = async () => {
      try {
        const data = await getJob(activeJobId)
        applyJobPoll(activeJobId, data)

        // Replay block_done events for any snapshots we don't have yet
        const existingSnaps = jobs[activeJobId]?.snapshots ?? {}
        for (const [idxStr, snap] of Object.entries(data.snapshots ?? {})) {
          if (!existingSnaps[idxStr]) {
            handleWsEvent(activeJobId, {
              type: 'block_done',
              block_index: Number(idxStr),
              snapshot: (snap as { rows: Record<string, unknown>[] }).rows,
              columns: (snap as { columns: string[] }).columns,
              row_count: (snap as { row_count: number }).row_count,
            })
          }
        }

        // Surface current running block so node spinner shows
        const blockIdx = data.current_block_index as number
        if (data.status === 'running') {
          handleWsEvent(activeJobId, {
            type: 'block_start',
            block_index: blockIdx,
          })
        }
        if (data.status === 'done') {
          handleWsEvent(activeJobId, { type: 'job_done' })
        }
        if (data.status === 'error') {
          handleWsEvent(activeJobId, { type: 'error', message: data.error as string })
        }
      } catch {
        // ignore poll errors
      }
    }

    const id = setInterval(poll, 2000)
    // Also poll immediately
    poll()
    return () => clearInterval(id)
  }, [activeJobId, jobStatus])

  return (
    <div className="relative h-screen overflow-hidden">
      <WorkflowCanvas />
      {selectedNodeId && <BlockConfigPanel />}
      {activeJobId && <JobProgress />}
      {showResults && <ResultsTable />}
    </div>
  )
}

export default App
