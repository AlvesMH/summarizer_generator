# backend/app/vectorstore.py

from __future__ import annotations
from typing import Sequence, Optional
import os
import uuid

import chromadb
from chromadb.config import Settings

CHROMA_DIR = os.environ.get("CHROMA_DB_DIR", "").strip()  # empty string => ephemeral

if CHROMA_DIR:
    _client = chromadb.Client(
        Settings(
            is_persistent=True,
            persist_directory=CHROMA_DIR,
            anonymized_telemetry=False,
        )
    )
else:
    # Ephemeral, in-memory client (Render Free friendly)
    _client = chromadb.Client(
        Settings(
            anonymized_telemetry=False,
            # NOTE: don't pass persist_directory at all
        )
    )

def get_collection(name: str):
    return _client.get_or_create_collection(name=name)

def add_texts(collection: str, texts: Sequence[str], metadatas: Optional[Sequence[dict]] = None, embedding_fn=None):
    col = get_collection(collection)
    ids = [str(uuid.uuid4()) for _ in texts]
    embeddings = embedding_fn(list(texts)) if embedding_fn else None
    col.upsert(ids=ids, documents=list(texts), metadatas=list(metadatas) if metadatas else None, embeddings=embeddings)
    return ids

def query(collection: str, queries: Sequence[str], n_results: int = 5, embedding_fn=None):
    col = get_collection(collection)
    if embedding_fn:
        q_emb = embedding_fn(list(queries))
        return col.query(query_embeddings=q_emb, n_results=n_results, include=["documents", "metadatas", "distances", "embeddings", "ids"])
    return col.query(query_texts=list(queries), n_results=n_results, include=["documents", "metadatas", "distances", "embeddings", "ids"])
