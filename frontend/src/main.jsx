import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import Summarizer from './pages/Summarizer'        
import Generator from './pages/Generator'   
import './index.css'

function Chrome() {
  return (
    <div className="min-h-screen">
      <nav className="max-w-4xl mx-auto px-4 py-4 flex gap-3 text-sm">
        <Link className="underline" to="/summarizer">Summarizer</Link>
        <Link className="underline" to="/generator">Generator</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/summarizer" replace />} />
        <Route path="/summarizer" element={<Summarizer />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="*" element={<Navigate to="/summarizer" replace />} />
      </Routes>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter><Chrome /></BrowserRouter>
)
