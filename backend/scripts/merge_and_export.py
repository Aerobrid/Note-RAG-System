"""
merge_and_export.py - Merge LoRA adapter into base model and create an Ollama Modelfile.

Usage:
  python backend/scripts/merge_and_export.py

Reads paths from finetuned_model/instructions.json (written by trainer.py).
"""
import json
import sys
from pathlib import Path

from unsloth import FastLanguageModel

ROOT = Path(__file__).parent.parent.parent

def main():
    instructions_path = ROOT / "finetuned_model" / "instructions.json"
    if not instructions_path.exists():
        print("ERROR: finetuned_model/instructions.json not found. Run fine-tuning first.")
        sys.exit(1)

    instr = json.loads(instructions_path.read_text())
    base_model = instr["base_model"]
    lora_path  = Path(instr["lora_adapter"])
    output_dir = ROOT / "finetuned_model" / "merged"
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Merging LoRA from: {lora_path}")
    print(f"Base model      : {base_model}")
    print(f"Output          : {output_dir}")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(lora_path),
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=True,
    )
    model.save_pretrained_merged(
        str(output_dir),
        tokenizer,
        save_method="merged_16bit",
    )
    print("Merge complete.")

    # Write Ollama Modelfile
    modelfile_content = f"""FROM {output_dir}

SYSTEM \"\"\"
You are a personal AI study assistant fine-tuned on the user's own college lecture notes and code.
Answer questions based on what you learned from their notes.
Be concise, accurate, and cite sources when possible.
\"\"\"

PARAMETER temperature 0.1
PARAMETER num_ctx 4096
"""
    modelfile_path = ROOT / "finetuned_model" / "Modelfile"
    modelfile_path.write_text(modelfile_content)
    print(f"\nModelfile written to: {modelfile_path}")
    print("\nNext steps:")
    print(f"  ollama create rag-system -f {modelfile_path}")
    print("  # Then in .env: LLM_PROVIDER=ollama  OLLAMA_MODEL=rag-system")


if __name__ == "__main__":
    main()
