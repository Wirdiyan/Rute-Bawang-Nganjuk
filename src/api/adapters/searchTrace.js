// Reconstruct the exact OPEN/CLOSED state after a recorded expansion.
// Keys include the mask: the same road node may be several distinct states.
export function replayTrace(trace, initial, cursor) {
  const open = new Map(initial ? [[initial.key, initial]] : []);
  const closed = new Map();
  for (let index = 0; index <= cursor && index < trace.length; index += 1) {
    const step = trace[index];
    open.delete(step.key);
    closed.set(step.key, step);
    for (const change of step.opened) {
      closed.delete(change.key);
      open.set(change.key, change);
    }
  }
  return { openCount: open.size, closedCount: closed.size,
    open: [...open.values()].sort((a, b) => a.f - b.f || a.g - b.g).slice(0, 8),
    closed: [...closed.values()].slice(-8) };
}

export const visitedNames = (mask, names) => names.filter((_, index) => mask & (1 << index));
