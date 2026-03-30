#!/usr/bin/env bash
# ============================================================
#  RAG System — Linux/Mac Setup Script
#  Usage: bash setup.sh [--dev]
# ============================================================
set -e

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${CYAN}>>> $1${NC}"; }
ok()   { echo -e "${GREEN}    OK: $1${NC}"; }
warn() { echo -e "${YELLOW}    WARN: $1${NC}"; }

DEV=false
[[ "$1" == "--dev" ]] && DEV=true

echo -e "${GREEN}
  ____       _           _             __  __ _           _
 / ___|  ___| |__   ___ | | __ _ _ __|  \/  (_)_ __   __| |
 \\___ \\ / __| '_ \\ / _ \\| |/ _\` | '__| |\\/| | | '_ \\ / _\` |
  ___) | (__| | | | (_) | | (_| | |  | |  | | | | | | (_| |
 |____/ \\___|_| |_|\\___/|_|\\__,_|_|  |_|  |_|_|_| |_|\\__,_|

 Personal RAG Knowledge Engine
${NC}"

step "Setting up environment"
[ ! -f .env ] && cp .env.example .env && warn ".env created. Add your GEMINI_API_KEY."
ok ".env ready"

step "Creating notes directory"
mkdir -p notes
ok "notes/ ready"

if [ "$DEV" = false ]; then
    step "Checking Docker"
    docker --version >/dev/null 2>&1 || { warn "Docker not found. Install from https://docker.com"; exit 1; }
    ok "Docker found"

    step "Starting services"
    docker compose up -d --build
    ok "Services starting..."

    step "Pulling Ollama models"
    sleep 5
    docker exec rag-system-ollama ollama pull llama3.2:3b
    docker exec rag-system-ollama ollama pull qwen2.5-coder:7b
    ok "Models ready"

    echo -e "${GREEN}
  ✓ RAG System is running!
    Frontend : http://localhost:3000
    API Docs : http://localhost:8000/docs
${NC}"
else
    step "Dev mode setup"
    python3 -m venv backend/.venv
    source backend/.venv/bin/activate
    pip install -r backend/requirements.txt -q
    ok "Python deps installed"
    cd frontend && npm install && cd ..
    ok "Node deps installed"
    echo -e "${GREEN}
  Run backend : cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
  Run frontend: cd frontend && npm run dev
${NC}"
fi
