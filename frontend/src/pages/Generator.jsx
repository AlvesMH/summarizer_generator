import React, { useEffect, useMemo, useState } from 'react'
import { postJSON } from '../utils'

const LS_KEY = 'rag_system_prompt'
const PREFILL_KEY = 'prefill_generator_message'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function FieldLabel({ title, hint }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-medium">{title}</div>
      {hint ? <div className="text-xs text-[var(--muted)] mt-0.5">{hint}</div> : null}
    </div>
  )
}

export default function Generator() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [temperature, setTemperature] = useState(0.6)
  const [topK, setTopK] = useState(6)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Persist System Prompt across sessions
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved !== null) setSystemPrompt(saved)
  }, [])
  useEffect(() => {
    if (!systemPrompt) localStorage.removeItem(LS_KEY)
    else localStorage.setItem(LS_KEY, systemPrompt)
  }, [systemPrompt])

  // Prefill from Summariser
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem(PREFILL_KEY)
      if (prefill && !message) {
        setMessage(prefill)
        sessionStorage.removeItem(PREFILL_KEY)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canRun = useMemo(() => !loading && Boolean(message.trim()), [loading, message])

  function showToast(msg) {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(''), 1800)
  }

  async function run() {
    setError('')
    setLoading(true)
    setAnswer('')
    setSources([])
    setMatches([])
    try {
      const data = await postJSON('/api/generate', {
        message,
        system_prompt: systemPrompt || null,
        temperature,
        top_k: topK,
      })
      if (data.error) throw new Error(data.error)
      setAnswer(data.answer || '')
      setSources(data.sources || [])
      setMatches(data.matches || [])
    } catch (e) {
      setError(e?.message || 'Failed to generate.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setMessage('')
    setAnswer('')
    setSources([])
    setMatches([])
    setError('')
  }

  return (
    <main className="max-w-5xl mx-auto px-4 pb-10">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Generator</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ask questions grounded in the passages stored by the Summariser. If the stored material is insufficient, the
            answer should explicitly state the limitation.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <FieldLabel
              title="Question"
              hint="Be explicit about the expected output format (bullets, short paragraph, table) and require citations if needed."
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder='Example: "Summarise the main claims and evidence. Use bullet points and cite as [Doc i]."'
              className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Retrieval depth</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Controls how many passages are used as evidence (higher can be broader but noisier).
                  </div>
                </div>
                <div className="text-sm text-[var(--muted)]">{topK}</div>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={topK}
                onChange={(e) => setTopK(clamp(Number(e.target.value), 2, 12))}
                className="w-full mt-4"
              />
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

          <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Advanced prompt control</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Optional system prompt, persisted in your browser.</div>
              </div>
              <div className="text-xs text-[var(--muted)]">Open</div>
            </summary>
            <div className="mt-4">
              <FieldLabel
                title="System prompt (persistent)"
                hint="Use this to enforce structure, tone, and citation conventions across multiple questions."
              />
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="Example: You are a precise research assistant. Always cite evidence as [Doc i]. If evidence is insufficient, say so."
                className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setSystemPrompt('')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted)] hover:brightness-110"
                >
                  Clear system prompt
                </button>
              </div>
            </div>
          </details>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={run}
                disabled={!canRun}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)] hover:brightness-110"
              >
                Reset
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Tip: If you want strict grounding, require citations and ask for a brief evidence check.
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {answer ? (
        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="p-6 border-b border-[var(--border)] flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Answer</h3>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Sources referenced: {sources?.length ?? 0} • Evidence matches: {matches?.length ?? 0}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(answer)
                    showToast('Copied to clipboard')
                  } catch {
                    showToast('Copy failed')
                  }
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] hover:brightness-110"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="whitespace-pre-wrap leading-relaxed text-[var(--text)]">{answer}</div>

            {Array.isArray(sources) && sources.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="text-sm font-semibold">Sources referenced</div>
                <ul className="mt-2 space-y-1 text-sm text-[var(--muted)] list-disc ml-5">
                  {sources.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Array.isArray(matches) && matches.length > 0 ? (
              <details className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Evidence matches</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">Identifiers and metadata for retrieved passages.</div>
                  </div>
                  <div className="text-xs text-[var(--muted)]">Open</div>
                </summary>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--muted)]">
                        <th className="py-2 pr-4">id</th>
                        <th className="py-2 pr-4">source</th>
                        <th className="py-2 pr-4">kind</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="py-2 pr-4 font-mono text-xs text-[var(--text)]">{m.id}</td>
                          <td className="py-2 pr-4 text-[var(--muted)]">
                            {m?.meta?.doc_title || m?.meta?.source || 'unknown'}
                          </td>
                          <td className="py-2 pr-4 text-[var(--muted)]">{m?.meta?.kind || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm shadow-2xl">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
