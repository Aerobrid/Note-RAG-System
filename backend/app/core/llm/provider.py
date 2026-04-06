"""
LLM Provider - single interface for Cloud APIs and Ollama.
Switch with LLM_PROVIDER=cloud|ollama in .env. No code changes needed.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import AsyncIterator

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.outputs import ChatGeneration
from langchain.chat_models import init_chat_model
from langchain_ollama import ChatOllama

from app.core.config import get_settings


def get_llm(for_code: bool = False) -> BaseChatModel:
    """Return the configured LLM. Set for_code=True to use the code-specialist model."""
    settings = get_settings()

    if settings.llm_provider == "cloud":
        model_name = settings.cloud_model
        
        # Temporarily inject generalized API key into standard env vars so init_chat_model routes perfectly
        key = settings.cloud_api_key
        provider_name = None
        
        if "gpt" in model_name or "o1" in model_name:
            os.environ["OPENAI_API_KEY"] = key
            provider_name = "openai"
        elif "claude" in model_name:
            os.environ["ANTHROPIC_API_KEY"] = key
            provider_name = "anthropic"
        else:
            # Fallback wrapper for Google Gemini
            os.environ["GOOGLE_API_KEY"] = key
            provider_name = "google-genai"
            if "gemini" in model_name and not model_name.startswith("models/"):
                 model_name = f"models/{model_name}"

        return init_chat_model(
            model=model_name,
            model_provider=provider_name,
            temperature=0.1,
            streaming=True
        )

    elif settings.llm_provider == "ollama":
        model = settings.ollama_code_model if for_code else settings.ollama_model
        return ChatOllama(
            model=model,
            base_url=settings.ollama_base_url,
            temperature=0.1,
            streaming=True,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}. Use 'cloud' or 'ollama'.")


def build_messages(
    system_prompt: str,
    user_query: str,
    history: list[dict] | None = None,
    context: str = "",
) -> list[BaseMessage]:
    """Build a standard messages list for any LLM call."""
    messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]

    if history:
        for turn in history:
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            else:
                messages.append(AIMessage(content=turn["content"]))

    user_content = user_query
    if context:
        user_content = f"Context from your notes:\n\n{context}\n\n---\nQuestion: {user_query}"

    messages.append(HumanMessage(content=user_content))
    return messages
