import { newestPerThread, type ThreadMessageRecord } from "../../lib/thread-models.js";

export const METADATA_CONCURRENCY = 5;

export type GmailMessageRef = { id: string; threadId: string };
export type ResolvedMessage = ThreadMessageRecord;
export type ExistingMessage = { id?: string; threadId?: string; receivedAt?: string };

const reliableDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export async function mapBounded<T, R>(values: T[], limit: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, run));
  return results;
}

export async function resolveLatestMessages(
  refs: GmailMessageRef[],
  existing: Map<string, ExistingMessage>,
  fetchMetadata: (ref: GmailMessageRef) => Promise<ResolvedMessage>,
  concurrency = METADATA_CONCURRENCY,
) {
  const unique = [...new Map(refs.map((ref) => [ref.id, ref])).values()];
  const known: ResolvedMessage[] = [];
  const missing: GmailMessageRef[] = [];
  for (const ref of unique) {
    const record = existing.get(ref.id);
    if (record && reliableDate(record.receivedAt) && typeof record.threadId === "string" && record.threadId) known.push({ id: ref.id, threadId: record.threadId, receivedAt: record.receivedAt! });
    else missing.push(ref);
  }
  const fetched = await mapBounded(missing, concurrency, fetchMetadata);
  return newestPerThread([...known, ...fetched]);
}

export async function fetchMetadataWithRetry(
  ref: GmailMessageRef,
  fetcher: (ref: GmailMessageRef) => Promise<Response>,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxRetries = 3,
) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetcher(ref);
    if (response.ok) {
      const message = await response.json() as { id?: string; threadId?: string; internalDate?: string };
      const timestamp = Number(message.internalDate ?? 0);
      if (!message.internalDate || !Number.isFinite(timestamp) || timestamp <= 0) throw new Error("Gmail metadata missing timestamp");
      return { id: String(message.id ?? ref.id), threadId: String(message.threadId ?? ref.threadId), receivedAt: new Date(timestamp).toISOString() };
    }
    if (response.status !== 429 || attempt === maxRetries) throw new Error(response.status === 429 ? "Gmail metadata rate limited" : `Gmail message metadata failed (${response.status})`);
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    await sleep(Math.min(5000, retryAfter > 0 ? retryAfter * 1000 : 500 * (2 ** attempt)));
  }
  throw new Error("Gmail metadata unavailable");
}
