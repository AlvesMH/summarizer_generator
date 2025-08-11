import React, { useState } from 'react'
import { postJSON } from '../utils'

export default function Summarizer() {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [detail, setDetail] = useState(40)
  const [temperature, setTemperature] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')

  async function onSummarize(e) {
    e?.preventDefault?.()
    setLoading(true); setError(''); setSummary('')
    try {
      const payload = {
        url: url?.trim() || undefined,   // ONE of url or text
        text: text?.trim() || undefined,
        detail,
        temperature
      }
      const data = await postJSON('/api/summarize', payload)
      if (data.error) throw new Error(data.error)
      setSummary(data.summary || '')
    } catch (err) {
      setError(err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Sea Lion Academic Summarizer</h1>
        <p className="mt-2 text-[var(--muted)]">Paste a URL or upload a PDF/TXT. Adjust detail & temperature, then summarize.</p>
      </header>

      <main className="max-w-4xl mx-auto px-4">
        <div className="bg-[var(--card)] rounded-2xl p-6 shadow-xl border border-[var(--border)]">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Article URL</label>
              <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Or upload PDF/TXT</label>
              <input type="file" accept=".pdf,.txt" onChange={e=>setFile(e.target.files?.[0] || null)} className="w-full text-slate-200" />
              <button onClick={uploadFile} disabled={!file || loading} className="mt-2 px-3 py-2 rounded-xl bg-[var(--primary-2)] text-black hover:brightness-110 disabled:opacity-50 transition">
                {loading ? 'Uploading…' : 'Summarize Uploaded File'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm text-slate-300 mb-2">Or paste raw text</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={6} placeholder="Paste text here…" className="w-full rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Detail ({detail}%)</label>
              <input type="range" min={0} max={100} value={detail} onChange={e=>setDetail(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Temperature ({temperature})</label>
              <input type="range" step="0.05" min={0} max={1} value={temperature} onChange={e=>setTemperature(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={runSummarize} disabled={loading} className="px-4 py-2 rounded-xl font-medium
                                            bg-[var(--primary)] hover:brightness-110 active:brightness-95
                                            text-black disabled:opacity-50 transition">
              {loading ? 'Summarizing…' : 'Summarize'}
            </button>
            <button onClick={()=>{setUrl(''); setText(''); setFile(null); setResult(null); setError('')}} className="px-4 py-2 rounded-lg bg-slate-700">
              Reset
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 mt-4">{error}</p>}

        {result && (
          <div className="mt-8 bg-[var(--card)] rounded-2xl p-6 shadow-xl border border-[var(--border)]">
            <h2 className="text-xl font-semibold">{result.title || 'Summary'}</h2>
            <p className="text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{result.summary}</p>
            <p className="text-slate-400 mt-4 text-sm">
              Chunks used: {Array.isArray(result.chunks_used) ? result.chunks_used.join(', ') : '—'} •
              Total chunks: {result.stats?.chunks_total} • Selected: {result.stats?.chunks_used}
            </p>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-10 text-sm text-slate-400">
        <p>Built with Sea Lion + HF embeddings • <a href="https://github.com" className="underline">Deploy on Render</a></p>
      </footer>
    </div>
  )
}
