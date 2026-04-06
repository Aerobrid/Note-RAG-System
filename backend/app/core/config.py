from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM
    llm_provider: str = "gemini"          # "gemini" | "ollama"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    google_api_version: str = "v1"       # "v1" or "v1beta"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_code_model: str = "qwen2.5-coder:7b"

    # Storage
    chroma_path: str = "./chroma_db"
    notes_dir: str = "./notes"

    # Embeddings & Reranking
    embed_model: str = "BAAI/bge-large-en-v1.5"
    code_embed_model: str = "microsoft/codebert-base"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Fine-tuning
    finetune_base_model: str = "unsloth/llama-3.2-3B-Instruct-bnb-4bit"
    finetune_output_dir: str = "./finetuned_model"
    finetune_epochs: int = 3
    finetune_batch_size: int = 4

    # Server (comma-separated; include 127.0.0.1 if you open the UI that way)
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
