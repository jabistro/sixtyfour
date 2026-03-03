import { useCallback, useRef } from 'react'
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
import { BLOCK_META, type BlockType } from '../types'
import BlockNodeComponent from './BlockNode'
import { executeWorkflow } from '../api/client'
import { useJobWebSocket } from '../api/client'

const nodeTypes = { blockNode: BlockNodeComponent }

const PALETTE_BLOCKS: BlockType[] = ['read_csv', 'filter', 'enrich_lead', 'find_email', 'save_csv']

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
  } = useWorkflowStore()

  const rfInstance = useRef<ReactFlowInstance | null>(null)

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
      alert('Add at least one block to run.')
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

        <div className="flex-1" />

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
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2, stroke: '#6366f1' } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls />
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
    </div>
  )
}
