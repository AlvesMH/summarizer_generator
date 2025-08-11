from __future__ import annotations

import os
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form , Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import Optional

from .settings import settings
from .ingest import fetch_url_text, extract_pdf_text, extract_txt_text, chunk_text
from .embeddings import embed_texts
from .vectorstore import add_texts, query
from .mmr import mmr_select
from .sealion import summarize_with_sealion, generate_with_sealion

app = FastAPI(title="Sea Lion Academic Summarizer API", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path.startswith("/api"):
        print(f"[REQ] {request.method} {request.url.path}")
    return await call_next(request)

# ---------- API ----------
class SummarizeBody(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    detail: int = 40
    temperature: float = 0.2

@app.post("/api/summarize")
async def summarize(body: SummarizeBody):
    if not (body.url or body.text):
        return {"error": "Provide 'url' or 'text'."}

    title = body.url or "Uploaded Text"
    text = body.text or ""
    if body.url:
        text, title = fetch_url_text(body.url)

    chunks = chunk_text(text)
    if not chunks:
        return {"title": title, "summary": "No content extracted.", "chunks_used": [], "stats": {"chunks_total": 0, "chunks_used": 0}}

    # embed & RAG-lite
    embs = embed_texts(chunks)
    # Select top-k via MMR (k scales with detail & doc length)
    k = max(4, min(10, 3 + body.detail // 15))
    idxs = mmr_select(embs, k=k)
    selected = [chunks[i] for i in idxs]

    summary = summarize_with_sealion(selected, title, detail=body.detail, temperature=body.temperature)

    # Auto-ingest both the selected source chunks and the final summary
    try:
        metas = [{"source": title, "kind": "source_chunk"} for _ in selected]
        add_texts("knowledge", selected, metas, embedding_fn=embed_texts)
        add_texts("knowledge", [summary], [{"source": title, "kind": "summary"}], embedding_fn=embed_texts)
    except Exception as _:
        pass  # non-blocking

    return {
        "title": title,
        "summary": summary,
        "chunks_used": idxs,
        "stats": {"chunks_total": len(chunks), "chunks_used": len(idxs)}
    }

@app.post("/api/upload")
async def upload(file: UploadFile = File(...), detail: int = Form(40), temperature: float = Form(0.2)):
    data = await file.read()
    if file.filename.lower().endswith(".pdf"):
        text = extract_pdf_text(data)
    else:
        text = extract_txt_text(data)

    chunks = chunk_text(text)
    if not chunks:
        return {"title": file.filename, "summary": "No content extracted.", "chunks_used": [], "stats": {"chunks_total": 0, "chunks_used": 0}}
    embs = embed_texts(chunks)
    k = max(4, min(10, 3 + detail // 15))
    from .mmr import mmr_select
    idxs = mmr_select(embs, k=k)
    selected = [chunks[i] for i in idxs]

    summary = summarize_with_sealion(selected, file.filename, detail=detail, temperature=temperature)

    # Auto-ingest
    try:
        metas = [{"source": file.filename, "kind": "source_chunk"} for _ in selected]
        add_texts("knowledge", selected, metas, embedding_fn=embed_texts)
        add_texts("knowledge", [summary], [{"source": file.filename, "kind": "summary"}], embedding_fn=embed_texts)
    except Exception:
        pass

    return {
        "title": file.filename,
        "summary": summary,
        "chunks_used": idxs,
        "stats": {"chunks_total": len(chunks), "chunks_used": len(idxs)}
    }

# ---------- RAG Generator ----------
class GenerateBody(BaseModel):
    message: str
    system_prompt: Optional[str] = None
    temperature: float = 0.6
    top_k: int = 6

@app.api_route("/api/generate", methods=["POST", "OPTIONS"])
async def generate(body: GenerateBody:
    if not body.message.strip():
        return {"error": "Provide a user message."}

    res = query("knowledge", [body.message], n_results=max(2, min(12, body.top_k)), embedding_fn=embed_texts)
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    ids = res.get("ids", [[]])[0]

    context = "\n\n".join(
        f"[Doc {i} | {(metas[i] or {}).get('source','unknown')} | id={ids[i]}]\n{docs[i]}"
        for i in range(len(docs))
    ) or "(no matching context found)"

    system = (body.system_prompt or
        "You are a precise research assistant. Use the [Doc i] context when relevant. "
        "Cite with [Doc i]. If context is insufficient, say so.")
    user = f"Question:\n{body.message}\n\nContext:\n{context}\n\nWrite a structured answer."

    answer = generate_with_sealion(
        messages=[{"role":"system","content":system},{"role":"user","content":user}],
        temperature=body.temperature
    )
    return {"answer": answer, "matches": [{"id": ids[i], "meta": metas[i]} for i in range(len(docs))]}

from fastapi.routing import APIRoute
print("=== ROUTE MAP ===")
for r in app.routes:
    if isinstance(r, APIRoute):
        print(f"[ROUTE] {r.path}  methods={sorted(r.methods)}")

@app.get("/healthz")
async def healthz():
    return {"ok": True}

# ---------- STATIC SPA (MUST BE LAST) ----------
FRONTEND_DIST = Path(__file__).parent / "frontend_dist"
print(f"[BOOT] FRONTEND_DIST => {FRONTEND_DIST} exists={FRONTEND_DIST.exists()}")

class SmartStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        if resp.status_code == 200:
            ctype = resp.headers.get("content-type", "")
            if "text/html" in ctype:
                resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                resp.headers["Pragma"] = "no-cache"
                resp.headers["Expires"] = "0"
            else:
                resp.headers["Cache-Control"] = "public, max-age=2592000, immutable"
        return resp

if FRONTEND_DIST.exists():
    app.mount("/", SmartStaticFiles(directory=FRONTEND_DIST, html=True), name="static")

    @app.exception_handler(404)
    async def spa_fallback(request, exc):
        if not request.url.path.startswith("/api"):
            index = FRONTEND_DIST / "index.html"
            if index.exists():
                return FileResponse(index)
        raise exc