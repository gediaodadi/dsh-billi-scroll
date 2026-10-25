import { describe, expect, it } from 'vitest';
import { normalizeImage, playerUrl, toVideo } from './api';
import { formatCount, formatDuration } from './format';

const popularItem = {
  aid: 117495239350491,
  bvid: 'BV14cHP6yEYj',
  cid: 123,
  pic: 'http://i1.hdslb.com/bfs/archive/abc.jpg',
  title: '消防车路权大还是校车路权更大？',
  duration: 341,
  pubdate: 1_792_835_777,
  tname: '科工机械',
  goto: 'av',
  owner: { mid: 3546847826, name: '改车大全', face: '//i2.hdslb.com/bfs/face/def.jpg' },
  stat: { view: 128_000, like: 31_000, danmaku: 128, reply: 9, favorite: 800, coin: 200, share: 30 },
};

describe('normalizeImage', () => {
  it('upgrades protocol and appends the resize spec', () => {
    expect(normalizeImage('http://i1.hdslb.com/a.jpg', '672w_378h_1c.webp')).toBe(
      'https://i1.hdslb.com/a.jpg@672w_378h_1c.webp',
    );
    expect(normalizeImage('//i2.hdslb.com/b.jpg', '96w_96h_1c.webp')).toBe('https://i2.hdslb.com/b.jpg@96w_96h_1c.webp');
  });

  it('replaces an existing spec instead of stacking it', () => {
    expect(normalizeImage('https://i0.hdslb.com/c.jpg@100w_100h.jpg', '672w_378h_1c.webp')).toBe(
      'https://i0.hdslb.com/c.jpg@672w_378h_1c.webp',
    );
  });

  it('returns empty for unusable values', () => {
    expect(normalizeImage('', 'spec')).toBe('');
    expect(normalizeImage(undefined, 'spec')).toBe('');
    expect(normalizeImage('ftp://example.com/a.jpg', 'spec')).toBe('');
  });
});

describe('toVideo', () => {
  it('normalizes a popular feed item', () => {
    const video = toVideo(popularItem);
    expect(video).not.toBeNull();
    expect(video?.bvid).toBe('BV14cHP6yEYj');
    expect(video?.title).toBe('消防车路权大还是校车路权更大？');
    expect(video?.cover).toBe('https://i1.hdslb.com/bfs/archive/abc.jpg@672w_378h_1c.webp');
    expect(video?.owner.face).toBe('https://i2.hdslb.com/bfs/face/def.jpg@96w_96h_1c.webp');
    expect(video?.stats.fav).toBe(800);
    expect(video?.pageUrl).toBe('https://www.bilibili.com/video/BV14cHP6yEYj');
    expect(formatCount(video?.stats.view ?? 0)).toBe('12.8万');
    expect(formatDuration(video?.durationSec ?? 0)).toBe('5:41');
  });

  it('tolerates the slimmer recommend payload', () => {
    const video = toVideo({
      bvid: 'BV1WeHT6UECQ',
      id: 42,
      pic: 'https://i0.hdslb.com/bfs/archive/x.jpg',
      title: '【In Falsus 全球首杀】',
      duration: 193,
      pubdate: 1_792_861_126,
      owner: { mid: 18_981_268, name: 'Cyanix' },
      stat: { view: 24_828, like: 3_601, danmaku: 120 },
    });
    expect(video?.aid).toBe(42);
    expect(video?.owner.name).toBe('Cyanix');
    expect(video?.owner.face).toBe('');
    expect(video?.stats.fav).toBe(0);
    expect(video?.category).toBe('');
  });

  it('drops entries that are not regular videos', () => {
    expect(toVideo({ bvid: 'BV1xx', goto: 'live' })).toBeNull();
    expect(toVideo({ title: '没有 bvid' })).toBeNull();
  });

  it('fills in placeholders for missing fields', () => {
    const video = toVideo({ bvid: 'BV1zz' });
    expect(video?.title).toBe('无标题');
    expect(video?.owner.name).toBe('未知 UP 主');
    expect(video?.stats.view).toBe(0);
  });
});

describe('playerUrl', () => {
  it('builds an embed url with autoplay control', () => {
    const url = new URL(playerUrl('BV1zz', true));
    expect(url.origin).toBe('https://player.bilibili.com');
    expect(url.searchParams.get('bvid')).toBe('BV1zz');
    expect(url.searchParams.get('autoplay')).toBe('1');
    expect(playerUrl('BV1zz', false)).toContain('autoplay=0');
  });
});
