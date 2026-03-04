import { useState } from 'react'
import { useWorkflowStore, getOrderedNodes } from '../store/workflowStore'
import { BLOCK_META, type BlockType } from '../types'

function downloadJson(rows: Record<string, unknown>[], columns: string[], filename: string) {
  // Build CSV string
  const header = columns.join(',')
  const csvRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(',')
  )
  const csvContent = [header, ...csvRows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsTable() {
  const { activeJobId, jobs, nodes, edges } = useWorkflowStore()
  const [activeTab, setActiveTab] = useState<number>(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  if (!activeJobId) return null
  const job = jobs[activeJobId]
  if (!job || (job.status !== 'done' && Object.keys(job.snapshots).length === 0)) return null

  const orderedNodes = getOrderedNodes(nodes, edges)
  const availableTabs = orderedNodes
    .map((node, i) => ({ node, index: i, snapshot: job.snapshots[String(i)] }))
    .filter((t) => t.snapshot)

  if (availableTabs.length === 0) return null

  const clampedTab = Math.min(activeTab, availableTabs.length - 1)
  const currentTab = availableTabs[clampedTab]
  if (!currentTab) return null

  const { snapshot, node } = currentTab
  const meta = BLOCK_META[node.data.blockType as BlockType]

  let rows = snapshot.rows
  if (sortCol) {
    rows = [...rows].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
  }

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortAsc((a) => !a)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-64 top-16 bg-white border-t border-gray-200 z-10 flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 border-b border-gray-100 overflow-x-auto">
        {availableTabs.map((tab, i) => {
          const tabMeta = BLOCK_META[tab.node.data.blockType as BlockType]
          return (
            <button
              key={i}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg font-medium whitespace-nowrap border-b-2 transition-colors ${
                clampedTab === i
                  ? 'border-b-2 bg-white text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              style={clampedTab === i ? { borderBottomColor: tabMeta.color } : {}}
              onClick={() => setActiveTab(i)}
            >
              <span>{tabMeta.icon}</span>
              After {tab.node.data.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full ml-1"
                style={{
                  background: tabMeta.color + '22',
                  color: tabMeta.color,
                }}
              >
                {tab.snapshot.row_count}
              </span>
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium"
            onClick={() =>
              downloadJson(
                snapshot.rows,
                snapshot.columns,
                `snapshot_${node.data.label.replace(/\s+/g, '_').toLowerCase()}.csv`
              )
            }
          >
            ↓ Download CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200 w-10">
                #
              </th>
              {snapshot.columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2 text-gray-600 font-medium border-b border-gray-200 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  {col}
                  {sortCol === col && (
                    <span className="ml-1 text-gray-400">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                {snapshot.columns.map((col) => {
                  const val = row[col]
                  const isEmpty =
                    val === null ||
                    val === undefined ||
                    (typeof val === 'number' && isNaN(val)) ||
                    (typeof val === 'string' && val.trim().toLowerCase() === 'nan')
                  const display = isEmpty
                    ? 'Not Found'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val)
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 max-w-xs truncate ${isEmpty ? 'text-gray-300 italic' : 'text-gray-700'}`}
                      title={isEmpty ? '' : display}
                    >
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={snapshot.columns.length + 1}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  No rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
