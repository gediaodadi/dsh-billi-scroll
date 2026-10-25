import { describe, expect, it } from 'vitest';
import { formatAgo, formatCount, formatDuration } from './format';

describe('formatCount', () => {
  it('keeps small numbers as-is', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(7)).toBe('7');
    expect(formatCount(9999)).toBe('9999');
  });

  it('switches to 万 and 亿', () => {
    expect(formatCount(10_000)).toBe('1万');
    expect(formatCount(12_800)).toBe('1.3万');
    expect(formatCount(1_234_567)).toBe('123万');
    expect(formatCount(123_456_789)).toBe('1.2亿');
  });

  it('survives bad input', () => {
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(-5)).toBe('0');
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(601)).toBe('10:01');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('formatAgo', () => {
  const now = Date.UTC(2026, 0, 2, 12, 0, 0);

  it('describes recent times', () => {
    expect(formatAgo(now / 1000 - 30, now)).toBe('刚刚');
    expect(formatAgo(now / 1000 - 300, now)).toBe('5 分钟前');
    expect(formatAgo(now / 1000 - 7200, now)).toBe('2 小时前');
    expect(formatAgo(now / 1000 - 86_400 * 3, now)).toBe('3 天前');
  });

  it('falls back to a date after a month', () => {
    expect(formatAgo(now / 1000 - 86_400 * 60, now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns empty for missing timestamps', () => {
    expect(formatAgo(0, now)).toBe('');
  });
});
