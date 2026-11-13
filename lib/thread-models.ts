export type ThreadMessageRecord = { id: string; threadId: string; receivedAt: string };

export function newestPerThread<T extends ThreadMessageRecord>(records: T[]) {
  const newest = new Map<string, T>();
  for (const record of records) {
    const prior = newest.get(record.threadId);
    if (!prior || Date.parse(record.receivedAt) > Date.parse(prior.receivedAt) || (record.receivedAt === prior.receivedAt && record.id > prior.id)) newest.set(record.threadId, record);
  }
  return [...newest.values()];
}
