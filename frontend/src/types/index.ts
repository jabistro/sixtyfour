export type BlockType = 'read_csv' | 'filter' | 'enrich_lead' | 'find_email' | 'save_csv'

export interface BlockConfig {
  // read_csv
  file_path?: string
  // filter
  expression?: string
  // enrich_lead
  struct?: Record<string, string>
  research_plan?: string
  // find_email
  mode?: 'PROFESSIONAL' | 'PERSONAL'
  // save_csv
  output_filename?: string
}

export interface WorkflowBlock {
  id: string
  type: BlockType
  config: BlockConfig
}

export type BlockStatus = 'idle' | 'running' | 'done' | 'error'

export interface BlockNodeData {
  blockType: BlockType
  label: string
  status: BlockStatus
  rowProgress?: { processed: number; total: number }
  configNodeId: string
}

export interface SnapshotData {
  rows: Record<string, unknown>[]
  columns: string[]
  row_count: number
}

export interface JobState {
  jobId: string
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled'
  currentBlockIndex: number
  error?: string
  snapshots: Record<string, SnapshotData>
  logs: WsEvent[]
}

export interface WsEvent {
  type: 'block_start' | 'block_progress' | 'block_done' | 'job_done' | 'error' | 'job_start' | 'ping'
  block_index?: number
  block_type?: string
  message?: string
  row_progress?: { processed: number; total: number }
  snapshot?: Record<string, unknown>[]
  columns?: string[]
  row_count?: number
  job_id?: string
}

export interface BlockMeta {
  type: BlockType
  label: string
  color: string
  icon: string
  description: string
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  read_csv: {
    type: 'read_csv',
    label: 'Read CSV',
    color: '#6366f1',
    icon: '📂',
    description: 'Load a CSV file into the workflow',
  },
  filter: {
    type: 'filter',
    label: 'Filter',
    color: '#8b5cf6',
    icon: '🔍',
    description: 'Filter rows by a pandas expression',
  },
  enrich_lead: {
    type: 'enrich_lead',
    label: 'Enrich Lead',
    color: '#a855f7',
    icon: '✨',
    description: 'Enrich leads using Sixtyfour AI',
  },
  find_email: {
    type: 'find_email',
    label: 'Find Email',
    color: '#f59e0b',
    icon: '📧',
    description: 'Find email addresses for leads',
  },
  save_csv: {
    type: 'save_csv',
    label: 'Save CSV',
    color: '#10b981',
    icon: '💾',
    description: 'Save the results to a CSV file',
  },
}
