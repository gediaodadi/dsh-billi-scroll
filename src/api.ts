import type { SourceId, Video } from './types';

const PAGE_SIZE: Record<SourceId, number> = { popular: 20, recommend: 12 };

const COVER_SPEC = '672w_378h_1c.webp';
const FACE_SPEC = '96w_96h_1c.webp';

interface RawOwner {
  mid?: unknown;
  name?: unknown;
  face?: unknown;
}

interface RawStat {
  view?: unknown;
  like?: unknown;
  danmaku?: unknown;
  reply?: unknown;
  favorite?: unknown;
  fav?: unknown;
  coin?: unknown;
  share?: unknown;
}

interface RawItem {
  bvid?: unknown;
  aid?: unknown;
  id?: unknown;
  title?: unknown;
  pic?: unknown;
  duration?: unknown;
  pubdate?: unknown;
  tname?: unknown;
  rcmd_reason?: unknown;
  goto?: unknown;
  owner?: RawOwner;
  stat?: RawStat;
}

interface FeedPayload {
  code?: number;
  message?: string;
  data?: {
    list?: RawItem[];
    item?: RawItem[];
  };
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * B 站图床支持在 URL 后面追加 `@宽w_高h_裁剪.webp` 拿缩略图。
 * 顺手把 http:// 和 // 开头的地址统一成 https。
 */
export function normalizeImage(url: unknown, spec: string): string {
  const raw = toText(url);
  if (!raw) return '';
  let resolved = raw;
  if (resolved.startsWith('//')) resolved = `https:${resolved}`;
  else if (resolved.startsWith('http://')) resolved = `https://${resolved.slice('http://'.length)}`;
  if (!resolved.startsWith('https://')) return '';
  const [base] = resolved.split('@');
  if (!base) return '';
  return `${base}@${spec}`;
}

/** 把两个接口的字段差异抹平，得到统一的 Video。 */
export function toVideo(raw: RawItem): Video | null {
  const bvid = toText(raw.bvid);
  if (!bvid) return null;

  // 推荐流里可能混进直播 / 番剧卡片，这里只要普通投稿。
  const goto = toText(raw.goto);
  if (goto && goto !== 'av') return null;

  const owner = raw.owner ?? {};
  const stat = raw.stat ?? {};
  const title = toText(raw.title) || '无标题';

  return {
    bvid,
    aid: toNumber(raw.aid ?? raw.id),
    title,
    cover: normalizeImage(raw.pic, COVER_SPEC),
    durationSec: toNumber(raw.duration),
    pubdate: toNumber(raw.pubdate),
    owner: {
      mid: toNumber(owner.mid),
      name: toText(owner.name) || '未知 UP 主',
      face: normalizeImage(owner.face, FACE_SPEC),
    },
    stats: {
      view: toNumber(stat.view),
      like: toNumber(stat.like),
      danmaku: toNumber(stat.danmaku),
      reply: toNumber(stat.reply),
      fav: toNumber(stat.favorite ?? stat.fav),
      coin: toNumber(stat.coin),
      share: toNumber(stat.share),
    },
    category: toText(raw.tname),
    reason: toText(raw.rcmd_reason),
    pageUrl: `https://www.bilibili.com/video/${bvid}`,
  };
}

function buildUrl(source: SourceId, page: number, offset: number): string {
  if (source === 'popular') {
    // offset 让「换一批」真的换：B 站热门是按页排的，页码往后挪就换了一批。
    const params = new URLSearchParams({
      ps: String(PAGE_SIZE.popular),
      pn: String(page + offset),
    });
    return `/bili/x/web-interface/popular?${params.toString()}`;
  }

  // 推荐流的翻页靠这几枚计数器，pn 会被忽略。
  const fresh = page + offset * 3;
  const params = new URLSearchParams({
    ps: String(PAGE_SIZE.recommend),
    fresh_type: '4',
    feed_version: 'V8',
    fresh_idx: String(fresh),
    fresh_idx_1h: String(fresh),
    brush: String(Math.max(0, fresh - 1)),
    homepage_ver: '1',
  });
  return `/bili/x/web-interface/index/top/feed/rcmd?${params.toString()}`;
}

export async function fetchPage(
  source: SourceId,
  page: number,
  offset = 0,
  signal?: AbortSignal,
): Promise<Video[]> {
  const response = await fetch(buildUrl(source, page, offset), {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`B 站接口返回 HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FeedPayload;
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.message || `B 站接口返回 code ${payload.code}`);
  }

  const items = payload.data?.list ?? payload.data?.item ?? [];
  return items.map(toVideo).filter((video): video is Video => video !== null);
}

/** B 站官方外链播放器，嵌在卡片里用。 */
export function playerUrl(bvid: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    isOutside: 'true',
    bvid,
    p: '1',
    autoplay: autoplay ? '1' : '0',
    danmaku: '1',
    high_quality: '1',
    as_wide: '1',
  });
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}
