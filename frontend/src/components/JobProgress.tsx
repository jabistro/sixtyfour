import { useState } from 'react'
import { useWorkflowStore, getOrderedNodes } from '../store/workflowStore'
import { cancelJob } from '../api/client'
import { BLOCK_META, type BlockStatus, type BlockType } from '../types'

function statusColor(status: BlockStatus) {
  if (status === 'running') return 'text-blue-600'
  if (status === 'done') return 'text-green-600'
  if (status === 'error') return 'text-red-600'
  return 'text-gray-400'
}

function statusLabel(status: BlockStatus) {
  if (status === 'running') return '⟳ Running'
  if (status === 'done') return '✓ Done'
  if (status === 'error') return '✗ Error'
  return '○ Pending'
}

export function JobProgress() {
  const { activeJobId, jobs, nodes, edges, nodeStatuses, nodeRowProgress, setActiveJobId } =
    useWorkflowStore()
  const [collapsed, setCollapsed] = useState(false)

  if (!activeJobId) return null

  const job = jobs[activeJobId] ?? {
    jobId: activeJobId,
    status: 'running' as const,
    currentBlockIndex: 0,
    snapshots: {},
    logs: [],
  }

  const orderedNodes = getOrderedNodes(nodes, edges)

  async function handleCancel() {
    if (!activeJobId) return
    try {
      await cancelJob(activeJobId)
    } catch {
      // ignore
    }
    setActiveJobId(null)
  }

  const logs = job.logs
    .filter((e) => e.type === 'block_progress' || e.type === 'block_done' || e.type === 'error' || e.type === 'job_done')
    .slice(-50)

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-10 transition-all duration-200 ${
        collapsed ? 'h-12' : 'h-64'
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center px-5 h-12 border-b border-gray-100 gap-3">
        <span className="font-semibold text-sm text-gray-700">
          Job {activeJobId.slice(0, 8)}…
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            job.status === 'done'
              ? 'bg-green-100 text-green-700'
              : job.status === 'error'
              ? 'bg-red-100 text-red-700'
              : job.status === 'running'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {job.status}
        </span>
        <div className="flex-1" />
        {job.status === 'running' && (
          <button
            className="text-xs text-red-500 hover:text-red-700 font-medium"
            onClick={handleCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="text-gray-400 hover:text-gray-600 text-sm"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex h-[calc(100%-3rem)] overflow-hidden">
          {/* Block timeline */}
          <div className="w-64 border-r border-gray-100 overflow-y-auto px-3 py-2 space-y-1">
            {orderedNodes.map((node, i) => {
              const status: BlockStatus = nodeStatuses[node.id] ?? 'idle'
              const progress = nodeRowProgress[node.id]
              const meta = BLOCK_META[node.data.blockType as BlockType]
              return (
                <div
                  key={node.id}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {i + 1}. {node.data.label}
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>
                      {statusLabel(status)}
                      {status === 'running' && progress && progress.total > 0
                        ? ` — ${progress.processed}/${progress.total}`
                        : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Log stream */}
          <div className="flex-1 overflow-y-auto px-4 py-2 font-mono">
            {logs.length === 0 && (
              <div className="text-xs text-gray-400">
                {job.status === 'running' ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    API calls in progress — this can take 30–60 seconds…
                  </span>
                ) : 'Waiting for events…'}
              </div>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed ${
                  log.type === 'error'
                    ? 'text-red-600'
                    : log.type === 'job_done'
                    ? 'text-green-700 font-medium'
                    : 'text-gray-600'
                }`}
              >
                {log.block_index !== undefined && (
                  <span className="text-gray-400">[block {log.block_index}] </span>
                )}
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
