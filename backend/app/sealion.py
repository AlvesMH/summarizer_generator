from __future__ import annotations

from typing import List
import requests
from fastapi import HTTPException
from .settings import settings


def _chat_completions_url() -> str:
    """
    Accepts either:
      - https://api.sea-lion.ai/v1
      - https://api.sea-lion.ai/v1/chat/completions
    and returns a valid chat-completions URL.
    """
    base = (settings.SEA_LION_BASE_URL or "").strip()
    if not base:
        base = "https://api.sea-lion.ai/v1"
    base = base.rstrip("/")

    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return f"{base}/chat/completions"

    # If someone set "https://api.sea-lion.ai" by mistake, still try to do something sensible.
    if base.endswith("api.sea-lion.ai"):
        return f"{base}/v1/chat/completions"

    # Last resort: assume it's a base and append.
    return f"{base}/chat/completions"


def _auth_header() -> dict:
    key = (settings.SEA_LION_API_KEY or "").strip()
    if not key:
        # This is server misconfiguration, not user input error.
        raise HTTPException(
            status_code=500,
            detail="SEA_LION_API_KEY is not configured on the server (Render env var missing/empty).",
        )
    return {"Authorization": f"Bearer {key}"}


def summarize_with_sealion(
    chunks: List[str],
    title: str,
    detail: int,
    temperature: float = 0.2,
) -> str:
    content = "\n\n".join(f"[Chunk {i}]\n{c}" for i, c in enumerate(chunks))
    target_len = max(150, int(6 * detail))

    system = {
        "role": "system",
        "content": (
            "You are an expert academic writing assistant. Write rigorous, faithful summaries with clear "
            "section headers (Background, Methods, Results, Limitations, Key Takeaways). "
            "Cite chunk numbers like [Chunk 2] when attributing specific claims."
        ),
    }
    user = {
        "role": "user",
        "content": (
            f"Title: {title}\n\n"
            f"Please write an academic summary (~{target_len}–{target_len+200} words) of the article using ONLY "
            f"the evidence in the provided chunks. If evidence is insufficient, clearly state the gap.\n\n{content}"
        ),
    }

    url = _chat_completions_url()
    headers = {
        **_auth_header(),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model": settings.DEFAULT_SEALION_MODEL,
        "messages": [system, user],
        "temperature": float(temperature),
        "top_p": 0.95,
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=120)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"SEA-LION network error: {e}")

    if r.status_code == 401:
        raise HTTPException(
            status_code=502,
            detail="SEA-LION authentication failed (invalid API key). Check SEA_LION_API_KEY on Render.",
        )
    if r.status_code == 429:
        raise HTTPException(status_code=503, detail="SEA-LION rate limit reached. Try again shortly.")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"SEA-LION upstream error ({r.status_code}): {r.text[:300]}")

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except Exception:
        return data.get("text", "") or str(data)


def generate_with_sealion(
    messages: list[dict[str, str]],
    temperature: float = 0.6,
    top_p: float = 0.95,
) -> str:
    url = _chat_completions_url()
    headers = {
        **_auth_header(),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model": settings.DEFAULT_SEALION_MODEL,
        "messages": messages,
        "temperature": float(temperature),
        "top_p": float(top_p),
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=120)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"SEA-LION network error: {e}")

    if r.status_code == 401:
        raise HTTPException(
            status_code=502,
            detail="SEA-LION authentication failed (invalid API key). Check SEA_LION_API_KEY on Render.",
        )
    if r.status_code == 429:
        raise HTTPException(status_code=503, detail="SEA-LION rate limit reached. Try again shortly.")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"SEA-LION upstream error ({r.status_code}): {r.text[:300]}")

    data = r.json()
    choice = (data.get("choices") or [{}])[0]
    msg = (choice.get("message") or {}).get("content")
    if msg:
        return msg
    if "text" in data:
        return data["text"]
    return str(data)
