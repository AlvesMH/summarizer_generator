from __future__ import annotations
from typing import Tuple, List

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader
import io
import re

from urllib.parse import urlparse, unquote, quote


def _default_headers() -> dict:
    """Headers that reduce the chance of 403s from common sites.

    Some hosts (notably Wikipedia/Wikimedia) may block requests with no/odd
    User-Agent. We use a clear UA + standard Accept headers.
    """

    return {
        "User-Agent": "SummarizerGenerator/1.0 (+https://summarizer-generator.onrender.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }


def _is_wikipedia(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.netloc.endswith("wikipedia.org")
    except Exception:
        return False


def _wikipedia_title_from_url(url: str) -> str | None:
    p = urlparse(url)
    if not p.path.startswith("/wiki/"):
        return None
    title = p.path.split("/wiki/", 1)[1]
    if not title:
        return None
    title = title.split("#", 1)[0]
    return unquote(title)


def _fetch_wikipedia_via_rest_api(url: str, timeout: int = 60) -> Tuple[str, str]:
    """Fetch Wikipedia content via REST API (more reliable than scraping).

    We prefer /page/html (full article HTML) and fall back to /page/summary.
    """

    p = urlparse(url)
    title = _wikipedia_title_from_url(url) or url
    safe_title = quote(title, safe="")

    # 1) Full HTML
    html_url = f"{p.scheme}://{p.netloc}/api/rest_v1/page/html/{safe_title}"
    r = requests.get(html_url, headers=_default_headers(), timeout=timeout)
    if r.ok and r.text:
        soup = BeautifulSoup(r.text, "html.parser")
        parts = [x.get_text(" ", strip=True) for x in soup.find_all("p")]
        text = remove_citations("\n\n".join([t for t in parts if t]))
        if len(text.strip()) >= 200:
            return text, title

    # 2) Summary JSON
    summary_url = f"{p.scheme}://{p.netloc}/api/rest_v1/page/summary/{safe_title}"
    r2 = requests.get(
        summary_url,
        headers={**_default_headers(), "Accept": "application/json"},
        timeout=timeout,
    )
    if r2.ok:
        try:
            data = r2.json()
            extract = (data or {}).get("extract") or ""
            if extract.strip():
                return remove_citations(extract.strip()), title
        except Exception:
            pass

    # If we got here, propagate a helpful error
    r.raise_for_status()
    return "", title

def fetch_url_text(url: str) -> Tuple[str, str]:
    # Use a session for connection reuse and add a UA to reduce 403 blocks.
    session = requests.Session()
    r = session.get(url, headers=_default_headers(), timeout=60, allow_redirects=True)

    # Wikipedia often blocks non-UA requests; additionally, some environments
    # (incl. certain cloud hosts) get 403 without using their REST endpoints.
    if r.status_code in (403, 429) and _is_wikipedia(url):
        return _fetch_wikipedia_via_rest_api(url, timeout=60)

    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else url
    parts = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    text = remove_citations("\n\n".join(parts))
    return text, title

def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for p in reader.pages:
        pages.append(p.extract_text() or "")
    text = "\n\n".join(pages)
    return remove_citations(text)

def extract_txt_text(file_bytes: bytes) -> str:
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1", errors="ignore")
    return remove_citations(text)

def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    chunks = []
    i = 0
    while i < len(text):
        chunk = text[i:i+chunk_size]
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if c]

def remove_citations(text: str) -> str:
    # strip [1], (Smith, 2020), etc.
    text = re.sub(r"\[[^\]]*\]", "", text)
    text = re.sub(r"\([^\)]*\)\s*", lambda m: "" if len(m.group(0)) <= 40 else m.group(0), text)
    return text
