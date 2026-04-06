# Note RAG System 🧠

An intelligent, multi-modal Retrieval-Augmented Generation (RAG) workspace. Specifically engineered to ingest raw source codebases, unstructured text, PDFs, and slide decks instantly, allowing you to interface with a locally accelerated LLM or cloud provider.

This software runs a Dual-Embedding dynamic routing pipeline that intelligently separates standard semantic text vectors from highly granular source code vectors using **CodeBERT**. 

---

## 🌟 Architecture & Workflows

### 1. Backend Vector Engine (FastAPI & ChromaDB)
- **Dual-Model Vectorization Pipeline:** Automatically routes standard documents (`.docx`, `.pdf`, `.pptx`, `.md`) through `BAAI/bge-large-en-v1.5` arrays and code formats (`.py`, `.c`, `.cpp`, `.js`, etc.) through `microsoft/codebert-base`.
- **Background Watchdog Indexing:** If deploying bare-metal or interacting via shell, any file dragged into the `./notes/` folder triggers an OS-level watchdog that automatically chunks, embeds, and indexes it into Chroma DB silently in the background.

### 2. Intelligent Frontend Hub (Next.js)
- **Chat Interface:** A snappy, minimalist messaging dashboard. Responses stream token-by-token directly from the LLM, and successfully retrieved chunks are dynamically rendered beneath the chatbot's message as expandable "Resource Sources". Built with `React.memo` to retain zero-lag UX during heavy text-bites.
- **Upload Dropzone:** A smart drag-and-drop UI. Upon dropping a file, it categorizes it instantly, displays native coding logos for various programming scripts, and provides visual confirmation of ingestion completion. 
- **Workspace File Manager:** A dashboard that pulls exactly what exists inside the live local index. Displays document sizes and allows you to surgically strike down/delete individual files from both local storage and the Chroma Vector DB without needing to rebuild schemas.
- **Global Index Purge:** Granular control allowing you to securely hit the "Purge DB" button from the `Upload` queue to totally format the memory schemas in an instant if a conflict occurs. 
- **Local Fine-Tuning Module:** Extractor logic that pairs existing database chunks with queries to auto-generate synthetic training datasets if you intend to PEFT/LoRA fine-tune your own underlying weights!

---

## 🔑 LLM Provider Configuration & Models

This ecosystem supports either proprietary high-end Cloud APIs or completely localized hardware accelerated endpoints via Ollama. Navigate to the local `.env` and set your preferred setup.

### Option A: Gemini (Cloud Default)
Set the specific LLM variables in your `.env`.
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-2.5-flash # or gemini-exp
```

### Option B: Ollama (100% Local & Private)
If you do not want your chunks leaving your hardware, you can hook the engine strictly to your local Ollama port. Ensure you have Ollama running on your host machine.
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434  # Reaches the host from inside the Docker container
OLLAMA_MODEL=deepseek-r1    # e.g., llama3:8b, mistral, phi3
```
*Note: Make sure to `ollama run <model>` first on your host machine to ensure it's successfully downloaded before querying the RAG.*

---

## 🔌 API Endpoints Reference

The backend operates over localized REST paths at `http://localhost:8000`. You can interact with these endpoints directly if you wish to bypass the web app.

### Data & Indexing Operations (`/api/ingest`)
- `POST /api/ingest/upload`: Multi-multipart Form endpoint. Uploads files, chunks them, triggers dual-model embeddings, and stores them in Chroma asynchronous queues.
- `GET /api/ingest/files`: Interrogates the active local disk to retrieve a JSON list of all presently active mapped files (powers the File Manager view).
- `GET /api/ingest/stats`: Returns health stats mapping the total volume size of "Document Vectors" vs "Code Vectors".
- `DELETE /api/ingest/delete/{filename}`: Safe-delete mechanism. Supply a filename and the API dynamically filters the database, un-indexes all attached chunks, and deletes the host document.
- `DELETE /api/ingest/clear`: Aggressive format feature. Fully drops the SQLite Chroma schema tables and loops deletion across the system's `notes/` folder.

### Query & Agentic Operations
- `POST /api/chat`: Connects stream routing between the VectorDB context injections and your defined `.env` LLM model. Supports SSE stream mapping.
- `GET /api/search?q=XYZ`: Core retrieval test. Returns raw chunk contexts closest to the mathematical K-neighbors of your string without sending it to an LLM. 
- `GET /api/health`: Provides JSON mapping of LLM Provider status, Ollama reachability, and backend heartbeat.

### Synthetic Fine-Tuning
- `POST /api/finetune/generate-dataset`: Extracts top vectorized clusters and initiates dataset pairing for LoRA targets.
- `POST /api/finetune/train`: Trigger route to initiate localized training scripts.

---

## 🚀 Getting Started

You have two primary options: completely isolated via **Docker** (recommended) or deployed directly to your operating system via **Venv**. 

### Approach A: Docker Environment (Recommended)
This runs the UI, backend server, and transient DB safely packed inside isolated docker networks. 
1. Make sure you have Docker Desktop installed.
2. In the root directory, create your `.env` file (copy `.env.sample`).
3. Run the following command:
```bash
docker compose up -d --build
```
4. Access the gorgeous frontend at `http://localhost:3000`. The backend services map internally to `localhost:8000`. 

### Approach B: Bare-Metal Local Python Venv
If you are developing components or prefer avoiding Docker volume virtualization:

1. **Terminal 1 (Backend):**
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```
2. **Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🎯 Primary Use-Cases
1. **Codebase Auditing:** Upload an entire messy legacy repository (`.c`, `.cpp`, `.py`) structure. Jump into the Chat UI and ask the agent to dynamically trace memory leaks or explain header routing logic across five different files simultaneously!
2. **Academic Research:** Highlight and drop heavy `.pdf` and `.docx` study materials straight into the vector pool, extracting isolated cited answers.
3. **Knowledge Retention:** Keep an ambient database of your Daily Notes (`.md`) dynamically indexing your journal. You can query the assistant to summarize past weeks effortlessly.

---

## 🛠️ Troubleshooting & Known Issues

#### 1. Files Not Auto-Indexing via Direct Folder Paste
**The Issue:** On Windows machines running Docker Desktop, occasionally if you manually cut and paste a file straight into the OS-folder mapped `/notes/`, the Python `watchdog` inside the container does not pick up the event mapping bridge.
**The Fix:** 
- The safest and guaranteed bypass is to bypass OS folders and upload files straight through the **Upload UI Dropzone** inside the application. 
- Alternatively, if testing directly in folders, always *copy and paste* the source file into the directory rather than *cutting* it, as cut/moves sever the temporary file bindings.

#### 2. Vector DB Schema Mismatches
**The Issue:** If you change an embedding model environment variable (e.g. from `BGE-Large` to a different model shape), Chroma DB will crash on startup complaining that the mathematical dimensions map incorrectly between old saved files and the new model configurations. 
**The Fix:** Navigate to the **Upload Page** in the frontend and strike the red **Purge Database** button. This securely drops the old index tensors.

#### 3. Deepseek "Thinking" Tags Rendering Erratically 
**The Issue:** Deepseek-R1 (`ollama`) pushes highly complex `<think>` block structures inside SSE streams which could leak formatting into the UI.
**The Fix:** The RAG Markdown parser on the web dashboard naturally filters `<think>` XML branches dynamically! No specific action is required, as the model handles parsing visually.
