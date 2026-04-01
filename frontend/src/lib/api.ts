// API base: use NEXT_PUBLIC_API_URL when set (direct backend), otherwise proxy via Next `/api`.
const publicUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
const API = publicUrl && publicUrl.length > 0
  ? `${publicUrl.replace(/\/$/, "")}/api`
  : "/api";

export interface StreamChunk {
  type: "meta" | "token" | "done";
  content?: string;
  query_type?: string;
  sources?: import("@/store/useAppStore").Source[];
}

/** Stream chat — yields parsed SSE chunks */
export async function* streamChat(
  query: string,
  history: { role: string; content: string }[]
): AsyncGenerator<StreamChunk> {
  // Use /chat (no trailing slash) to match backend route and avoid 307 redirects
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history, stream: true }),
  });

  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === "[DONE]") { yield { type: "done" }; return; }
      try {
        yield JSON.parse(raw) as StreamChunk;
      } catch {}
    }
  }
}

/** Upload files to /api/ingest/upload */
export async function uploadFiles(files: File[]): Promise<{ results: { file: string; status: string; error?: string }[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${API}/ingest/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  return res.json();
}

export async function search(
  q: string,
  collection: "all" | "documents" | "code" = "all",
  topK = 10
) {
  const params = new URLSearchParams({ q, collection, top_k: String(topK) });
  const res = await fetch(`${API}/search?${params}`);
  if (!res.ok) throw new Error(`Search error: ${res.status}`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API}/ingest/stats`);
  if (!res.ok) return { documents: 0, code: 0 };
  return res.json();
}

export async function generateDataset(nPairs = 3, maxChunks = 300) {
  const res = await fetch(`${API}/finetune/generate-dataset?n_pairs=${nPairs}&max_chunks=${maxChunks}`, {
    method: "POST",
  });
  return res.json();
}

export async function startTraining(epochs = 3, batchSize = 4) {
  const res = await fetch(`${API}/finetune/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ epochs, batch_size: batchSize }),
  });
  return res.json();
}

export async function getFinetuneStatus() {
  const res = await fetch(`${API}/finetune/status`);
  return res.json();
}

export async function getHealth() {
  try {
    const res = await fetch(`${API}/health`);
    return res.json();
  } catch {
    return { status: "offline" };
  }
}
