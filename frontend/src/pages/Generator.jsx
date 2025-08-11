import React, { useEffect, useState } from 'react'
import { postJSON } from '../utils'

const LS_KEY = 'rag_system_prompt'

export default function Generator() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [temperature, setTemperature] = useState(0.6)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  // Persist System Prompt across the session (and beyond)
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved !== null) setSystemPrompt(saved)
  }, [])
  useEffect(() => {
    // If user clears it, we clear storage; otherwise keep it sticky
    if (!systemPrompt) localStorage.removeItem(LS_KEY)
    else localStorage.setItem(LS_KEY, systemPrompt)
  }, [systemPrompt])

  async function run() {
    setError(''); setLoading(true); setAnswer('')
    try {
      const data = await postJSON('/api/generate', {
        message,
        system_prompt: systemPrompt || null,
        temperature
      })
      if (data.error) throw new Error(data.error)
      setAnswer(data.answer)
    } catch (e) {
      setError(e.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4">
      <header className="py-8">
        <h1 className="text-3xl font-bold tracking-tight">Generator (RAG)</h1>
        <p className="text-slate-300 mt-2">Asks your ChromaDB for relevant passages and crafts a detailed answer.</p>
      </header>

      <section className="bg-[var(--card)] rounded-2xl p-6 shadow-xl">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">System Prompt (persistent)</label>
            <textarea
              value={systemPrompt}
              onChange={e=>setSystemPrompt(e.target.value)}
              rows={10}
              placeholder="e.g., You are a precise research assistant. Always cite sources as [Doc i]..."
              className="w-full rounded-lg bg-[#0f1630] border border-slate-700 px-3 py-2"
            />
            <button
              onClick={()=>setSystemPrompt('')}
              className="mt-2 px-3 py-2 rounded-lg bg-slate-700"
            >Clear</button>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Message</label>
            <textarea
              value={message}
              onChange={e=>setMessage(e.target.value)}
              rows={10}
              placeholder="Ask anything grounded in your knowledge base…"
              className="w-full rounded-lg bg-[#0f1630] border border-slate-700 px-3 py-2"
            />
            <div className="mt-4">
              <label className="block text-sm text-slate-300 mb-2">Temperature ({temperature})</label>
              <input type="range" min={0} max={1} step="0.05" value={temperature} onChange={e=>setTemperature(Number(e.target.value))} className="w-full"/>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={run} disabled={loading} className="px-4 py-2 rounded-lg bg-emerald-600 disabled:opacity-50">
                {loading ? 'Thinking…' : 'Generate'}
              </button>
              <button onClick={()=>{setMessage(''); setAnswer(''); setError('')}} className="px-4 py-2 rounded-lg bg-slate-700">Reset</button>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="text-red-400 mt-4">{error}</p>}
      {answer && (
        <article className="mt-8 bg-[var(--card)] rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold">Answer</h2>
          <div className="text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{answer}</div>
        </article>
      )}

      <footer className="py-10 text-sm text-slate-400">
        <p>Backed by ChromaDB retrieval + Sea Lion completions.</p>
      </footer>
    </main>
  )
}
