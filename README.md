# Note RAG System 🧠

A Retrieval-Augmented Generation (RAG) workspace. Ingest source code, unstructured text, PDFs, and slide decks to interface with a local LLM or API provider.

This system runs a dual-embedding pipeline separating standard semantic text from source code using **CodeBERT**. 

---

## 🌟 Architecture & Workflows

### 1. Backend Vector Engine (FastAPI & ChromaDB)
- **Vectorization Pipeline:** Automatically routes documents (`.docx`, `.pdf`, `.pptx`, `.md`) through `BAAI/bge-large-en-v1.5` and code (`.py`, `.c`, `.cpp`, `.js`) through `microsoft/codebert-base`.
- **Background Watchdog Indexing:** When running locally, files added into the `./notes/` folder trigger an OS-level watchdog that automatically chunks, embeds, and indexes them into Chroma DB silently in the background.

### 2. Frontend User Interface (Next.js)
- **Chat Interface:** A messaging dashboard. Responses stream directly from the LLM, and retrieved chunks are rendered beneath the message as expandable sources.
- **Upload Dropzone:** A drag-and-drop UI. Categorizes files instantly and provides visual confirmation of ingestion completion. 
- **Files Manager:** A dashboard that pulls exactly what exists inside the live local index. Displays database size and allows file deletion.
- **Global Index Purge:** Delete the entire active directory with the "Purge DB" button from the `Upload` queue to format the memory in an instant if a conflict occurs. 
- **Local Fine-Tuning Module:** Software that pairs existing database chunks with queries to auto-generate Q&A training datasets to train an LLM locally.

---

## 🔑 LLM Provider Configuration & Models

This ecosystem supports either proprietary high-end Cloud APIs or completely localized hardware accelerated endpoints via Ollama. Navigate to the local `.env` and set your preferred setup.

### Option A: Cloud Provider (OpenAI, Anthropic, Google)
Set the explicit Cloud variables in your `.env` to route to any major provider.
```env
LLM_PROVIDER=cloud
CLOUD_API_KEY=YOUR_PROVIDER_API_KEY
CLOUD_MODEL=gemini-2.5-flash # e.g., gpt-4o, claude-3-5-sonnet-20241022
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

## 🎛️ Local Fine-Tuning Pipeline & Deployment

This workspace features a lightweight MLOps pipeline, allowing you to train local LLMs on your proprietary data using Unsloth QLoRA.

### 1. Synthetic Dataset Generation
The pipeline queries your Chroma DB for raw data chunks and leverages your active LLM to generate highly relevant Q&A pairs (Dataset Synthesis). These pairs are formatted into `finetune_data.jsonl`. This step does not require an advanced GPU.

### 2. LoRA Training (CUDA Required)
The backend executes Python scripts leveraging Unsloth to perform memory-efficient QLoRA fine-tuning. It passes your generated dataset over a quantized base model (e.g., Llama-3-8B), outputting custom LoRA adapter weights.

### 3. How to Deploy Your Fine-Tuned Model
Once the frontend indicates "Training Complete," open a terminal on your host machine to compile and deploy the model to your local Ollama runtime:

1. **Merge the LoRA Adapter** into GGUF format:
   ```bash
   python backend/scripts/merge_and_export.py
   ```
2. **Build the Ollama Model** using the generated Modelfile:
   ```bash
   # Make sure your Docker container or host terminal has Ollama access
   ollama create my-custom-ai -f ./finetuned_model/Modelfile
   ```
3. **Mount the Custom Model** into the RAG engine:
   Open your target `.env` file and instruct the system to use your custom creation:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=my-custom-ai
   ```
   Restart your Docker containers or servers.

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
4. Access the frontend at `http://localhost:3000`. The backend services map internally to `localhost:8000`. 

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
#### 4. Updating Environment Variables (`.env`)
**The Issue:** Changing variables in your `.env` file (like `OLLAMA_MODEL` or switching endpoints) and running `docker compose restart` doesn't seem to apply the changes.
**The Fix:** A standard restart only reboots the container using the initially cached environment state. To force Docker to ingest newly saved `.env` variables, you must run:
`docker compose up -d`

#### 5. Local GPU Acceleration & CUDA Errors
**The Issue:** If you enable the NVIDIA GPU deploy blocks in `docker-compose.yml`, but your backend container crashes on startup or throws a PyTorch `CUDA error: no kernel image is available for execution` during embedding generation.
**The Fix:** 
- Keep the `deploy: resources: reservations: devices: - driver: nvidia` block commented out unless you actually have an active NVIDIA GPU installed on your host.
- For older NVIDIA architectures (like the GTX 10-series Pascal), the main branch of PyTorch has phased out native bindings. Adjust the `backend/Dockerfile` to explicitly pull the `cu118` (CUDA 11.8) distribution of PyTorch before installing other packages!

#### 6. Fine-Tuning Resource Constraints (OOM Errors)
**The Constraint:** The actual LoRA training step of the Fine-tuning pipeline requires an active **NVIDIA GPU** with CUDA installed. 
**The Fix:** 
- You need an absolute minimum of **6GB to 8GB of VRAM** to prevent Out Of Memory (OOM) crashes during training.
- If your training crashes immediately on the frontend, navigate to the `Fine-tune` UI and lower the **Batch Size** to `1` or `2`, which drastically reduces VRAM requirements at the cost of slightly slower training times.
