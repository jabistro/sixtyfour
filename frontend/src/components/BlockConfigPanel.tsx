import { useRef, useState } from 'react'
import { useWorkflowStore } from '../store/workflowStore'
import { BLOCK_META, type BlockConfig, type BlockType } from '../types'
import { uploadCsv } from '../api/client'

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
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Or enter file path</label>
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="uploads/data.csv"
          value={config.file_path ?? ''}
          onChange={(e) => onChange({ ...config, file_path: e.target.value })}
        />
      </div>
      {config.file_path && (
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
          placeholder="company.str.contains('Ariglad')"
          value={config.expression ?? ''}
          onChange={(e) => onChange({ ...config, expression: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Uses pandas <code className="bg-gray-100 px-1 rounded">query()</code> syntax.
          Examples: <code className="bg-gray-100 px-1 rounded">company == 'Acme'</code> or{' '}
          <code className="bg-gray-100 px-1 rounded">company.str.contains('Inc')</code>
        </p>
      </div>
    </div>
  )
}

function EnrichLeadConfig({ config, onChange }: { config: BlockConfig; onChange: (c: BlockConfig) => void }) {
  const struct = config.struct ?? {}

  function updateStructKey(oldKey: string, newKey: string) {
    const updated = { ...struct }
    const value = updated[oldKey]
    delete updated[oldKey]
    updated[newKey] = value ?? ''
    onChange({ ...config, struct: updated })
  }

  function updateStructValue(key: string, value: string) {
    onChange({ ...config, struct: { ...struct, [key]: value } })
  }

  function addField() {
    const key = `field_${Object.keys(struct).length + 1}`
    onChange({ ...config, struct: { ...struct, [key]: '' } })
  }

  function removeField(key: string) {
    const updated = { ...struct }
    delete updated[key]
    onChange({ ...config, struct: updated })
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
          {Object.entries(struct).map(([key, value]) => (
            <div key={key} className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                placeholder="field_name"
                value={key}
                onChange={(e) => updateStructKey(key, e.target.value)}
              />
              <span className="text-gray-300">:</span>
              <input
                type="text"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                placeholder="description"
                value={value}
                onChange={(e) => updateStructValue(key, e.target.value)}
              />
              <button
                className="text-red-400 hover:text-red-600 text-xs"
                onClick={() => removeField(key)}
              >
                ✕
              </button>
            </div>
          ))}
          {Object.keys(struct).length === 0 && (
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
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-100 flex flex-col z-20">
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
