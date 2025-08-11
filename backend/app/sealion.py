from __future__ import annotations
from typing import List, Dict, Optional
import requests
from .settings import settings

def summarize_with_sealion(chunks: List[str], title: str, detail: int, temperature: float = 0.2) -> str:
    """Call Sea Lion chat/completions API (OpenAI-compatible) to synthesize a summary."""
    content = "\n\n".join(f"[Chunk {i}]\n{c}" for i, c in enumerate(chunks))
    target_len = max(150, int(6 * detail))  # rough heuristic
    system = {
        "role": "system",
        "content": "You are an expert academic writing assistant. Write rigorous, faithful summaries with clear section headers (Background, Methods, Results, Limitations, Key Takeaways). Cite chunk numbers like [Chunk 2] when attributing specific claims."
    }
    user = {
        "role": "user",
        "content": f"Title: {title}\n\nPlease write an academic summary (~{target_len}–{target_len+200} words) of the article using ONLY the evidence in the provided chunks. If evidence is insufficient, clearly state the gap.\n\n{content}"
    }
    headers = {
        "Authorization": f"Bearer {settings.SEA_LION_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.DEFAULT_SEALION_MODEL,
        "messages": [system, user],
        "temperature": temperature,
        "top_p": 0.95
    }
    r = requests.post(settings.SEA_LION_BASE_URL, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    # Try OpenAI-style choices[0].message.content
    try:
        return data["choices"][0]["message"]["content"]
    except Exception:
        # fallback: some providers might return a 'text' field
        return data.get("text", "")
    
def generate_with_sealion(messages: list[dict[str, str]], temperature: float = 0.6, top_p: float = 0.95) -> str:
    """Generic chat/generation call (OpenAI-compatible)."""
    url = settings.SEA_LION_BASE_URL  # e.g., "https://api.sealion.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.SEA_LION_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.DEFAULT_SEALION_MODEL,
        "messages": messages,
        "temperature": temperature,
        "top_p": top_p,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()

    # OpenAI-style response
    choice = (data.get("choices") or [{}])[0]
    msg = (choice.get("message") or {}).get("content")
    if msg:
        return msg

    # Some providers return a 'text' field instead
    if "text" in data:
        return data["text"]

    # Last resort
    return str(data)   
