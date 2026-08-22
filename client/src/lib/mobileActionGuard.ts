export function shouldAllowAction(lastActionAt: number | undefined, now: number, interval: number): boolean {
  return lastActionAt === undefined || now - lastActionAt >= interval;
}
