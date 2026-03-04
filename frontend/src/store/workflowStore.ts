import { create } from 'zustand'
import { type Edge, type Node, addEdge, type Connection } from 'reactflow'
import type { BlockConfig, BlockStatus, BlockType, JobState, SnapshotData, WsEvent } from '../types'
import { BLOCK_META } from '../types'

let nodeCounter = 0

function makeNodeId() {
  return `node_${++nodeCounter}`
}

interface WorkflowStore {
  // React Flow
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  onConnect: (connection: Connection) => void
  addBlockNode: (type: BlockType, position?: { x: number; y: number }) => void

  // Selection
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // Block configs
  nodeConfigs: Record<string, BlockConfig>
  setNodeConfig: (nodeId: string, config: BlockConfig) => void

  // Block status (per node)
  nodeStatuses: Record<string, BlockStatus>
  nodeRowProgress: Record<string, { processed: number; total: number }>
  setNodeStatus: (nodeId: string, status: BlockStatus) => void
  setNodeRowProgress: (nodeId: string, progress: { processed: number; total: number }) => void

  // API key
  apiKey: string
  setApiKey: (key: string) => void

  // Jobs
  activeJobId: string | null
  setActiveJobId: (id: string | null) => void
  initJob: (jobId: string) => void
  applyJobPoll: (jobId: string, data: Record<string, unknown>) => void
  jobs: Record<string, JobState>
  handleWsEvent: (jobId: string, event: WsEvent) => void

  // Reset
  resetWorkflow: () => void
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],

  setNodes: (nodes) =>
    set((state) => ({
      nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
    })),

  setEdges: (edges) =>
    set((state) => ({
      edges: typeof edges === 'function' ? edges(state.edges) : edges,
    })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge({ ...connection, animated: false }, state.edges),
    })),

  addBlockNode: (type, position) => {
    const id = makeNodeId()
    const meta = BLOCK_META[type]
    const existingOfType = get().nodes.filter(
      (n) => n.data?.blockType === type
    ).length
    const label = existingOfType > 0 ? `${meta.label} ${existingOfType + 1}` : meta.label

    const newNode: Node = {
      id,
      type: 'blockNode',
      position: position ?? { x: 100 + get().nodes.length * 220, y: 200 },
      data: {
        blockType: type,
        label,
        status: 'idle',
        configNodeId: id,
      },
    }

    set((state) => ({
      nodes: [...state.nodes, newNode],
      nodeConfigs: { ...state.nodeConfigs, [id]: {} },
    }))
  },

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  nodeConfigs: {},
  setNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodeConfigs: { ...state.nodeConfigs, [nodeId]: config },
    })),

  nodeStatuses: {},
  nodeRowProgress: {},
  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [nodeId]: status },
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
      ),
    })),
  setNodeRowProgress: (nodeId, progress) =>
    set((state) => ({
      nodeRowProgress: { ...state.nodeRowProgress, [nodeId]: progress },
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, rowProgress: progress } }
          : n
      ),
    })),

  apiKey: '',
  setApiKey: (key) => set({ apiKey: key }),

  activeJobId: null,
  setActiveJobId: (id) => set({ activeJobId: id }),

  // Pre-initialize job so JobProgress renders immediately (before any WS events)
  initJob: (jobId) =>
    set((state) => ({
      activeJobId: jobId,
      jobs: {
        ...state.jobs,
        [jobId]: {
          jobId,
          status: 'running' as const,
          currentBlockIndex: 0,
          snapshots: {},
          logs: [],
        },
      },
    })),

  // Merge poll response into job state (fallback for missed WS events)
  applyJobPoll: (jobId, data) =>
    set((state) => {
      const existing = state.jobs[jobId]
      if (!existing) return state
      const pollStatus = data.status as JobState['status']
      // Don't downgrade a done/error status
      if (existing.status === 'done' || existing.status === 'error') return state
      const snapshots: Record<string, SnapshotData> = {}
      const rawSnaps = data.snapshots as Record<string, { rows: Record<string, unknown>[]; columns: string[]; row_count: number }> | undefined
      if (rawSnaps) {
        for (const [k, v] of Object.entries(rawSnaps)) {
          snapshots[k] = v
        }
      }
      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...existing,
            status: pollStatus,
            error: data.error as string | undefined,
            currentBlockIndex: (data.current_block_index as number) ?? existing.currentBlockIndex,
            snapshots: Object.keys(snapshots).length > 0 ? snapshots : existing.snapshots,
          },
        },
      }
    }),

  jobs: {},

  resetWorkflow: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      nodeConfigs: {},
      nodeStatuses: {},
      nodeRowProgress: {},
      selectedNodeId: null,
      activeJobId: null,
      jobs: {},
      apiKey: state.apiKey, // preserve API key
    })),

  handleWsEvent: (jobId, event) => {
    const { nodes, setNodeStatus, setNodeRowProgress } = get()

    set((state) => {
      const existing = state.jobs[jobId] ?? {
        jobId,
        status: 'running' as const,
        currentBlockIndex: 0,
        snapshots: {},
        logs: [],
      }

      const updatedJob: JobState = {
        ...existing,
        logs: [...existing.logs, event],
      }

      if (event.type === 'job_done') {
        updatedJob.status = 'done'
      } else if (event.type === 'error') {
        updatedJob.status = 'error'
        updatedJob.error = event.message
      } else if (event.type === 'block_done' && event.block_index !== undefined) {
        updatedJob.currentBlockIndex = event.block_index
        if (event.snapshot !== undefined && event.columns !== undefined) {
          updatedJob.snapshots[String(event.block_index)] = {
            rows: event.snapshot as Record<string, unknown>[],
            columns: event.columns,
            row_count: event.row_count ?? (event.snapshot?.length ?? 0),
          } as SnapshotData
        }
      }

      return { jobs: { ...state.jobs, [jobId]: updatedJob } }
    })

    // Update node statuses based on block index
    const blockIndex = event.block_index
    if (blockIndex !== undefined) {
      // Build ordered node list from edges
      const orderedNodes = getOrderedNodes(nodes, get().edges)
      const targetNode = orderedNodes[blockIndex]
      if (targetNode) {
        if (event.type === 'block_start') {
          setNodeStatus(targetNode.id, 'running')
        } else if (event.type === 'block_done') {
          setNodeStatus(targetNode.id, 'done')
          setNodeRowProgress(targetNode.id, { processed: 0, total: 0 })
        } else if (event.type === 'error') {
          setNodeStatus(targetNode.id, 'error')
        } else if (event.type === 'block_progress' && event.row_progress) {
          setNodeRowProgress(targetNode.id, event.row_progress)
        }
      }
    }
  },
}))

/** Traverse edges to get nodes in execution order (topological sort for linear chain) */
export function getOrderedNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return []

  const inDegree: Record<string, number> = {}
  const outgoing: Record<string, string[]> = {}

  for (const node of nodes) {
    inDegree[node.id] = 0
    outgoing[node.id] = []
  }
  for (const edge of edges) {
    inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1
    outgoing[edge.source] = [...(outgoing[edge.source] ?? []), edge.target]
  }

  const roots = nodes.filter((n) => (inDegree[n.id] ?? 0) === 0)
  const ordered: Node[] = []
  const queue = [...roots]

  while (queue.length > 0) {
    const current = queue.shift()!
    ordered.push(current)
    for (const nextId of outgoing[current.id] ?? []) {
      const nextNode = nodes.find((n) => n.id === nextId)
      if (nextNode) queue.push(nextNode)
    }
  }

  // Append any disconnected nodes at the end
  for (const node of nodes) {
    if (!ordered.find((n) => n.id === node.id)) {
      ordered.push(node)
    }
  }

  return ordered
}
