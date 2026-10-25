import { playerUrl } from './api';
import type { Video } from './types';

/**
 * 同一时刻只保留一个 iframe：滚走就销毁，既省内存也不会出现两个声音。
 */
export class Player {
  private host: HTMLElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private bvid = '';

  get isPlaying(): boolean {
    return this.frame !== null;
  }

  attach(host: HTMLElement, video: Video, autoplay: boolean): void {
    if (this.host === host && this.bvid === video.bvid && this.frame) return;

    this.stop();

    const frame = document.createElement('iframe');
    frame.className = 'stage__frame';
    frame.src = playerUrl(video.bvid, autoplay);
    frame.title = video.title;
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'no-referrer';

    host.append(frame);
    host.classList.add('is-live');

    this.host = host;
    this.frame = frame;
    this.bvid = video.bvid;
  }

  stop(): void {
    this.frame?.remove();
    this.host?.classList.remove('is-live');
    this.frame = null;
    this.host = null;
    this.bvid = '';
  }
}
