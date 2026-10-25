/** 文案与数字格式化，纯函数，方便单测。 */

export function pad2(n: number): string {
  return String(Math.trunc(Math.abs(n))).padStart(2, '0');
}

function trimFixed(value: number): string {
  const text = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** 12800 -> 1.3万，123456789 -> 1.2亿 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 10_000) return String(Math.round(n));
  if (n < 100_000_000) return `${trimFixed(n / 10_000)}万`;
  return `${trimFixed(n / 100_000_000)}亿`;
}

/** 3725 -> 1:02:05，65 -> 1:05 */
export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0:00';
  const total = Math.floor(totalSec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

/** 发布时间转「x 分钟前」，超过 30 天直接给日期。 */
export function formatAgo(pubdateSec: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(pubdateSec) || pubdateSec <= 0) return '';
  const diff = Math.floor(nowMs / 1000) - Math.floor(pubdateSec);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86_400 * 30) return `${Math.floor(diff / 86_400)} 天前`;
  const date = new Date(pubdateSec * 1000);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
