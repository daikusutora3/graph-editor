type Visibility = {
  readonly hidden: boolean;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};

type TimeoutClock = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
};

/** A suspended background tab must not consume the canvas's display deadline. */
export function startVisibleTimeout(
  callback: () => void,
  delay: number,
  visibility: Visibility = document,
  clock: TimeoutClock = {
    now: () => performance.now(),
    setTimeout: (run, timeout) => window.setTimeout(run, timeout),
    clearTimeout: (id) => window.clearTimeout(id),
  },
) {
  let remaining = delay;
  let started: number | null = null;
  let timeout: number | null = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (timeout !== null) clock.clearTimeout(timeout);
    timeout = null;
    visibility.removeEventListener("visibilitychange", update);
  };
  const update = () => {
    if (stopped) return;
    if (timeout !== null) clock.clearTimeout(timeout);
    timeout = null;
    if (started !== null) remaining -= Math.max(0, clock.now() - started);
    started = null;
    if (visibility.hidden) return;
    started = clock.now();
    timeout = clock.setTimeout(
      () => {
        if (visibility.hidden) {
          update();
          return;
        }
        stop();
        callback();
      },
      Math.max(0, remaining),
    );
  };
  visibility.addEventListener("visibilitychange", update);
  update();
  return stop;
}
