import os, uuid, chromadb
from typing import Sequence, Optional
from chromadb.config import Settings

CHROMA_DIR = os.environ.get("CHROMA_DB_DIR", "").strip()  # empty => ephemeral

if CHROMA_DIR:
    client = chromadb.Client(Settings(
        is_persistent=True,
        persist_directory=CHROMA_DIR,
        anonymized_telemetry=False,
    ))
else:
    client = chromadb.Client(Settings(
        anonymized_telemetry=False,  # do NOT pass persist_directory here
    ))

def get_collection(name: str):
    return client.get_or_create_collection(name=name)

def add_texts(collection: str, texts: Sequence[str], metadatas: Optional[Sequence[dict]] = None, embedding_fn=None):
    ids = [str(uuid.uuid4()) for _ in texts]
    embs = embedding_fn(list(texts)) if embedding_fn else None
    get_collection(collection).upsert(ids=ids, documents=list(texts),
                                      metadatas=list(metadatas) if metadatas else None,
                                      embeddings=embs)
    return ids

def query(collection: str, queries: Sequence[str], n_results: int = 5, embedding_fn=None):
    col = get_collection(collection)
    if embedding_fn:
        q_emb = embedding_fn(list(queries))
        return col.query(query_embeddings=q_emb, n_results=n_results,
                         include=["documents", "metadatas", "distances", "embeddings"])
    return col.query(query_texts=list(queries), n_results=n_results,
                     include=["documents", "metadatas", "distances", "embeddings"])

# --- Admin helpers ---

def list_collections_summary():
    """Return [{'name': str, 'count': int}, ...] for all collections."""
    cols = []
    for c in client.list_collections():
        try:
            cnt = c.count()
        except Exception:
            cnt = None
        cols.append({"name": c.name, "count": cnt})
    return cols

def delete_by_source(collection: str, source: str):
    """Delete all docs where metadata.source==source or metadata.doc_title==source."""
    col = get_collection(collection)
    before = col.count()
    # Run two filters to avoid depending on $or semantics
    col.delete(where={"source": source})
    col.delete(where={"doc_title": source})
    after = col.count()
    return {"deleted": max(0, before - after), "count_after": after}

def delete_all(collection: str):
    col = get_collection(collection)
    before = col.count()
    col.delete(where={})
    after = col.count()
    return {"deleted": max(0, before - after), "count_after": after}

