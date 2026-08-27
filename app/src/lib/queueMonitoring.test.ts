import { describe, it, expect } from "vitest";
import {
  detectQueueBacklog,
  detectQueueStarvation,
  detectQueueStall,
  isWorkerResponsive,
  countUnresponsiveWorkers,
} from "./queueMonitoring";

describe("queue backlog detection", () => {
  it("matches the doc's own worked example (100 normal, 10,000 current)", () => {
    expect(detectQueueBacklog(100, 10_000)).toBe(true);
  });

  it("does not flag normal queue fluctuation", () => {
    expect(detectQueueBacklog(100, 150)).toBe(false);
  });
});

describe("queue starvation", () => {
  it("matches the doc's own worked example (2,500 pending, 0 workers)", () => {
    expect(detectQueueStarvation(2500, 0)).toBe(true);
  });

  it("is not starved when workers are active", () => {
    expect(detectQueueStarvation(2500, 3)).toBe(false);
  });

  it("is not starved when there's nothing pending", () => {
    expect(detectQueueStarvation(0, 0)).toBe(false);
  });
});

describe("queue stall detection", () => {
  it("matches the doc's own worked example (oldest job 4h, expected <5min)", () => {
    expect(detectQueueStall(4 * 60 * 60 * 1000, 5 * 60 * 1000)).toBe(true);
  });

  it("does not flag a fresh queue", () => {
    expect(detectQueueStall(60 * 1000, 5 * 60 * 1000)).toBe(false);
  });
});

describe("worker heartbeat monitoring", () => {
  it("is responsive within the heartbeat timeout", () => {
    expect(isWorkerResponsive({ workerId: "w-1", lastHeartbeatAt: "2026-08-26T00:00:00.000Z" }, "2026-08-26T00:00:10.000Z", 30_000)).toBe(
      true
    );
  });

  it("is unresponsive once the heartbeat timeout has elapsed", () => {
    expect(isWorkerResponsive({ workerId: "w-1", lastHeartbeatAt: "2026-08-26T00:00:00.000Z" }, "2026-08-26T00:01:00.000Z", 30_000)).toBe(
      false
    );
  });

  it("counts every unresponsive worker in a batch", () => {
    const count = countUnresponsiveWorkers(
      [
        { workerId: "w-1", lastHeartbeatAt: "2026-08-26T00:00:00.000Z" },
        { workerId: "w-2", lastHeartbeatAt: "2026-08-26T00:00:59.000Z" },
      ],
      "2026-08-26T00:01:00.000Z",
      30_000
    );
    expect(count).toBe(1);
  });
});
