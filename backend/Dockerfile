FROM python:3.11-slim

WORKDIR /app

# System dependencies for chromadb and pdfplumber (minimal set)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY requirements.txt ./

# Install PyTorch with CUDA 11.8 support for GPU acceleration (~4 GB for docker image)
RUN pip install --no-cache-dir -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install other dependencies with aggressive caching
RUN pip install --no-cache-dir -q --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -q --prefer-binary -r requirements.txt

COPY . .

RUN mkdir -p /app/notes /app/chroma_db /app/finetuned_model

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
