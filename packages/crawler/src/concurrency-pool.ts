/**
 * Small hand-rolled concurrency limiter — deliberately not a dependency for
 * something this simple (see docs/DECISIONS.md). Runs `worker` against
 * items pulled from a shared queue, `limit` at a time; `enqueue` can be
 * called by the worker itself to add newly-discovered items (link
 * discovery during a crawl).
 */
export class ConcurrencyPool<T> {
  private queue: T[] = [];
  private active = 0;
  private resolveIdle: (() => void) | undefined;

  constructor(
    private readonly limit: number,
    private readonly worker: (item: T, pool: ConcurrencyPool<T>) => Promise<void>,
    private readonly signal?: AbortSignal,
  ) {}

  enqueue(item: T): void {
    this.queue.push(item);
    this.pump();
  }

  async run(initial: T[]): Promise<void> {
    initial.forEach((item) => this.queue.push(item));
    if (this.queue.length === 0) return;
    return new Promise((resolve) => {
      this.resolveIdle = resolve;
      this.pump();
    });
  }

  private pump(): void {
    if (this.signal?.aborted && this.active === 0) {
      this.resolveIdle?.();
      return;
    }
    while (!this.signal?.aborted && this.active < this.limit && this.queue.length > 0) {
      const item = this.queue.shift();
      if (item === undefined) break;
      this.active++;
      void this.worker(item, this)
        .catch(() => {
          // Individual item failures are the worker's responsibility to
          // record as facts (e.g. a failed fetch); the pool itself never
          // aborts the whole crawl over one item.
        })
        .finally(() => {
          this.active--;
          if (this.queue.length === 0 && this.active === 0) {
            this.resolveIdle?.();
          } else {
            this.pump();
          }
        });
    }
  }
}
