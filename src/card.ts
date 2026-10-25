import { formatAgo, formatCount, formatDuration } from './format';
import type { Video } from './types';

export interface CardRefs {
  el: HTMLElement;
  stage: HTMLElement;
}

const PLAY_ICON =
  '<svg class="stage__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.2v13.6L19 12z" fill="currentColor" /></svg>';

/** 一屏一张卡：封面 + 标题 + UP 主 + 数据 + 去 B 站的链接。 */
export function createCard(video: Video, watched: boolean): CardRefs {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.bvid = video.bvid;
  if (watched) el.classList.add('is-watched');

  const backdrop = document.createElement('div');
  backdrop.className = 'card__bg';
  backdrop.setAttribute('aria-hidden', 'true');
  const backdropImg = document.createElement('img');
  backdropImg.alt = '';
  backdropImg.decoding = 'async';
  backdropImg.loading = 'lazy';
  backdropImg.referrerPolicy = 'no-referrer';
  if (video.cover) backdropImg.src = video.cover;
  backdrop.append(backdropImg);

  const scrim = document.createElement('div');
  scrim.className = 'card__scrim';
  scrim.setAttribute('aria-hidden', 'true');

  const stage = document.createElement('div');
  stage.className = 'stage';

  const poster = document.createElement('img');
  poster.className = 'stage__poster';
  poster.alt = '';
  poster.decoding = 'async';
  poster.referrerPolicy = 'no-referrer';
  poster.loading = 'eager';
  if (video.cover) poster.src = video.cover;

  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'stage__hit';
  hit.setAttribute('aria-label', `播放：${video.title}`);
  const pill = document.createElement('span');
  pill.className = 'stage__play';
  pill.innerHTML = PLAY_ICON;
  const pillText = document.createElement('span');
  pillText.textContent = '播放';
  pill.append(pillText);
  hit.append(pill);

  stage.append(poster, hit);

  if (video.durationSec > 0) {
    const time = document.createElement('span');
    time.className = 'stage__time';
    time.textContent = formatDuration(video.durationSec);
    stage.append(time);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';

  const kickerParts: string[] = [];
  if (video.category) kickerParts.push(`# ${video.category}`);
  if (video.reason) kickerParts.push(video.reason);
  if (kickerParts.length > 0) {
    const kicker = document.createElement('p');
    kicker.className = 'meta__kicker';
    kicker.textContent = kickerParts.join('  ·  ');
    meta.append(kicker);
  }

  const title = document.createElement('h2');
  title.className = 'meta__title';
  title.textContent = video.title;
  meta.append(title);

  const row = document.createElement('div');
  row.className = 'meta__row';

  if (video.owner.face) {
    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    avatar.loading = 'lazy';
    avatar.src = video.owner.face;
    row.append(avatar);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'avatar avatar--empty';
    fallback.textContent = [...video.owner.name][0] ?? '?';
    row.append(fallback);
  }

  const uploader = document.createElement('span');
  uploader.className = 'up';
  uploader.textContent = video.owner.name;
  row.append(uploader);

  const ago = formatAgo(video.pubdate);
  if (ago) {
    const sep = document.createElement('span');
    sep.className = 'dot';
    sep.textContent = '·';
    const when = document.createElement('span');
    when.textContent = ago;
    row.append(sep, when);
  }

  meta.append(row);

  const stats = document.createElement('dl');
  stats.className = 'stats';
  const entries: Array<[string, number]> = [
    ['播放', video.stats.view],
    ['弹幕', video.stats.danmaku],
    ['点赞', video.stats.like],
  ];
  if (video.stats.fav > 0) entries.push(['收藏', video.stats.fav]);

  for (const [label, value] of entries) {
    const cell = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = formatCount(value);
    cell.append(dt, dd);
    stats.append(cell);
  }
  meta.append(stats);

  const actions = document.createElement('div');
  actions.className = 'meta__actions';

  const open = document.createElement('a');
  open.className = 'ghost-btn';
  open.href = video.pageUrl;
  open.target = '_blank';
  open.rel = 'noreferrer noopener';
  open.textContent = '在 B 站打开';

  const seen = document.createElement('span');
  seen.className = 'seen';
  seen.textContent = '已看过';

  actions.append(open, seen);
  meta.append(actions);

  const body = document.createElement('div');
  body.className = 'card__body';
  body.append(stage, meta);

  el.append(backdrop, scrim, body);

  return { el, stage };
}
