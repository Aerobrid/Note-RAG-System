# ============================================================
#  rag-system — Windows Setup Script (PowerShell)
#  Run: .\setup.ps1
# ============================================================

param(
    [switch]$SkipOllama,
    [switch]$DevMode   # Run without Docker (for development)
)

$ErrorActionPreference = "Stop"


function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    WARN: $msg" -ForegroundColor Yellow }

Write-Host @"

   _____             _____                 _                 
  |  __ \           / ____|               | |                
  | |__) |__ _ __  | (___   __ _ _ __   __| | ___  _ __ ___  
  |  _  // _` '_ \  \___ \ / _` | '_ \ / _` |/ _ \| '__/ _ \ 
  | | \ \ (_| | | | ____) | (_| | | | | (_| | (_) | | |  __/ 
  |_|  \_\__,_| |_| |_____/ \__,_|_| |_|\__,_|\___/|_|  \___| 

 Personal RAG System
"@ -ForegroundColor Magenta

# ── 1. Copy .env ─────────────────────────────────────────────
Write-Step "Setting up environment"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warn ".env created from template. Add your GEMINI_API_KEY before starting."
} else {
    Write-OK ".env already exists"
}

# ── 2. Create notes directory ─────────────────────────────────
Write-Step "Creating notes directory"
New-Item -ItemType Directory -Force -Path "notes" | Out-Null
Write-OK "notes/ ready — drop your lecture files here"

# ── 3. Check Docker ───────────────────────────────────────────
Write-Step "Checking Docker"
try {
    docker --version | Out-Null
    Write-OK "Docker found"
} catch {
    Write-Warn "Docker not found. Install Docker Desktop from https://docker.com"
    Write-Host "    After installing Docker, re-run this script." -ForegroundColor Yellow
    exit 1
}

# ── 4. Check NVIDIA Docker runtime ───────────────────────────
Write-Step "Checking NVIDIA GPU runtime"
try {
    docker run --rm --gpus all nvidia/cuda:12.1-base-ubuntu22.04 nvidia-smi 2>&1 | Out-Null
    Write-OK "NVIDIA GPU accessible in Docker"
} catch {
    Write-Warn "GPU not accessible in Docker. Install NVIDIA Container Toolkit."
    Write-Warn "Guide: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
}

if (-not $DevMode) {
    # ── 5. Docker Compose up ──────────────────────────────────
    Write-Step "Starting services with Docker Compose"
    docker compose up -d --build
    Write-OK "Services starting..."

    # ── 6. Pull Ollama models ────────────────────────────────
    if (-not $SkipOllama) {
        Write-Step "Pulling Ollama models (this takes a few minutes)"
        Write-Host "    Pulling llama3.2:3b (general Q&A)..."
        docker exec rag-system-ollama ollama pull llama3.2:3b
        Write-Host "    Pulling qwen2.5-coder:7b (code understanding)..."
        docker exec rag-system-ollama ollama pull qwen2.5-coder:7b
        Write-OK "Models ready"
    }

    Write-Host @"

  ✓ rag-system is running!

    Frontend : http://localhost:3000
    Backend  : http://localhost:8000
    API Docs : http://localhost:8000/docs

  Next steps:
    1. Open http://localhost:3000/upload and upload your lecture notes
    2. Or drop files into ./notes/ — they auto-index
    3. Go to http://localhost:3000/chat and start using your RAG system!
    4. Edit .env to add your GEMINI_API_KEY (or use Ollama offline)

  Useful commands:
    docker compose logs -f backend    # Watch backend logs
    docker compose restart backend    # Restart after .env changes
    docker compose down               # Stop everything

"@ -ForegroundColor Green

} else {
    # ── Dev Mode: run without Docker ─────────────────────────
    Write-Step "Dev mode: setting up Python environment"

    if (-not (Test-Path "backend\.venv")) {
        python -m venv backend\.venv
        Write-OK "Virtual environment created"
    }

    & backend\.venv\Scripts\Activate.ps1
    pip install -r backend\requirements.txt -q
    Write-OK "Python dependencies installed"

    Write-Step "Installing frontend dependencies"
    Set-Location frontend
    npm install
    Set-Location ..
    Write-OK "Node dependencies installed"

    Write-Host @"

  Dev mode ready!

  Terminal 1 (backend):
    cd backend && .\.venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --port 8000

  Terminal 2 (frontend):
    cd frontend && npm run dev

  Terminal 3 (Ollama, optional):
    ollama serve
    ollama pull llama3.2:3b

"@ -ForegroundColor Green
}
