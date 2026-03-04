import { useState, useEffect } from 'react'
import { BLOCK_META } from '../types'

const TUTORIAL_KEY = 'sf_tutorial_seen'

const STEPS = [
  {
    title: 'Welcome to the 64 Workflow Engine',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          The Sixtyfour Workflow Engine lets you build and run data processing pipelines visually —
          no code required. Chain together blocks to read, filter, enrich, and save CSV data using
          Sixtyfour's AI APIs.
        </p>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-700 leading-relaxed">
          <strong>How it works:</strong> You build a workflow by placing blocks on a canvas and
          connecting them in sequence. When you hit Run, each block executes in order — passing its
          output to the next block.
        </div>
        <p className="text-sm text-gray-500">
          This tutorial will walk you through everything you need to get started.
        </p>
      </div>
    ),
  },
  {
    title: 'The Layout',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 leading-relaxed">
          The app is divided into three main areas:
        </p>
        <div className="space-y-2">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm">
              ◧
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Left Panel — Block Palette</div>
              <div className="text-xs text-gray-500 mt-0.5">
                All available blocks live here. Drag one onto the canvas or click it to add it.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm">
              ⬡
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Centre — Canvas</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Your workflow lives here. Arrange and connect blocks to build your pipeline.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm">
              ◨
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Right Panel — Block Config</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Click any block on the canvas to open its settings here.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm">
              ▤
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Bottom — Results</div>
              <div className="text-xs text-gray-500 mt-0.5">
                After a workflow runs, results appear here in a tabbed table — one tab per block.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'The Blocks',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-gray-600 mb-3">
          There are five block types, each with a specific role in your pipeline:
        </p>
        {(
          [
            ['read_csv', 'Load a CSV file into the workflow. This is always your starting block.'],
            ['filter', 'Filter rows using an expression. Only matching rows pass to the next block.'],
            ['enrich_lead', 'Use Sixtyfour AI to look up and add new data fields for each lead.'],
            ['find_email', 'Use Sixtyfour AI to find a professional or personal email for each lead.'],
            ['save_csv', 'Save the current data to a CSV file on the server.'],
          ] as const
        ).map(([type, desc]) => {
          const meta = BLOCK_META[type]
          return (
            <div
              key={type}
              className="flex gap-3 items-start px-3 py-2.5 rounded-xl"
              style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}25` }}
            >
              <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
              <div>
                <div className="text-xs font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    ),
  },
  {
    title: 'Building a Workflow',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Workflows run left to right. Each block passes its output to the next.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              1
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Add blocks</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Drag a block from the left panel onto the canvas, or click it to drop it in automatically.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              2
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Connect them</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Each block has a dot on its <strong>right side</strong> (output) and its{' '}
                <strong>left side</strong> (input). Drag from one block's right dot to the next
                block's left dot to connect them.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              3
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Arrange freely</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Drag blocks anywhere on the canvas to reposition them. Delete a block by hovering
                over it and clicking the <strong>×</strong> button that appears.
              </div>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          A typical workflow starts with <strong>Read CSV</strong> and ends with{' '}
          <strong>Save CSV</strong>, with processing blocks in between.
        </div>
      </div>
    ),
  },
  {
    title: 'Configuring Blocks',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Every block needs to be configured before the workflow can run. Click any block on the
          canvas to open its settings in the right panel.
        </p>
        <div className="space-y-2.5">
          <div className="flex gap-3 items-start">
            <span className="text-base mt-0.5">📂</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">Read CSV</div>
              <div className="text-xs text-gray-500">Upload a CSV or XLSX file.</div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-base mt-0.5">🔍</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">Filter</div>
              <div className="text-xs text-gray-500">
                Enter an expression like{' '}
                <code className="bg-gray-100 px-1 rounded">company.str.contains('acme')</code> or{' '}
                <code className="bg-gray-100 px-1 rounded">company == 'Acme Inc'</code>.
                Case-insensitive.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-base mt-0.5">✨</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">Enrich Lead</div>
              <div className="text-xs text-gray-500">
                Add output fields (e.g. <code className="bg-gray-100 px-1 rounded">university</code>{' '}
                → "undergraduate university"). Optionally add a research plan to guide the AI.
                Requires a Sixtyfour API key.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-base mt-0.5">📧</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">Find Email</div>
              <div className="text-xs text-gray-500">
                Choose Professional or Personal mode. Requires a Sixtyfour API key.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-base mt-0.5">💾</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">Save CSV</div>
              <div className="text-xs text-gray-500">Enter a filename for the output file.</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Running & Viewing Results',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              1
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Click Run Workflow</div>
              <div className="text-xs text-gray-500 mt-0.5">
                The engine validates your workflow first. If anything is missing, you'll see a list
                of issues to fix before it runs.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              2
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Watch live progress</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Each block lights up as it runs. Enrichment blocks process rows in parallel and
                show a live row counter. Logs stream in the progress panel below.
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
              3
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">Explore results</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Results appear in a table with one tab per block, so you can inspect the data at
                every stage. Click any column header to sort. Download a CSV from any tab.
              </div>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-700">
          You're all set! Hit <strong>+ New Workflow</strong> at any time to start fresh, or click{' '}
          <strong>Tutorial</strong> in the toolbar to revisit this guide.
        </div>
      </div>
    ),
  },
]

export function TutorialModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setOpen(true)
    }
  }, [])

  function handleClose() {
    localStorage.setItem(TUTORIAL_KEY, 'true')
    setOpen(false)
    setStep(0)
  }

  function handleOpen() {
    setStep(0)
    setOpen(true)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      {/* Toolbar button */}
      <button
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50 transition-all"
        onClick={handleOpen}
      >
        Tutorial
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-indigo-500 mb-1">
                  Step {step + 1} of {STEPS.length}
                </div>
                <div className="font-semibold text-gray-800 text-base leading-snug">
                  {current.title}
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0 mt-0.5"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {current.content}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
              {/* Step dots */}
              <div className="flex gap-1.5 flex-1">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{
                      background: i === step ? '#6366f1' : '#e5e7eb',
                      width: i === step ? '1.25rem' : '0.375rem',
                    }}
                  />
                ))}
              </div>

              {step > 0 && (
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </button>
              )}

              {isLast ? (
                <button
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  onClick={handleClose}
                >
                  Get Started
                </button>
              ) : (
                <button
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
