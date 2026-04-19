/**
 * Coverage for src/utils/tts-utils.ts — TTS helpers used by the
 * Eng/Fr/De translation pronunciation buttons. The module was 0% at
 * unit level; it isn't exercised by E2E either because Playwright
 * doesn't load voices in headless Chromium.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanTextForTTS, getLanguageCode, speakText } from '../../src/utils/tts-utils';

interface SpeakCall {
  text: string;
  lang: string;
  voice?: SpeechSynthesisVoice;
  rate: number;
  pitch?: number;
  volume: number;
}

let speakCalls: SpeakCall[] = [];
let cancelCalls = 0;
let voices: SpeechSynthesisVoice[] = [];
let voicesChangedHandler: (() => void) | null = null;

class FakeUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | undefined;
  volume = 1;
  rate = 1;
  pitch = 1;
  constructor(text: string) {
    this.text = text;
  }
}

function installSynthesis() {
  const synthesis = {
    getVoices: () => voices,
    cancel: () => {
      cancelCalls += 1;
    },
    speak: (u: FakeUtterance) => {
      speakCalls.push({
        text: u.text,
        lang: u.lang,
        voice: u.voice,
        rate: u.rate,
        pitch: u.pitch,
        volume: u.volume,
      });
    },
    set onvoiceschanged(handler: () => void) {
      voicesChangedHandler = handler;
    },
    get onvoiceschanged() {
      return voicesChangedHandler ?? (() => undefined);
    },
  };
  // @ts-expect-error stubbing window-level TTS for happy-dom
  globalThis.window.speechSynthesis = synthesis;
  // @ts-expect-error same
  globalThis.window.SpeechSynthesisUtterance = FakeUtterance;
}

function uninstallSynthesis() {
  // @ts-expect-error clean up stubs
  delete globalThis.window.speechSynthesis;
  // @ts-expect-error same
  delete globalThis.window.SpeechSynthesisUtterance;
}

function voice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

beforeEach(() => {
  speakCalls = [];
  cancelCalls = 0;
  voices = [];
  voicesChangedHandler = null;
  installSynthesis();
});

afterEach(() => {
  uninstallSynthesis();
  vi.restoreAllMocks();
});

describe('getLanguageCode', () => {
  it.each([
    ['英', 'en-US'],
    ['法', 'fr-FR'],
    ['德', 'de-DE'],
    ['other', 'en-US'],
    ['', 'en-US'],
  ])('%s → %s', (label, expected) => {
    expect(getLanguageCode(label)).toBe(expected);
  });
});

describe('cleanTextForTTS', () => {
  it('strips HTML tags', () => {
    expect(cleanTextForTTS('hello <b>world</b>')).toBe('hello world');
  });

  it('removes ", CL:" trailers common in CFDict entries', () => {
    expect(cleanTextForTTS('to cut, CL: 個')).toBe('to cut');
  });

  it('drops content after a pipe until the next punctuation/space', () => {
    expect(cleanTextForTTS('a|orthographic-variant b')).toBe('a b');
  });

  it('strips single-letter bracket markers like (A) (B) and collapses spaces', () => {
    expect(cleanTextForTTS('(A) primary (B) secondary')).toBe('primary secondary');
  });

  it('strips non-ASCII characters', () => {
    expect(cleanTextForTTS('café naïve')).toBe('caf nave');
  });

  it('collapses repeated whitespace', () => {
    expect(cleanTextForTTS('a   b\tc\n\nd')).toBe('a b c d');
  });

  it('accepts array input and joins with commas before cleaning', () => {
    expect(cleanTextForTTS(['hello', 'world'])).toBe('hello, world');
  });

  it('coerces nullish input to an empty string', () => {
    expect(cleanTextForTTS(undefined)).toBe('');
    expect(cleanTextForTTS(null)).toBe('');
  });
});

describe('speakText', () => {
  it('speaks the cleaned text with en-US lang for 英 (voices already loaded)', () => {
    voices = [voice('US Voice', 'en-US')];
    speakText('英', 'hello <b>world</b>');
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text).toBe('hello world');
    expect(speakCalls[0].lang).toBe('en-US');
  });

  it('assigns the preferred EN voice (Samantha/Alex) when available', () => {
    voices = [voice('Fred', 'en-US'), voice('Compact Voice', 'en-US'), voice('Samantha', 'en-US'), voice('Alex', 'en-US')];
    speakText('英', 'hi');
    expect(speakCalls[0].voice?.name).toBe('Samantha');
  });

  it('falls back to en-US → en-GB → en-AU when no preferred voice is present', () => {
    voices = [voice('Google UK English', 'en-GB'), voice('AU Voice', 'en-AU'), voice('US Voice', 'en-US')];
    speakText('英', 'hi');
    expect(speakCalls[0].voice?.lang).toBe('en-US');
  });

  it('filters out Compact / Fred voices', () => {
    voices = [voice('Compact Bob', 'en-US'), voice('Fred', 'en-US'), voice('Good Voice', 'en-US')];
    speakText('英', 'hi');
    expect(speakCalls[0].voice?.name).toBe('Good Voice');
  });

  it('defers EN speak until voices load when getVoices() returns empty', () => {
    voices = [];
    speakText('英', 'hi');
    // No synchronous speak — handler registered for voiceschanged.
    expect(speakCalls).toHaveLength(0);
    expect(voicesChangedHandler).toBeTypeOf('function');
    // Fire voiceschanged with populated voices — then speak should happen.
    voices = [voice('Samantha', 'en-US')];
    voicesChangedHandler?.();
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].voice?.name).toBe('Samantha');
    expect(cancelCalls).toBe(1); // cancels the initial utterance before re-speaking
  });

  it('picks the preferred FR voice (Google fr-FR > fr-FR > fr-CA)', () => {
    voices = [voice('Google français', 'fr-FR'), voice('Amelie', 'fr-CA'), voice('Generic', 'fr-FR')];
    speakText('法', 'bonjour');
    expect(speakCalls[0].voice?.name).toBe('Google français');
  });

  it('defers FR speak until voiceschanged when getVoices() is empty', () => {
    voices = [];
    speakText('法', 'bonjour');
    expect(speakCalls).toHaveLength(0);
    voices = [voice('Amelie', 'fr-CA')];
    voicesChangedHandler?.();
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].voice?.lang).toBe('fr-CA');
  });

  it('speaks 德 entries with de-DE regardless of voice list', () => {
    voices = [voice('Anna', 'de-DE')];
    speakText('德', 'hallo');
    expect(speakCalls[0].lang).toBe('de-DE');
  });

  it('noops when speechSynthesis is unavailable (SSR-ish)', () => {
    uninstallSynthesis();
    expect(() => speakText('英', 'hi')).not.toThrow();
    expect(speakCalls).toHaveLength(0);
  });

  it('noops when the cleaned text is empty', () => {
    speakText('英', '<tag></tag>');
    expect(speakCalls).toHaveLength(0);
  });
});
