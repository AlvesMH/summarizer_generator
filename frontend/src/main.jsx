import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from 'react-router-dom'
import Summarizer from './pages/Summarizer'
import Generator from './pages/Generator'
import './index.css'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function HelpModal({ open, onClose }) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close help"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div className="relative w-[min(860px,92vw)] max-h-[85vh] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-start justify-between gap-6 p-6 border-b border-[var(--border)]">
          <div>
            <div className="text-xs tracking-wider uppercase text-[var(--muted)]">How to use</div>
            <h2 className="mt-1 text-xl font-semibold">A practical workflow for summarising and querying</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              The app has two modes. Use the Summarizer to ingest material, then use the Generator to ask grounded
              follow-up questions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] hover:brightness-110"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-8">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-base font-semibold">1) Summariser</h3>
              <ol className="mt-3 space-y-2 text-sm text-[var(--muted)] list-decimal ml-5">
                <li>Select an input method (URL, file upload, or raw text).</li>
                <li>Adjust <span className="text-[var(--text)]">Detail</span> to control summary length.</li>
                <li>Adjust <span className="text-[var(--text)]">Temperature</span> for more factual vs. more exploratory phrasing.</li>
                <li>Run the summariser and review the output.</li>
                <li>Optionally copy or download the summary for your notes.</li>
              </ol>
              <p className="mt-4 text-xs text-[var(--muted)]">
                The app stores extracted passages to support follow-up questions in Generator mode. You can clear
                stored passages from the Advanced section.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-base font-semibold">2) Generator</h3>
              <ol className="mt-3 space-y-2 text-sm text-[var(--muted)] list-decimal ml-5">
                <li>Ask a question that the uploaded/summarised material can answer.</li>
                <li>Optional: provide a System Prompt to enforce tone, structure, or citation conventions.</li>
                <li>Adjust Retrieval Depth to widen or narrow the evidence set.</li>
                <li>Generate an answer, then check the listed sources for alignment.</li>
              </ol>
              <p className="mt-4 text-xs text-[var(--muted)]">
                If the stored material does not contain enough evidence, the Generator should state the limitation.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="text-base font-semibold">Use case example (academic paper)</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="text-sm text-[var(--muted)]">
                <div className="font-medium text-[var(--text)]">Goal</div>
                <p className="mt-1">Prepare for a seminar by extracting the paper’s claims, evidence, and limitations.</p>
                <div className="mt-4 font-medium text-[var(--text)]">Workflow</div>
                <ol className="mt-1 space-y-2 list-decimal ml-5">
                  <li>Upload the PDF in the Summariser.</li>
                  <li>Set Detail to ~60–80 for a study-ready summary.</li>
                  <li>Switch to Generator and ask targeted questions (examples shown).</li>
                </ol>
              </div>
              <div className="text-sm">
                <div className="font-medium">Example Generator prompts</div>
                <ul className="mt-2 space-y-2 text-[var(--muted)] list-disc ml-5">
                  <li>"What is the central research question, and what are the main findings?"</li>
                  <li>"List the key assumptions and identify potential threats to validity."</li>
                  <li>"Summarise the method in 8–10 bullet points, then note data limitations."</li>
                  <li>"What are the practical implications, and what would you test next?"</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="text-base font-semibold">Practical tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] list-disc ml-5">
              <li>For factual summaries, keep Temperature low (0.0–0.3).</li>
              <li>When asking questions, specify the output format (bullets, table, short paragraph, etc.).</li>
              <li>If you need a rigorous answer, set a System Prompt that requires explicit citations.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Header({ onOpenHelp }) {
  const location = useLocation()
  const subtitle = useMemo(() => {
    if (location.pathname.startsWith('/generator')) {
      return 'Ask grounded questions using what you have summarised or uploaded.'
    }
    return 'Summarise a URL, document, or text and build a temporary knowledge base.'
  }, [location.pathname])

  return (
    <header className="max-w-5xl mx-auto px-4 pt-10 pb-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs tracking-wider uppercase text-[var(--muted)]">Sea Lion</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Summariser and Generator</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenHelp}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)] hover:brightness-110"
          >
            How to use
          </button>
        </div>
      </div>
    </header>
  )
}

function NavTabs() {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm transition border'
  return (
    <nav className="max-w-5xl mx-auto px-4 pb-6">
      <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
        <NavLink
          to="/summarizer"
          className={({ isActive }) =>
            cx(
              base,
              isActive
                ? 'bg-[var(--card)] border-[var(--border)] text-[var(--text)] shadow'
                : 'bg-transparent border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            )
          }
        >
          Summariser
        </NavLink>
        <NavLink
          to="/generator"
          className={({ isActive }) =>
            cx(
              base,
              isActive
                ? 'bg-[var(--card)] border-[var(--border)] text-[var(--text)] shadow'
                : 'bg-transparent border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            )
          }
        >
          Generator
        </NavLink>
      </div>
    </nav>
  )
}

function Chrome() {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Header onOpenHelp={() => setHelpOpen(true)} />
      <NavTabs />

      <Routes>
        <Route path="/" element={<Navigate to="/summarizer" replace />} />
        <Route path="/summarizer" element={<Summarizer />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="*" element={<Navigate to="/summarizer" replace />} />
      </Routes>

      <footer className="max-w-5xl mx-auto px-4 py-10 text-xs text-[var(--muted)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p>Designed for fast summarisation and evidence-grounded follow-up questions.</p>
          <p>Use Advanced controls to manage stored passages and retrieval behaviour.</p>
        </div>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Chrome />
  </BrowserRouter>
)
