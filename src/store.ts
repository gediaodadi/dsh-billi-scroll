const KEY = 'billi-scroll:watched';
const LIMIT = 500;

/** 本地记住「看过」，刷过一遍再回来会有标记。localStorage 不可用时静默降级。 */
export function loadWatched(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export function saveWatched(watched: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...watched].slice(-LIMIT)));
  } catch {
    /* 无痕模式 / 配额写满，忽略即可 */
  }
}
