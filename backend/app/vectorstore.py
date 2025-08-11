# backend/app/vectorstore.py
from __future__ import annotations
from typing import List, Sequence, Optional
import os
import uuid

import chromadb
from chromadb.config import Settings

# Single, in-memory client (ephemeral on Render Free)
# If you later add persistence, point CHROMA_DB_DIR to a writable disk
CHROMA_DIR = os.environ.get("CHROMA_DB_DIR", "").strip() or None

_client = chromadb.Client(
    Settings(
        is_persistent=bool(CHROMA_DIR),
        persist_directory=CHROMA_DIR or None,
        anonymized_telemetry=False,
    )
)

def get_collection(name: str):
    """Get or create a collection by name."""
    return _client.get_or_create_collection(name=name)

def add_texts(
    collection: str,
    texts: Sequence[str],
    metadatas: Optional[Sequence[dict]] = None,
    embedding_fn=None,
):
    """Upsert texts with generated UUIDs and provided metadata."""
    col = get_collection(collection)
    ids = [str(uuid.uuid4()) for _ in texts]

    embeddings = None
    if embedding_fn is not None:
        embeddings = embedding_fn(list(texts))

    col.upsert(
        ids=ids,
        documents=list(texts),
        metadatas=list(metadatas) if metadatas else None,
        embeddings=embeddings,
    )
    return ids

def query(
    collection: str,
    queries: Sequence[str],
    n_results: int = 5,
    embedding_fn=None,
):
    """Query by text (uses embeddings if provided). Returns Chroma .query() dict."""
    col = get_collection(collection)

    # If you have an embedding function, precompute to avoid server-side model
    if embedding_fn is not None:
        q_emb = embedding_fn(list(queries))
        return col.query(
            query_embeddings=q_emb,
            n_results=n_results,
            include=["documents", "metadatas", "distances", "embeddings", "ids"],
        )
    else:
        return col.query(
            query_texts=list(queries),
            n_results=n_results,
            include=["documents", "metadatas", "distances", "embeddings", "ids"],
        )
