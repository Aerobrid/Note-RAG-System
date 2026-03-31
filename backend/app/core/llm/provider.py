"""
LLM Provider - single interface for Gemini API and Ollama.
Switch with LLM_PROVIDER=gemini|ollama in .env. No code changes needed.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import AsyncIterator

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.outputs import ChatGeneration
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama

from app.core.config import get_settings


def get_llm(for_code: bool = False) -> BaseChatModel:
    """Return the configured LLM. Set for_code=True to use the code-specialist model."""
    settings = get_settings()

    if settings.llm_provider == "gemini":
        model_name = settings.gemini_model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"

        # We rely on the GOOGLE_API_VERSION environment variable 
        # (set in docker-compose.yml or .env) to control v1 vs v1beta.
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.gemini_api_key,
            temperature=0.1,
            streaming=True,
            convert_system_message_to_human=True,
        )

    elif settings.llm_provider == "ollama":
        model = settings.ollama_code_model if for_code else settings.ollama_model
        return ChatOllama(
            model=model,
            base_url=settings.ollama_base_url,
            temperature=0.1,
            streaming=True,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}. Use 'gemini' or 'ollama'.")


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
