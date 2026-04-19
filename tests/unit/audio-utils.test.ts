/**
 * Coverage for src/utils/audio-utils.ts — the dictionary pronunciation
 * playback helper. Previously 0% because the module uses `new Audio()` at
 * runtime and the integration/E2E runs don't attribute back here. We stub
 * `Audio` with a minimal HTMLAudioElement impl that records play/pause
 * calls so we can exercise the state machine deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioUrl, playAudioUrl, stopAudio } from '../../src/utils/audio-utils';

interface MockAudio {
  src: string;
  preload: string;
  currentTime: number;
  playCalls: number;
  loadCalls: number;
  pauseCalls: number;
  listeners: Map<string, Array<(ev?: unknown) => void>>;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, handler: (ev?: unknown) => void): void;
  setAttribute(_name: string, _value: string): void;
  trigger(event: 'ended' | 'error'): void;
}

let instances: MockAudio[] = [];
let playShouldReject = false;
let playRejectionsRemaining = 0;

function createMockAudio(): MockAudio {
  const listeners = new Map<string, Array<(ev?: unknown) => void>>();
  const a: MockAudio = {
    src: '',
    preload: '',
    currentTime: 0,
    playCalls: 0,
    loadCalls: 0,
    pauseCalls: 0,
    listeners,
    async play() {
      this.playCalls += 1;
      if (playRejectionsRemaining > 0) {
        playRejectionsRemaining -= 1;
        throw new Error('mock play() rejection');
      }
      if (playShouldReject) throw new Error('mock play() rejection');
    },
    pause() {
      this.pauseCalls += 1;
    },
    load() {
      this.loadCalls += 1;
    },
    addEventListener(type, handler) {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    setAttribute() {
      // no-op for this stub — iOS-specific attrs aren't observable here
    },
    trigger(event) {
      for (const h of listeners.get(event) ?? []) h();
    },
  };
  instances.push(a);
  return a;
}

beforeEach(() => {
  instances = [];
  playShouldReject = false;
  playRejectionsRemaining = 0;
  // @ts-expect-error — overriding global for happy-dom env
  globalThis.Audio = function Audio() {
    return createMockAudio();
  };
  stopAudio(); // reset module-level state between tests
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAudioUrl', () => {
  it('uses the 華語 CDN for lang=a', () => {
    const url = getAudioUrl('a', '12345');
    expect(url).toMatch(/rackcdn\.com\/12345\.ogg$/);
  });

  it('uses the 客語 CDN for lang=h', () => {
    expect(getAudioUrl('h', '42')).toMatch(/a7ff62cf9d5b13408e72/);
  });

  it('zero-pads 台語 audio IDs to 5 digits', () => {
    expect(getAudioUrl('t', '8778')).toMatch(/08778\.ogg$/);
    expect(getAudioUrl('t', '42')).toMatch(/00042\.ogg$/);
  });

  it('leaves 5+ digit 台語 IDs alone', () => {
    expect(getAudioUrl('t', '12345')).toMatch(/12345\.ogg$/);
  });

  it('leaves alphanumeric 台語 IDs alone (no padding)', () => {
    expect(getAudioUrl('t', 'abc123')).toMatch(/abc123\.ogg$/);
  });

  it('trims whitespace-only IDs to an empty filename', () => {
    expect(getAudioUrl('a', '   ')).toMatch(/\/\.ogg$/);
  });

  it('falls back to the 華語 CDN for 兩岸 (c)', () => {
    const a = getAudioUrl('a', '1');
    const c = getAudioUrl('c', '1');
    expect(a).toBe(c);
  });
});

describe('playAudioUrl', () => {
  it('creates an Audio, tries the mp3 candidate first, and notifies playing', async () => {
    const onState = vi.fn();
    playAudioUrl('https://cdn/clip.ogg', onState);
    // play() is async; flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(instances).toHaveLength(1);
    expect(instances[0].src).toMatch(/\.mp3$/);
    expect(instances[0].playCalls).toBeGreaterThanOrEqual(1);
    expect(onState).toHaveBeenCalledWith(true);
  });

  it('falls back to the .ogg candidate when .mp3 play() rejects once', async () => {
    playRejectionsRemaining = 1;
    const onState = vi.fn();
    playAudioUrl('https://cdn/clip.ogg', onState);
    await new Promise((r) => setTimeout(r, 0));

    const a = instances[0];
    expect(a.playCalls).toBeGreaterThanOrEqual(2); // mp3 then ogg
    expect(a.src).toMatch(/\.ogg$/);
    expect(onState).toHaveBeenCalledWith(true);
  });

  it('calls onStateChange(false) when every candidate rejects', async () => {
    playShouldReject = true;
    const onState = vi.fn();
    playAudioUrl('https://cdn/clip.ogg', onState);
    await new Promise((r) => setTimeout(r, 0));
    expect(onState).toHaveBeenCalledWith(false);
  });

  it('clicking the same URL twice toggles playback off (stop)', async () => {
    const onState = vi.fn();
    playAudioUrl('https://cdn/clip.ogg', onState);
    await new Promise((r) => setTimeout(r, 0));
    const first = instances[0];

    // Second call with the same URL should pause + clear currentAudio.
    playAudioUrl('https://cdn/clip.ogg', onState);
    expect(first.pauseCalls).toBeGreaterThanOrEqual(1);
    expect(onState).toHaveBeenLastCalledWith(false);
  });

  it('clears currentAudio when the audio element fires "ended"', async () => {
    const onState = vi.fn();
    playAudioUrl('https://cdn/a.ogg', onState);
    await new Promise((r) => setTimeout(r, 0));
    instances[0].trigger('ended');
    expect(onState).toHaveBeenCalledWith(false);
  });

  it('clears currentAudio when the audio element fires "error"', async () => {
    const onState = vi.fn();
    playAudioUrl('https://cdn/a.ogg', onState);
    await new Promise((r) => setTimeout(r, 0));
    instances[0].trigger('error');
    expect(onState).toHaveBeenCalledWith(false);
  });

  it('stopAudio cancels any currently-playing clip', async () => {
    playAudioUrl('https://cdn/a.ogg');
    await new Promise((r) => setTimeout(r, 0));
    const a = instances[0];
    stopAudio();
    expect(a.pauseCalls).toBeGreaterThanOrEqual(1);
    expect(a.currentTime).toBe(0);
  });

  it('noops when window is undefined (e.g. during SSR)', () => {
    const saved = globalThis.window;
    // @ts-expect-error — simulate non-browser env
    delete globalThis.window;
    try {
      expect(() => playAudioUrl('https://cdn/x.ogg')).not.toThrow();
      expect(instances).toHaveLength(0);
    } finally {
      globalThis.window = saved;
    }
  });
});
