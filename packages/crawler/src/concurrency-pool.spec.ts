import { describe, expect, it } from "vitest";
import { ConcurrencyPool } from "./concurrency-pool";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ConcurrencyPool", () => {
  it("processes every item exactly once", async () => {
    const processed: number[] = [];
    const pool = new ConcurrencyPool<number>(3, async (item) => {
      processed.push(item);
    });
    await pool.run([1, 2, 3, 4, 5]);
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("never runs more than `limit` workers concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const pool = new ConcurrencyPool<number>(2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });
    await pool.run([1, 2, 3, 4, 5, 6]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("lets a worker enqueue new items discovered mid-run and still resolves when truly idle", async () => {
    const processed: number[] = [];
    const pool = new ConcurrencyPool<number>(2, async (item, self) => {
      processed.push(item);
      if (item < 3) {
        self.enqueue(item + 10);
      }
    });
    await pool.run([1, 2, 3]);
    expect(processed).toContain(11);
    expect(processed).toContain(12);
    expect(processed).toHaveLength(5);
  });

  it("does not abort the run when one worker throws", async () => {
    const processed: number[] = [];
    const pool = new ConcurrencyPool<number>(2, async (item) => {
      if (item === 2) throw new Error("boom");
      processed.push(item);
    });
    await pool.run([1, 2, 3]);
    expect(processed.sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it("resolves immediately for an empty initial queue", async () => {
    const pool = new ConcurrencyPool<number>(2, async () => {});
    await expect(pool.run([])).resolves.toBeUndefined();
  });
});
