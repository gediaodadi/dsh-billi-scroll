import { fetchPage } from './api';
import { createCard } from './card';
import { Player } from './player';
import { loadWatched, saveWatched } from './store';
import type { SourceId, Video } from './types';

type Status =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

const MAX_ITEMS = 240;
const WHEEL_STEP = 42;
const WHEEL_LOCK_MS = 480;

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`缺少必要的节点：${selector}`);
  return node;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function describeError(error: unknown): string {
  if (error instanceof TypeError) return '网络请求失败，检查一下网络后再试。';
  if (error instanceof Error) return error.message;
  return '未知错误';
}

export class App {
  private readonly feed = must<HTMLElement>('#feed');
  private readonly statusHost = must<HTMLElement>('#status');
  private readonly boot = must<HTMLElement>('#boot');
  private readonly progressBar = must<HTMLElement>('#progressBar');
  private readonly counter = must<HTMLElement>('#counter');
  private readonly hint = must<HTMLElement>('#hint');
  private readonly autoplayBtn = must<HTMLButtonElement>('#autoplayBtn');
  private readonly refreshBtn = must<HTMLButtonElement>('#refreshBtn');
  private readonly tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab')];

  private readonly player = new Player();
  private readonly watched: Set<string> = loadWatched();
  private readonly known = new Set<string>();

  private videos: Video[] = [];
  private cards: HTMLElement[] = [];
  private active = -1;
  private page = 0;
  private loading = false;
  private exhausted = false;
  private source: SourceId = 'popular';
  private offset = 0;
  private readonly offsets = new Map<SourceId, number>();
  private autoplay = true;
  private gesture = false;
  private abort: AbortController | null = null;
  private status: Status = { kind: 'loading' };
  private raf = 0;
  private wheelAcc = 0;
  private wheelLockUntil = 0;
  private hintTimer = 0;
  private playTimer = 0;

  constructor() {
    this.bindEvents();
    this.renderStatus();
    this.syncAutoplayButton();
    this.updateTabs();
    void this.reload('popular');
    this.hintTimer = window.setTimeout(() => this.hideHint(), 12_000);
  }

  private bindEvents(): void {
    this.feed.addEventListener('scroll', this.onScroll, { passive: true });
    this.feed.addEventListener('wheel', this.onWheel, { passive: false });
    this.feed.addEventListener('click', this.onFeedClick);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointerdown', this.onFirstGesture, { passive: true });

    this.autoplayBtn.addEventListener('click', () => {
      this.autoplay = !this.autoplay;
      this.syncAutoplayButton();
    });

    this.refreshBtn.addEventListener('click', () => {
      void this.reload(this.source);
    });

    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        const id = tab.dataset.source;
        if ((id === 'popular' || id === 'recommend') && id !== this.source) {
          void this.reload(id);
        }
      });
    }
  }

  private readonly onFirstGesture = (): void => {
    this.gesture = true;
  };

  private readonly onScroll = (): void => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.sync();
    });
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) return;
    event.preventDefault();
    this.hideHint();

    const now = performance.now();
    if (now < this.wheelLockUntil) return;

    this.wheelAcc += event.deltaY;
    if (Math.abs(this.wheelAcc) < WHEEL_STEP) return;

    const direction = this.wheelAcc > 0 ? 1 : -1;
    this.wheelAcc = 0;
    this.wheelLockUntil = now + WHEEL_LOCK_MS;
    this.step(direction);
  };

  private readonly onFeedClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const hit = target.closest('.stage__hit');
    if (!hit) return;
    event.preventDefault();

    const card = hit.closest<HTMLElement>('.card');
    const index = card ? this.cards.indexOf(card) : -1;
    if (!card || index < 0) return;

    this.gesture = true;
    this.hideHint();
    if (index !== this.active) this.setActive(index);
    const video = this.videos[index];
    if (video) this.startVideo(video, card);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'j':
      case 'J':
      case 'PageDown':
        event.preventDefault();
        this.step(1);
        break;
      case 'ArrowUp':
      case 'k':
      case 'K':
      case 'PageUp':
        event.preventDefault();
        this.step(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.goTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.goTo(this.cards.length);
        break;
      case ' ':
        if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        this.togglePlay();
        break;
      case 'o':
      case 'O':
        this.openCurrent();
        break;
      case 'r':
      case 'R':
        void this.reload(this.source);
        break;
      default:
        return;
    }

    this.hideHint();
  };

  private async reload(source: SourceId): Promise<void> {
    this.source = source;
    // 同一来源再点一次「换一批」就把页码往后推一格，内容才会真的换。
    const nextOffset = Math.min((this.offsets.get(source) ?? -1) + 1, 8);
    this.offsets.set(source, nextOffset);
    this.offset = nextOffset;
    this.abort?.abort();
    this.abort = null;
    this.player.stop();
    window.clearTimeout(this.playTimer);

    this.loading = false;
    this.exhausted = false;
    this.page = 0;
    this.videos = [];
    this.cards = [];
    this.known.clear();
    this.active = -1;

    for (const card of [...this.feed.querySelectorAll<HTMLElement>('.card')]) card.remove();
    this.feed.scrollTop = 0;
    this.progressBar.style.transform = 'scaleX(0)';
    this.counter.textContent = '—';
    this.updateTabs();
    this.setStatus({ kind: 'loading' });

    await this.loadMore();
    this.sync();
  }

  private async loadMore(): Promise<void> {
    if (this.loading || this.exhausted) return;

    this.loading = true;
    this.setStatus({ kind: 'loading' });

    const controller = new AbortController();
    this.abort = controller;
    const nextPage = this.page + 1;

    try {
      const items = await fetchPage(this.source, nextPage, this.offset, controller.signal);
      if (controller.signal.aborted) return;

      this.page = nextPage;
      const fresh = items.filter((video) => !this.known.has(video.bvid));
      for (const video of fresh) this.known.add(video.bvid);

      this.appendVideos(fresh);

      if (items.length === 0 || fresh.length === 0 || this.videos.length >= MAX_ITEMS) {
        this.exhausted = true;
      }

      this.setStatus(this.exhausted ? { kind: 'done' } : { kind: 'idle' });
    } catch (error) {
      if (isAbort(error) || controller.signal.aborted) return;
      this.setStatus({ kind: 'error', message: describeError(error) });
    } finally {
      this.loading = false;
      if (this.abort === controller) this.abort = null;
      this.updateCounter();
    }
  }

  private appendVideos(list: Video[]): void {
    if (list.length === 0) return;

    const fragment = document.createDocumentFragment();
    for (const video of list) {
      const { el } = createCard(video, this.watched.has(video.bvid));
      fragment.append(el);
      this.videos.push(video);
      this.cards.push(el);
    }
    this.feed.insertBefore(fragment, this.statusHost);
    this.updateCounter();
  }

  /** 当前滚到第几屏（最后一屏是「看完了」）。 */
  private sync(): void {
    const total = this.cards.length;
    if (total === 0) {
      // 换源 / 重新加载的空档里不要认领 active，否则新卡片补进来时不会点亮第一张
      this.active = -1;
      this.progressBar.style.transform = 'scaleX(0)';
      return;
    }

    const height = this.feed.clientHeight || 1;
    const index = Math.max(0, Math.min(total, Math.round(this.feed.scrollTop / height)));

    if (index !== this.active) this.setActive(index);

    const ratio = Math.min(total, index + 1) / total;
    this.progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;

    if (total - index <= 3) void this.loadMore();
  }

  private setActive(index: number): void {
    const previous = this.cards[this.active];
    this.active = index;

    if (previous && previous !== this.cards[index]) {
      previous.classList.remove('is-active');
      // 离开上一屏就立刻静音，避免两路声音叠在一起
      this.player.stop();
      window.clearTimeout(this.playTimer);
    }

    const card = this.cards[index];
    this.updateCounter();
    if (!card) {
      this.player.stop();
      return;
    }

    card.classList.add('is-active');

    const video = this.videos[index];
    if (!video) return;

    if (this.gesture && this.autoplay) {
      // 等滚动停下来再挂 iframe，快速划过多屏时不会一路加载播放器
      window.clearTimeout(this.playTimer);
      this.playTimer = window.setTimeout(() => {
        if (this.cards[this.active] === card) this.startVideo(video, card);
      }, 240);
    }
  }

  private startVideo(video: Video, card: HTMLElement): void {
    const stage = card.querySelector<HTMLElement>('.stage');
    if (!stage) return;

    this.player.attach(stage, video, true);

    if (!this.watched.has(video.bvid)) {
      this.watched.add(video.bvid);
      saveWatched(this.watched);
    }
    card.classList.add('is-watched');
  }

  private togglePlay(): void {
    if (this.player.isPlaying) {
      this.player.stop();
      return;
    }
    const card = this.cards[this.active];
    const video = this.videos[this.active];
    if (!card || !video) return;
    this.gesture = true;
    this.startVideo(video, card);
  }

  private step(delta: number): void {
    this.goTo(this.active + delta);
  }

  private goTo(index: number): void {
    const target = Math.max(0, Math.min(this.cards.length, index));
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    this.feed.scrollTo({ top: target * this.feed.clientHeight, behavior });
  }

  private openCurrent(): void {
    const video = this.videos[this.active];
    if (video) window.open(video.pageUrl, '_blank', 'noopener');
  }

  private updateCounter(): void {
    const total = this.cards.length;
    if (total === 0) {
      this.counter.textContent = '—';
      return;
    }
    const shown = Math.min(this.active + 1, total);
    this.counter.textContent = `${String(shown).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  }

  private updateTabs(): void {
    for (const tab of this.tabs) {
      const on = tab.dataset.source === this.source;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', String(on));
    }
  }

  private syncAutoplayButton(): void {
    this.autoplayBtn.setAttribute('aria-pressed', String(this.autoplay));
    this.autoplayBtn.classList.toggle('is-on', this.autoplay);
    this.autoplayBtn.title = this.autoplay ? '自动播放：开' : '自动播放：关';
  }

  private hideHint(): void {
    window.clearTimeout(this.hintTimer);
    this.hint.classList.add('is-gone');
  }

  private setStatus(status: Status): void {
    this.status = status;
    this.renderStatus();
  }

  private renderStatus(): void {
    const status = this.status;
    const inline = status.kind === 'done' || status.kind === 'error';

    // 结尾卡只在「看完了 / 出错」时进入滚动流；其余状态用固定层提示。
    // 否则它会在插入新卡片时被浏览器的 scroll-snap 重新吸附，把视口一路拽到底。
    this.statusHost.hidden = !inline;
    this.boot.hidden = inline || this.cards.length > 0;

    if (!inline) {
      this.statusHost.replaceChildren();
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'status';

    if (status.kind === 'error') {
      const title = document.createElement('p');
      title.className = 'status__title';
      title.textContent = '没能连上 B 站';
      const text = document.createElement('p');
      text.className = 'status__text';
      text.textContent = status.message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'solid-btn';
      retry.textContent = '重试';
      retry.addEventListener('click', () => void this.loadMore());
      wrap.append(title, text, retry);
    } else {
      const title = document.createElement('p');
      title.className = 'status__title';
      title.textContent = '这批看完了';
      const text = document.createElement('p');
      text.className = 'status__text';
      text.textContent = `一共刷了 ${this.videos.length} 条，换一批接着看。`;
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'solid-btn';
      again.textContent = '换一批';
      again.addEventListener('click', () => void this.reload(this.source));
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'plain-btn';
      back.textContent = '回到顶部';
      back.addEventListener('click', () => this.goTo(0));
      wrap.append(title, text, again, back);
    }

    this.statusHost.replaceChildren(wrap);
  }
}
