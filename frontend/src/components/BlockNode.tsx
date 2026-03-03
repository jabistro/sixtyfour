import { memo } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow'
import type { BlockNodeData, BlockStatus } from '../types'
import { BLOCK_META } from '../types'

function StatusIndicator({ status }: { status: BlockStatus }) {
  if (status === 'idle') return <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
  if (status === 'running') {
    return (
      <div className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent border-blue-500 animate-spin" />
    )
  }
  if (status === 'done') return <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
  if (status === 'error') return <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
  return null
}

function BlockNode({ id, data, selected }: NodeProps<BlockNodeData>) {
  const meta = BLOCK_META[data.blockType]
  const isRunning = data.status === 'running'
  const { deleteElements } = useReactFlow()

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div
      className={`
        group relative rounded-xl shadow-lg border-2 min-w-[180px] cursor-pointer select-none
        transition-all duration-150
        ${selected ? 'ring-2 ring-offset-1 ring-white' : ''}
      `}
      style={{
        borderColor: meta.color,
        background: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}11 100%)`,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: meta.color }}
      />

      {/* Delete button — appears on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-gray-400 hover:bg-red-500 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
        title="Remove block"
      >
        ×
      </button>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg leading-none">{meta.icon}</span>
          <span
            className="text-sm font-semibold leading-tight"
            style={{ color: meta.color }}
          >
            {data.label}
          </span>
          <div className="ml-auto">
            <StatusIndicator status={data.status} />
          </div>
        </div>

        {/* Progress */}
        {isRunning && data.rowProgress && data.rowProgress.total > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">
              {data.rowProgress.processed}/{data.rowProgress.total} rows
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((data.rowProgress.processed / data.rowProgress.total) * 100)}%`,
                  background: meta.color,
                }}
              />
            </div>
          </div>
        )}
        {isRunning && (!data.rowProgress || data.rowProgress.total === 0) && (
          <div className="mt-1 text-xs text-gray-400 italic">Running…</div>
        )}
        {data.status === 'done' && (
          <div className="mt-1 text-xs text-green-600 font-medium">✓ Complete</div>
        )}
        {data.status === 'error' && (
          <div className="mt-1 text-xs text-red-500 font-medium">✗ Error</div>
        )}
      </div>

      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: meta.color }}
      />
    </div>
  )
}

export default memo(BlockNode)
