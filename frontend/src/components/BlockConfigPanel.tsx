import { useRef, useState } from 'react'
import { useWorkflowStore } from '../store/workflowStore'
import { BLOCK_META, type BlockConfig, type BlockType } from '../types'
import { uploadCsv } from '../api/client'

const SAMPLE_DATA_PATH = 'uploads/take-home-sample-data.csv'

function ReadCsvConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadCsv(file)
      onChange({ ...config, file_path: `uploads/${result.filename}` })
    } catch (err) {
      alert(`Upload failed: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  const isSample = config.file_path === SAMPLE_DATA_PATH

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Upload CSV</label>
        <button
          className="w-full px-3 py-2 text-sm border border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : '📂 Choose CSV or XLSX file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <div className="relative flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button
        className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
          isSample
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50'
        }`}
        onClick={() => onChange({ ...config, file_path: SAMPLE_DATA_PATH })}
      >
        {isSample ? '✓ Sample data selected' : '🗂 Use sample data'}
        {!isSample && (
          <div className="text-xs text-gray-400 mt-0.5">
            10 leads with name, company, email, location, and LinkedIn
          </div>
        )}
      </button>

      {config.file_path && !isSample && (
        <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
          ✓ {config.file_path}
        </div>
      )}
    </div>
  )
}

function FilterConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Filter Expression</label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 font-mono"
          rows={3}
          placeholder="company.str.contains('ariglad')"
          value={config.expression ?? ''}
          onChange={(e) => onChange({ ...config, expression: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Use <code className="bg-gray-100 px-1 rounded">company == 'Ariglad Inc'</code> for exact matches, or{' '}
          <code className="bg-gray-100 px-1 rounded">company.str.contains('ariglad')</code> to match partial names.
          Both are case-insensitive.
        </p>
      </div>
    </div>
  )
}

type StructField = { id: number; key: string; value: string }
let fieldIdCounter = 0

function toFields(struct: Record<string, string>): StructField[] {
  return Object.entries(struct).map(([key, value]) => ({ id: ++fieldIdCounter, key, value }))
}

function toStruct(fields: StructField[]): Record<string, string> {
  const struct: Record<string, string> = {}
  for (const f of fields) struct[f.key] = f.value
  return struct
}

function EnrichLeadConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  const [fields, setFields] = useState<StructField[]>(() => toFields(config.struct ?? {}))

  function updateKey(id: number, newKey: string) {
    const updated = fields.map((f) => (f.id === id ? { ...f, key: newKey } : f))
    setFields(updated)
    onChange({ ...config, struct: toStruct(updated) })
  }

  function updateValue(id: number, newValue: string) {
    const updated = fields.map((f) => (f.id === id ? { ...f, value: newValue } : f))
    setFields(updated)
    onChange({ ...config, struct: toStruct(updated) })
  }

  function addField() {
    const newField: StructField = { id: ++fieldIdCounter, key: `field_${fields.length + 1}`, value: '' }
    const updated = [...fields, newField]
    setFields(updated)
    onChange({ ...config, struct: toStruct(updated) })
  }

  function removeField(id: number) {
    const updated = fields.filter((f) => f.id !== id)
    setFields(updated)
    onChange({ ...config, struct: toStruct(updated) })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Output Fields (struct)</label>
          <button
            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
            onClick={addField}
          >
            + Add field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map(({ id, key, value }) => (
            <div key={id} className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                placeholder="field_name"
                value={key}
                onChange={(e) => updateKey(id, e.target.value)}
              />
              <span className="text-gray-300">:</span>
              <input
                type="text"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                placeholder="description"
                value={value}
                onChange={(e) => updateValue(id, e.target.value)}
              />
              <button
                className="text-red-400 hover:text-red-600 text-xs"
                onClick={() => removeField(id)}
              >
                ✕
              </button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-gray-400 italic">No fields yet. Click + Add field.</p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Research Plan (optional)</label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
          rows={3}
          placeholder="Describe what information to look for…"
          value={config.research_plan ?? ''}
          onChange={(e) => onChange({ ...config, research_plan: e.target.value })}
        />
      </div>
    </div>
  )
}

function FindEmailConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  const mode = config.mode ?? 'PROFESSIONAL'

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Email Mode</label>
        <div className="flex gap-2">
          {(['PROFESSIONAL', 'PERSONAL'] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                mode === m
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
              onClick={() => onChange({ ...config, mode: m })}
            >
              {m === 'PROFESSIONAL' ? '💼 Professional' : '🏠 Personal'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SaveCsvConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Output Filename</label>
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          placeholder="results.csv"
          value={config.output_filename ?? ''}
          onChange={(e) => onChange({ ...config, output_filename: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">Saved to the uploads/ directory on the server.</p>
      </div>
    </div>
  )
}

export function BlockConfigPanel() {
  const { selectedNodeId, nodes, nodeConfigs, setNodeConfig, setSelectedNodeId } =
    useWorkflowStore()

  if (!selectedNodeId) return null

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const blockType = node.data.blockType as BlockType
  const meta = BLOCK_META[blockType]
  const config = nodeConfigs[selectedNodeId] ?? {}

  function handleChange(newConfig: BlockConfig) {
    setNodeConfig(selectedNodeId!, newConfig)
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-100 flex flex-col z-20" onKeyDown={(e) => e.stopPropagation()}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}11)` }}
      >
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-800 truncate">{node.data.label}</div>
          <div className="text-xs text-gray-500">{meta.description}</div>
        </div>
        <button
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          onClick={() => setSelectedNodeId(null)}
        >
          ×
        </button>
      </div>

      {/* Config body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {blockType === 'read_csv' && (
          <ReadCsvConfig config={config} onChange={handleChange} />
        )}
        {blockType === 'filter' && (
          <FilterConfig config={config} onChange={handleChange} />
        )}
        {blockType === 'enrich_lead' && (
          <EnrichLeadConfig config={config} onChange={handleChange} />
        )}
        {blockType === 'find_email' && (
          <FindEmailConfig config={config} onChange={handleChange} />
        )}
        {blockType === 'save_csv' && (
          <SaveCsvConfig config={config} onChange={handleChange} />
        )}
      </div>
    </div>
  )
}
