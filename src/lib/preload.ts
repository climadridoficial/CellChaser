// Time-slider preloading: fetch every frame once, then sliding is instant.

export interface PreloadProgress {
  done: number;
  total: number;
}

export const NO_PRELOAD: PreloadProgress = { done: 0, total: 0 };

/** Runs tasks with bounded concurrency; stops starting new ones once cancelled. */
export async function runPool(
  tasks: Array<() => Promise<unknown>>,
  concurrency: number,
  onDone: () => void,
  cancelled: () => boolean,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (!cancelled() && next < tasks.length) {
      const task = tasks[next++]!;
      try {
        await task();
      } catch {
        // A missing frame just stays empty on the slider.
      }
      if (!cancelled()) onDone();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

export function sumProgress(...parts: PreloadProgress[]): PreloadProgress {
  return parts.reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), NO_PRELOAD);
}
