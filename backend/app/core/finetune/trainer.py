"""
Fine-tuning Trainer - Unsloth + QLoRA on your personalized Q&A dataset.
Requires: pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
          pip install trl transformers datasets accelerate bitsandbytes

This module runs on your NVIDIA GPU (Windows 11 + CUDA) and produces a LoRA adapter
you can merge and run locally via Ollama.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

import torch

from unsloth import FastLanguageModel
from datasets import Dataset
from trl import SFTTrainer
from transformers import TrainingArguments

def _check_gpu():
    """Verify CUDA is available before attempting fine-tuning."""
    try:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU not detected. Fine-tuning requires an NVIDIA GPU.")
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        return {"gpu": gpu_name, "vram_gb": round(vram_gb, 1)}
    except ImportError:
        raise RuntimeError("PyTorch not installed. Run: pip install torch --index-url https://download.pytorch.org/whl/cu121")


def run_finetune(
    dataset_path: str,
    output_dir: str,
    base_model: str = "unsloth/llama-3.2-3B-Instruct-bnb-4bit",
    epochs: int = 3,
    batch_size: int = 4,
    lora_r: int = 16,
    lora_alpha: int = 32,
    max_seq_length: int = 2048,
    progress_callback: Callable[[str, int], None] | None = None,
) -> dict:
    """
    Full LoRA fine-tuning pipeline using Unsloth (2x faster than standard HF training).

    Args:
        dataset_path   : Path to JSONL file with {"instruction", "input", "output"} records
        output_dir     : Where to save the LoRA adapter weights
        base_model     : Unsloth quantized model (4-bit, fits in 8GB VRAM)
        epochs         : Training epochs (3 is a good default)
        batch_size     : Per-device batch size (reduce to 2 if OOM)
        lora_r         : LoRA rank (higher = more params, more capacity)
        lora_alpha     : LoRA alpha (typically 2x rank)
        max_seq_length : Max token length (2048 for most notes)
    """
    def log(msg: str, pct: int = 0):
        print(f"[trainer] {msg}")
        if progress_callback:
            progress_callback(msg, pct)

    # ── 0. GPU Check ───────────────────────────────────────────────────────
    gpu_info = _check_gpu()
    log(f"GPU: {gpu_info['gpu']} ({gpu_info['vram_gb']}GB VRAM)", 0)

    # ── 1. Load Unsloth model ──────────────────────────────────────────────
    log(f"Loading {base_model} with 4-bit quantization...", 5)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=max_seq_length,
        dtype=None,           # Auto-detect float16 or bfloat16
        load_in_4bit=True,    # QLoRA - fits in 6-8GB VRAM
    )

    # ── 2. Apply LoRA ──────────────────────────────────────────────────────
    log("Applying LoRA adapters...", 10)
    model = FastLanguageModel.get_peft_model(
        model,
        r=lora_r,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                         "gate_proj", "up_proj", "down_proj"],
        lora_alpha=lora_alpha,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",  # Saves 30% VRAM
        random_state=42,
    )

    # ── 3. Prepare Dataset ─────────────────────────────────────────────────
    log("Preparing dataset...", 15)
    alpaca_prompt = """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""

    records = []
    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    def format_prompts(examples):
        texts = []
        for instr, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
            text = alpaca_prompt.format(instr, inp, out) + tokenizer.eos_token
            texts.append(text)
        return {"text": texts}

    dataset = Dataset.from_list(records)
    dataset = dataset.map(format_prompts, batched=True)
    log(f"Dataset ready: {len(dataset)} examples", 20)

    # ── 4. Train ───────────────────────────────────────────────────────────
    log("Starting training...", 25)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        args=TrainingArguments(
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            num_train_epochs=epochs,
            learning_rate=2e-4,
            fp16=not _is_bfloat16_supported(),
            bf16=_is_bfloat16_supported(),
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            output_dir=str(output_path / "checkpoints"),
            save_strategy="epoch",
        ),
    )

    trainer_stats = trainer.train()
    log("Training complete. Saving LoRA adapter...", 85)

    # ── 5. Save LoRA adapter ───────────────────────────────────────────────
    model.save_pretrained(str(output_path / "lora_adapter"))
    tokenizer.save_pretrained(str(output_path / "lora_adapter"))
    log("LoRA adapter saved.", 90)

    # ── 6. Save merge instructions ─────────────────────────────────────────
    instructions = {
        "base_model": base_model,
        "lora_adapter": str(output_path / "lora_adapter"),
        "merge_command": (
            f"python merge_and_export.py "
            f"--base {base_model} "
            f"--lora {output_path / 'lora_adapter'} "
            f"--output {output_path / 'merged'}"
        ),
        "ollama_command": f"ollama create rag-system -f {output_path / 'Modelfile'}",
    }
    (output_path / "instructions.json").write_text(json.dumps(instructions, indent=2))
    log("Done! See instructions.json to merge and deploy via Ollama.", 100)

    return {
        "status": "complete",
        "output_dir": str(output_path),
        "examples_trained": len(dataset),
        "epochs": epochs,
        "gpu": gpu_info,
        "training_loss": trainer_stats.training_loss,
    }


def _is_bfloat16_supported() -> bool:
    try:
        return torch.cuda.is_bf16_supported()
    except Exception:
        return False
