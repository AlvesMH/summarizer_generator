export const API_BASE = '';

export async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} on ${url}: ${txt}`)
  }
  return res.json()
}

async function uploadFile(file, detail=40, temperature=0.2) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('detail', String(detail))
  fd.append('temperature', String(temperature))
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function postForm(path, formData) {
  const res = await fetch(`${API_BASE}/api/${path}`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
