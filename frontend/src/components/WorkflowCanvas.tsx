import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowStore, getOrderedNodes } from '../store/workflowStore'
import { BLOCK_META, type BlockType, type BlockConfig } from '../types'
import BlockNodeComponent from './BlockNode'
import { TutorialModal } from './TutorialModal'
import { executeWorkflow } from '../api/client'
import { useJobWebSocket } from '../api/client'

const nodeTypes = { blockNode: BlockNodeComponent }

const PALETTE_BLOCKS: BlockType[] = ['read_csv', 'filter', 'enrich_lead', 'find_email', 'save_csv']

interface ValidationError {
  nodeId: string | null
  label: string
  message: string
}

function validateWorkflow(
  nodes: Node[],
  edges: { source: string; target: string }[],
  nodeConfigs: Record<string, BlockConfig>,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (nodes.length > 1 && edges.length === 0) {
    errors.push({
      nodeId: null,
      label: 'Connection',
      message: 'Blocks are not connected. Drag from a block\'s right handle to the next block\'s left handle.',
    })
  }

  for (const node of nodes) {
    const config = nodeConfigs[node.id] ?? {}
    const label = node.data.label as string
    const type = node.data.blockType as BlockType

    if (type === 'read_csv' && !config.file_path?.trim()) {
      errors.push({ nodeId: node.id, label, message: 'No CSV file selected or path entered.' })
    }
    if (type === 'filter' && !config.expression?.trim()) {
      errors.push({ nodeId: node.id, label, message: 'Filter expression is required.' })
    }
    if (type === 'enrich_lead' && Object.keys(config.struct ?? {}).length === 0) {
      errors.push({ nodeId: node.id, label, message: 'At least one output field must be defined.' })
    }
    if (type === 'save_csv' && !config.output_filename?.trim()) {
      errors.push({ nodeId: node.id, label, message: 'Output filename is required.' })
    }
  }

  return errors
}

export function WorkflowCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onConnect,
    addBlockNode,
    setSelectedNodeId,
    selectedNodeId,
    activeJobId,
    handleWsEvent,
    nodeConfigs,
    resetWorkflow,
  } = useWorkflowStore()

  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [showNewWorkflowConfirm, setShowNewWorkflowConfirm] = useState(false)

  // WebSocket for active job
  useJobWebSocket(activeJobId, (event) => {
    if (activeJobId) handleWsEvent(activeJobId, event)
  })

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
    },
    [selectedNodeId, setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('blockType') as BlockType
      if (!type) return
      const bounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const position = rfInstance.current?.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      }) ?? { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
      addBlockNode(type, position)
    },
    [addBlockNode]
  )

  async function handleRun() {
    if (nodes.length === 0) {
      setValidationErrors([{ nodeId: null, label: 'Workflow', message: 'Add at least one block to the canvas before running.' }])
      return
    }

    const errors = validateWorkflow(nodes, edges, nodeConfigs)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    const orderedNodes = getOrderedNodes(nodes, edges)
    const blocks = orderedNodes.map((node) => ({
      type: node.data.blockType as string,
      config: (nodeConfigs[node.id] ?? {}) as Record<string, unknown>,
    }))

    // Reset statuses
    for (const node of nodes) {
      useWorkflowStore.getState().setNodeStatus(node.id, 'idle')
    }

    try {
      const { job_id } = await executeWorkflow(blocks)
      useWorkflowStore.getState().initJob(job_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`Failed to start workflow: ${message}`)
    }
  }

  const isRunning = useWorkflowStore((s) => {
    if (!s.activeJobId) return false
    const job = s.jobs[s.activeJobId]
    return job?.status === 'running' || job?.status === 'pending'
  })

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-5 h-14 bg-white border-b border-gray-200 shadow-sm z-20 flex-shrink-0">
        <div className="font-bold text-lg text-gray-800 mr-2">
          <span className="text-indigo-600">64</span> Workflow Engine
        </div>

        <button
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50 transition-all"
          onClick={() => {
            if (nodes.length === 0) {
              resetWorkflow()
            } else {
              setShowNewWorkflowConfirm(true)
            }
          }}
          disabled={isRunning}
        >
          + New Workflow
        </button>

        <div className="flex-1" />

        <TutorialModal />

        {/* Run button */}
        <button
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all ${
            isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md hover:shadow-lg'
          }`}
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? '⟳ Running…' : '▶ Run Workflow'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Block palette */}
        <div className="w-52 bg-white border-r border-gray-100 flex flex-col gap-1 px-3 py-4 flex-shrink-0 shadow-sm z-10">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Blocks
          </div>
          {PALETTE_BLOCKS.map((type) => {
            const meta = BLOCK_META[type]
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('blockType', type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => addBlockNode(type)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing hover:scale-[1.02] active:scale-95 transition-transform select-none"
                style={{ background: `${meta.color}15`, border: `1.5px solid ${meta.color}30` }}
              >
                <span className="text-base">{meta.icon}</span>
                <div>
                  <div className="text-xs font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="mt-auto pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              Drag blocks onto the canvas or click to add. Connect them to build your workflow.
            </p>
          </div>
        </div>

        {/* React Flow canvas */}
        <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes: NodeChange[]) =>
              setNodes((nds) => applyNodeChanges(changes, nds))
            }
            onEdgesChange={(changes: EdgeChange[]) =>
              setEdges((eds) => applyEdgeChanges(changes, eds))
            }
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              rfInstance.current = instance
            }}
            deleteKeyCode={null}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2, stroke: '#6366f1' } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                const meta = BLOCK_META[node.data?.blockType as BlockType]
                return meta?.color ?? '#999'
              }}
              maskColor="rgba(255,255,255,0.7)"
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <div className="text-5xl mb-3">⬡</div>
                <div className="text-sm font-medium">Drag blocks from the left panel</div>
                <div className="text-xs mt-1">or click any block to add it to the canvas</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Workflow confirmation modal */}
      {showNewWorkflowConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowNewWorkflowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-5">
              <div className="font-semibold text-gray-800 text-sm mb-1">Start a new workflow?</div>
              <div className="text-xs text-gray-500">This will clear the current canvas. Any unsaved progress will be lost.</div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setShowNewWorkflowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                onClick={() => {
                  resetWorkflow()
                  setShowNewWorkflowConfirm(false)
                }}
              >
                Clear & Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation errors modal */}
      {validationErrors.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setValidationErrors([])}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 text-sm">Fix before running</div>
                <div className="text-xs text-gray-400">
                  {validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''} found
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                onClick={() => setValidationErrors([])}
              >
                ×
              </button>
            </div>

            {/* Error list */}
            <div className="px-5 py-3 space-y-2 max-h-72 overflow-y-auto">
              {validationErrors.map((err, i) => {
                const blockType = err.nodeId
                  ? (nodes.find((n) => n.id === err.nodeId)?.data.blockType as BlockType | undefined)
                  : null
                const meta = blockType ? BLOCK_META[blockType] : null
                return (
                  <button
                    key={i}
                    className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                    onClick={() => {
                      if (err.nodeId) {
                        setSelectedNodeId(err.nodeId)
                        setValidationErrors([])
                      }
                    }}
                  >
                    <span className="text-base mt-0.5 flex-shrink-0">
                      {meta ? meta.icon : '🔗'}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-semibold"
                        style={{ color: meta?.color ?? '#6b7280' }}
                      >
                        {err.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{err.message}</div>
                    </div>
                    {err.nodeId && (
                      <span className="ml-auto text-xs text-indigo-400 opacity-0 group-hover:opacity-100 flex-shrink-0 self-center">
                        Fix →
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                onClick={() => setValidationErrors([])}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
