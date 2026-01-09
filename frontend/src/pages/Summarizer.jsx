import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJSON, postJSON, uploadFile } from '../utils'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)
  return `${val} ${sizes[i]}`
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function FieldLabel({ title, hint }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-medium">{title}</div>
      {hint ? <div className="text-xs text-[var(--muted)] mt-0.5">{hint}</div> : null}
    </div>
  )
}

function PillTabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cx(
            'rounded-xl px-3 py-2 text-sm transition',
            value === it.value
              ? 'bg-[var(--card)] text-[var(--text)] shadow'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

function Dropzone({ file, onPick }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const helper = file
    ? `${file.name} (${formatBytes(file.size)})`
    : 'Drag and drop a PDF/TXT here, or click to choose a file.'

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click?.()}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
          const f = e.dataTransfer?.files?.[0]
          if (f) onPick(f)
        }}
        className={cx(
          'w-full rounded-2xl border border-dashed px-4 py-5 text-left transition',
          dragOver
            ? 'border-[var(--primary)] bg-[rgba(0,230,148,0.08)]'
            : 'border-[var(--border)] bg-[var(--surface)] hover:brightness-110'
        )}
      >
        <div className="text-sm font-medium">Upload a document</div>
        <div className="mt-1 text-xs text-[var(--muted)]">{helper}</div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,text/plain,application/pdf"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  )
}

export default function Summarizer() {
  const navigate = useNavigate()

  const [mode, setMode] = useState('url') // url | file | text
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)

  const [detail, setDetail] = useState(50)
  const [temperature, setTemperature] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState('')

  // Admin state
  const [adminLoading, setAdminLoading] = useState(false)
  const [collections, setCollections] = useState(null)
  const [purgeSource, setPurgeSource] = useState('')
  const [adminMsg, setAdminMsg] = useState('')

  const canRun = useMemo(() => {
    if (loading) return false
    if (mode === 'url') return Boolean(url.trim())
    if (mode === 'text') return Boolean(text.trim())
    if (mode === 'file') return Boolean(file)
    return false
  }, [file, loading, mode, text, url])

  function showToast(msg) {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(''), 1800)
  }

  async function onSummarize(e) {
    e?.preventDefault?.()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      if (mode === 'file') {
        if (!file) throw new Error('Please choose a file first.')
        const data = await uploadFile(file, detail, temperature)
        if (data.error) throw new Error(data.error)
        setResult(data)
        setFile(null)
        return
      }

      const payload = {
        url: mode === 'url' ? url.trim() || undefined : undefined,
        text: mode === 'text' ? text.trim() || undefined : undefined,
        detail,
        temperature,
      }
      const data = await postJSON('/api/summarize', payload)
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      setError(err?.message || 'Failed to summarise.')
    } finally {
      setLoading(false)
    }
  }

  function onReset() {
    setUrl('')
    setText('')
    setFile(null)
    setError('')
    setResult(null)
  }

  function applyPreset(preset) {
    if (preset === 'concise') setDetail(25)
    if (preset === 'balanced') setDetail(50)
    if (preset === 'detailed') setDetail(80)
  }

  // ---- Admin handlers ----
  async function onListCollections() {
    setAdminLoading(true)
    setAdminMsg('')
    try {
      const data = await getJSON('/api/debug/collections')
      setCollections(data.collections || [])
    } catch (e) {
      setAdminMsg(`List failed: ${e?.message || e}`)
    } finally {
      setAdminLoading(false)
    }
  }

  async function onDeleteBySource() {
    const src = purgeSource.trim()
    if (!src) {
      setAdminMsg('Enter an exact source (filename or page title).')
      return
    }
    setAdminLoading(true)
    setAdminMsg('')
    try {
      const data = await postJSON('/api/documents/delete', {
        collection: 'knowledge',
        source: src,
      })
      setAdminMsg(`Deleted ${data.deleted ?? 0} items for source: "${src}"`)
      if (collections) await onListCollections()
    } catch (e) {
      setAdminMsg(`Delete failed: ${e?.message || e}`)
    } finally {
      setAdminLoading(false)
    }
  }

  async function onClearKnowledge() {
    setAdminLoading(true)
    setAdminMsg('')
    try {
      const data = await postJSON('/api/documents/delete', {
        collection: 'knowledge',
        all: true,
      })
      setAdminMsg(`Cleared knowledge base (deleted ${data.deleted ?? 0} items).`)
      setCollections(null)
    } catch (e) {
      setAdminMsg(`Clear failed: ${e?.message || e}`)
    } finally {
      setAdminLoading(false)
    }
  }
  // ------------------------

  const charCount = text.length
  const urlHint = 'Use a public article/paper URL. The app extracts text and produces a summary.'
  const textHint = 'Paste content directly (for example, an abstract, lecture notes, or a section of a report).'

  return (
    <main className="max-w-5xl mx-auto px-4 pb-10">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <div className="p-6 border-b border-[var(--border)] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Summariser</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ingest a URL, document, or text. The result can be used as evidence for follow-up questions in Generator
              mode.
            </p>
          </div>
          <PillTabs
            value={mode}
            onChange={setMode}
            items={[
              { value: 'url', label: 'URL' },
              { value: 'file', label: 'Upload' },
              { value: 'text', label: 'Text' },
            ]}
          />
        </div>

        <div className="p-6 space-y-6">
          {mode === 'url' && (
            <div>
              <FieldLabel title="Article or paper URL" hint={urlHint} />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          )}

          {mode === 'file' && (
            <div className="space-y-3">
              <FieldLabel title="Upload PDF or TXT" hint="Recommended for academic papers and reports." />
              <Dropzone file={file} onPick={setFile} />
              {file && (
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                  <div className="text-[var(--muted)] truncate">Selected: <span className="text-[var(--text)]">{file.name}</span></div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)] hover:brightness-110"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'text' && (
            <div>
              <FieldLabel title="Raw text" hint={textHint} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste text here…"
                className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div className="mt-2 text-xs text-[var(--muted)]">Character count: {charCount.toLocaleString()}</div>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Detail</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Controls how much content is included.</div>
                </div>
                <div className="text-sm text-[var(--muted)]">{detail}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={detail}
                onChange={(e) => setDetail(clamp(Number(e.target.value), 0, 100))}
                className="w-full mt-4"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('concise')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)] hover:brightness-110"
                >
                  Concise
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('balanced')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)] hover:brightness-110"
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('detailed')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)] hover:brightness-110"
                >
                  Detailed
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Temperature</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Lower values are typically more literal and factual.</div>
                </div>
                <div className="text-sm text-[var(--muted)]">{temperature.toFixed(2)}</div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(clamp(Number(e.target.value), 0, 1))}
                className="w-full mt-4"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSummarize}
                disabled={!canRun}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Summarising…' : 'Summarise'}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)] hover:brightness-110"
              >
                Reset
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Tip: Use Generator mode after summarising to ask questions grounded in stored passages.
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {result && (
        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="p-6 border-b border-[var(--border)] flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{result.title || 'Summary'}</h3>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Chunks selected: {result.stats?.chunks_used ?? '—'} / {result.stats?.chunks_total ?? '—'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.summary || '')
                    showToast('Copied to clipboard')
                  } catch {
                    showToast('Copy failed')
                  }
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] hover:brightness-110"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  const safe = (result.title || 'summary').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'summary'
                  downloadText(`${safe}.txt`, result.summary || '')
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] hover:brightness-110"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = result.title || 'the document'
                  const starter =
                    `Based on "${title}", answer the following:\n` +
                    `1) What are the main claims and supporting evidence?\n` +
                    `2) What are key assumptions and limitations?\n` +
                    `3) What are the practical implications?\n\n` +
                    `Use bullet points and cite sources as [Doc i].`
                  sessionStorage.setItem('prefill_generator_message', starter)
                  navigate('/generator')
                }}
                className="rounded-xl bg-[var(--primary-2)] px-3 py-2 text-sm font-medium text-black hover:brightness-110"
              >
                Ask a follow-up
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="whitespace-pre-wrap leading-relaxed text-[var(--text)]">{result.summary}</div>
          </div>
        </section>
      )}

      <section className="mt-6">
        <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <summary className="cursor-pointer list-none p-6 flex items-center justify-between">
            <div>
              <div className="text-sm tracking-wider uppercase text-[var(--muted)]">Advanced</div>
              <div className="mt-1 text-base font-semibold">Knowledge base management</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Inspect and clear stored passages used by the Generator.
              </div>
            </div>
            <div className="text-xs text-[var(--muted)] group-open:hidden">Open</div>
            <div className="text-xs text-[var(--muted)] hidden group-open:block">Close</div>
          </summary>

          <div className="border-t border-[var(--border)] p-6 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={onListCollections}
                disabled={adminLoading}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)] hover:brightness-110 disabled:opacity-50"
              >
                {adminLoading ? 'Working…' : 'List collections'}
              </button>
              <button
                type="button"
                onClick={onClearKnowledge}
                disabled={adminLoading}
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:brightness-110 disabled:opacity-50"
              >
                Clear knowledge base
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="text-sm font-medium">Purge by source (exact match)</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Use the filename (for uploads) or the page title (for URLs).
              </div>
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <input
                  value={purgeSource}
                  onChange={(e) => setPurgeSource(e.target.value)}
                  placeholder="e.g., paper.pdf or Article Title"
                  className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={onDeleteBySource}
                  disabled={adminLoading}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  Purge
                </button>
              </div>
            </div>

            {adminMsg ? <div className="text-sm text-[var(--muted)]">{adminMsg}</div> : null}

            {Array.isArray(collections) ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="text-sm font-semibold">Collections</div>
                <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                  {collections.length === 0 ? (
                    <li>No collections found.</li>
                  ) : (
                    collections.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-4">
                        <span className="font-mono text-xs text-[var(--text)]">{c.name}</span>
                        <span className="text-xs">{c.count ?? 'n/a'} items</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </section>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm shadow-2xl">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
