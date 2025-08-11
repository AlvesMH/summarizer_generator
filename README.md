# 📚 Summarizer & Generator App

An AI-powered web app to **summarize documents, URLs, and uploaded text** – and to **generate structured answers** using a Retrieval-Augmented Generation (RAG) workflow.

The backend is built with **FastAPI**, the frontend with **React + Vite**, and the vector search layer uses **ChromaDB** for in-memory embeddings (ephemeral on Render Free tier).

---




---

## 💡How to Use the App

### Summarizer
Paste a URL (article, blog post, academic paper link) or upload a PDF/TXT.

Choose:

Detail → higher number = longer, more detailed summary

Temperature → lower for factual, higher for creative summaries

Click Summarize.

View your summary; source chunks are stored for later questions.

### Generator (RAG mode)
Switch to the Generator tab.

Ask a question related to something you just summarized/uploaded.

The app searches your stored chunks for relevant context.

Answer includes citations like [Doc 1] that map to chunks in memory.

---

## ✨ Features

- **Summarizer**
  - Paste a URL, upload a PDF/TXT, or enter raw text
  - Choose level of detail and temperature
  - Extracts and embeds content, then produces a concise summary
  - Auto-stores both source chunks and summaries in a temporary vectorstore

- **RAG Generator**
  - Ask follow-up questions that reference stored knowledge
  - Answers are grounded in matching documents (cited as `[Doc i]`)
  - If no relevant context is found, it tells you

- **User Interface**
  - Dark mode with neon green accent
  - Mobile-friendly
  - File upload & text input
  - Two tabs: Summarizer and Generator

---

## 🖥 Local Development

### 1. Clone & install
```bash
git clone https://github.com/<your-repo>.git
cd summarizer-generator
```

### 2. Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
```

### 4. Environment variables
Create a .env file in backend/ with:
```bash 
SEA_LION_API_KEY=your-sealion-api-key
HUGGINGFACE_API_TOKEN=your-hf-token
```

### 5. Run in dev mode
Backend:
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:
```bash
cd frontend
npm run dev
```

Frontend runs at http://localhost:5173 and proxies API calls to the backend.


### 🔧 Tech Stack
Frontend: React 18, Vite, TailwindCSS

Backend: FastAPI, Uvicorn

Vector Search: ChromaDB

LLMs: Sea Lion models via API, HuggingFace embeddings

Deployment: Render (Free Tier)

### 📜 License
MIT License — see LICENSE file.