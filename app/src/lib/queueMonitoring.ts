// Queue monitoring: backlog/starvation/stall detection + worker
// monitoring -- doc 12 sections 17-21. PLAN.md P11-7.
//
// "Monitor all background queues. Track: queue depth, processing
// rate, waiting time, oldest job, failed jobs, retry jobs,
// dead-letter jobs, worker count, worker utilization, processing
// latency." / "Detect abnormal queue growth... QUEUE_BACKLOG_ALERT." /
// "Detect queues where jobs exist but no workers are processing
// them... CRITICAL." / "Detect jobs remaining in queue beyond
// threshold... create alert." / "Monitor workers... detect workers
// that stop responding."
//
// Backlog detection reuses workflowMonitoring.ts's
// `detectFailureSpike()` -- doc 12 §18's "normal 100 jobs, current
// 10,000 jobs" is the exact same baseline-vs-current-with-absolute-
// floor shape as doc 12 §13's failure-spike check, just applied to
// queue depth instead of failure count.

import { detectFailureSpike, type SpikeDetectionConfig } from "./workflowMonitoring";

export interface QueueMetrics {
  queueName: string;
  depth: number;
  processingRatePerHour: number;
  oldestJobAgeMs: number;
  failedJobs: number;
  retryJobs: number;
  deadLetterJobs: number;
  workerCount: number;
  activeWorkerCount: number;
}

/**
 * Pure: doc 12 §18's own worked example (normal 100 jobs, current
 * 10,000). Delegates to detectFailureSpike() -- same
 * baseline/current/multiplier/floor shape, applied to queue depth.
 */
export function detectQueueBacklog(
  baselineDepth: number,
  currentDepth: number,
  config?: SpikeDetectionConfig
): boolean {
  return detectFailureSpike(baselineDepth, currentDepth, config);
}

/**
 * Pure: doc 12 §19 -- a queue with pending work and zero active
 * workers is starved, regardless of depth (even 1 pending job with 0
 * workers is CRITICAL, per the doc's own example).
 */
export function detectQueueStarvation(pendingJobs: number, activeWorkerCount: number): boolean {
  return pendingJobs > 0 && activeWorkerCount === 0;
}

/**
 * Pure: doc 12 §20 -- the oldest job in the queue has sat longer than
 * expected.
 */
export function detectQueueStall(oldestJobAgeMs: number, expectedMaxAgeMs: number): boolean {
  return oldestJobAgeMs > expectedMaxAgeMs;
}

// --- Worker monitoring (doc 12 §21) -----------------------------------------

export interface WorkerHeartbeat {
  workerId: string;
  lastHeartbeatAt: string;
}

/**
 * Pure: doc 12 §21 -- "detect workers that stop responding." A worker
 * is considered unresponsive once its last heartbeat is older than
 * the configured timeout.
 */
export function isWorkerResponsive(heartbeat: WorkerHeartbeat, now: string, heartbeatTimeoutMs: number): boolean {
  const ageMs = new Date(now).getTime() - new Date(heartbeat.lastHeartbeatAt).getTime();
  return ageMs <= heartbeatTimeoutMs;
}

export function countUnresponsiveWorkers(
  heartbeats: readonly WorkerHeartbeat[],
  now: string,
  heartbeatTimeoutMs: number
): number {
  return heartbeats.filter((h) => !isWorkerResponsive(h, now, heartbeatTimeoutMs)).length;
}
