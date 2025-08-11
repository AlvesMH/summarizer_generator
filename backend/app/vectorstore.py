from __future__ import annotations
from typing import List, Dict, Any
import chromadb
from chromadb.config import Settings as ChromaSettings
from .settings import settings

def get_client():
    if settings.CHROMA_DB_DIR:  # persistent mode (when you actually mount a disk)
        return chromadb.Client(ChromaSettings(persist_directory=settings.CHROMA_DB_DIR))
    # stateless, in-memory
    return chromadb.EphemeralClient()

def get_collection(name: str):
    client = get_client()
    return client.get_or_create_collection(name=name, metadata={"hnsw:space":"cosine"})

def add_texts(collection_name, texts, metadatas=None, ids=None, embedding_fn=None):
    col = get_collection(collection_name)
    if embedding_fn is None:
        raise ValueError("embedding_fn is required")
    embs = embedding_fn(texts)
    if ids is None:
        import uuid
        ids = [f"{collection_name}-{uuid.uuid4().hex}" for _ in texts]
    col.add(documents=texts, metadatas=metadatas, embeddings=embs, ids=ids)
    # do NOT persist for EphemeralClient
    return ids
