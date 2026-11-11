export type WorkerOperation = "plan" | "extract" | "categorize" | "health";
export type WorkerTask = {
  uid: string;
  runId: string;
  operation?: WorkerOperation;
  messageId?: string;
  taskKey?: string;
  scope?: string;
};

export type SettledStatus = "processed" | "skipped" | "relevant" | "failed";
