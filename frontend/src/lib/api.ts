// API base: use NEXT_PUBLIC_API_URL when set (direct backend), otherwise proxy via Next `/api`.
const publicUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
const API = publicUrl && publicUrl.length > 0
  ? `${publicUrl.replace(/\/$/, "")}/api`
  : "/api";

const HEALTH_TIMEOUT_MS = 6000;
const STATS_TIMEOUT_MS = 10000;

/** Backend origin without `/api` (empty when using same-origin proxy). */
export function getBackendOrigin(): string {
  if (!publicUrl || !publicUrl.length) return "";
  return publicUrl.replace(/\/$/, "");
}

/** Human-readable target for the settings screen. */
export function getBackendDisplayLabel(): string {
  const o = getBackendOrigin();
  return o || "Same origin (Next.js /api proxy)";
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

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

export async function uploadFiles(files: File[]): Promise<{ results: { file: string; status: string; error?: string }[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${API}/ingest/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  return res.json();
}

/** Clear all data in the vector DB and wipe the backend notes folder. */
export async function clearIndex(): Promise<{ status: string }> {
  const res = await fetch(`${API}/ingest/clear`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Clear error: ${res.status}`);
  return res.json();
}

/** Get all uniquely indexed files currently inside the database. */
export async function getFiles(): Promise<{ files: { name: string, size: number }[] }> {
  const res = await fetch(`${API}/ingest/files`);
  if (!res.ok) throw new Error(`Fetch files error: ${res.status}`);
  return res.json();
}

/** Specific target deletion algorithm taking the filename base. */
export async function deleteFile(filename: string): Promise<{ status: string, filename: string }> {
  const res = await fetch(`${API}/ingest/delete/${encodeURIComponent(filename)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete error: ${res.status}`);
  return res.json();
}

export async function search(
  q: string,
  collection: "all" | "documents" | "code" = "all",
  topK = 10
) {
  const params = new URLSearchParams({ q, collection, top_k: String(topK) });
  const res = await fetchWithTimeout(`${API}/search?${params}`, STATS_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Search error: ${res.status}`);
  return res.json();
}

export async function getStats(): Promise<{ documents: number; code: number; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${API}/ingest/stats`, STATS_TIMEOUT_MS);
    if (!res.ok) return { documents: 0, code: 0, error: `HTTP ${res.status}` };
    return res.json();
  } catch {
    return { documents: 0, code: 0, error: "Unreachable or timed out" };
  }
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

export type HealthPayload = {
  status: string;
  llm_provider?: string;
  ollama?: {
    reachable: boolean;
    models_installed?: number;
    sample_models?: string[];
    error?: string;
  };
  cloud_configured?: boolean;
};

export async function getHealth(): Promise<HealthPayload> {
  try {
    const res = await fetchWithTimeout(`${API}/health`, HEALTH_TIMEOUT_MS);
    if (!res.ok) return { status: "offline" };
    return res.json();
  } catch {
    return { status: "offline" };
  }
}
