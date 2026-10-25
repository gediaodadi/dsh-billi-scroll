export type SourceId = 'popular' | 'recommend';

export interface VideoOwner {
  mid: number;
  name: string;
  face: string;
}

export interface VideoStats {
  view: number;
  like: number;
  danmaku: number;
  reply: number;
  fav: number;
  coin: number;
  share: number;
}

/** 归一化之后的视频条目，卡片只认识这个结构。 */
export interface Video {
  bvid: string;
  aid: number;
  title: string;
  /** 已经加上尺寸后缀的 https 封面地址 */
  cover: string;
  durationSec: number;
  pubdate: number;
  owner: VideoOwner;
  stats: VideoStats;
  category: string;
  reason: string;
  pageUrl: string;
}
