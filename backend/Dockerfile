FROM python:3.11-slim

WORKDIR /app

# System dependencies for chromadb and pdfplumber
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --prefer-binary -r requirements.txt

COPY . .

RUN mkdir -p /app/notes /app/chroma_db /app/finetuned_model

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
