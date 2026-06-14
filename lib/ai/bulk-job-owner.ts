/** Only the Next.js process runs bulk workers and may reconcile orphaned DB state. */
export function ownsBulkJobWorkers(): boolean {
  return process.env.BULK_JOB_WORKER === "1" || process.env.VITEST === "true";
}
