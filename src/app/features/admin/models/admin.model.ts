export interface MigrationReport {
  totalRead: number;
  totalPatched: number;
  totalSkipped: number;
  batchesCommitted: number;
  errors: string[];
  durationMs: number;
}
