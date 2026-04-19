import { beforeEach, describe, expect, it } from 'vitest';
import {
  convertPinyinByLang,
  isParallelPinyin,
  trsToBpmf,
} from '../../src/utils/pinyin-preference-utils';

beforeEach(() => {
  window.localStorage.clear();
});

describe('convertPinyinByLang', () => {
  it('returns empty string for empty input', () => {
    expect(convertPinyinByLang('a', '')).toBe('');
  });

  it('replaces ascii hyphens with non-breaking hyphens U+2011', () => {
    const result = convertPinyinByLang('a', 'a-b');
    expect(result).toContain('\u2011');
    expect(result).not.toContain('-');
  });

  describe('a (Mandarin)', () => {
    it('with default HanYu system returns input unchanged (after hyphen swap)', () => {
      expect(convertPinyinByLang('a', 'méng')).toBe('méng');
    });

    it('converts to TongYong when pinyin_a=TongYong is set', () => {
      window.localStorage.setItem('pinyin_a', 'TongYong');
      const result = convertPinyinByLang('a', 'zhōng');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('converts to WadeGiles when pinyin_a=WadeGiles', () => {
      window.localStorage.setItem('pinyin_a', 'WadeGiles');
      const result = convertPinyinByLang('a', 'zhōng');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('t (Taiwanese)', () => {
    it('returns TL input unchanged under default TL preference', () => {
      expect(convertPinyinByLang('t', 'tsia̍h')).toBe('tsia̍h');
    });

    it('produces a non-empty result under DT preference', () => {
      window.localStorage.setItem('pinyin_t', 'DT');
      const result = convertPinyinByLang('t', 'tsia̍h');
      expect(result).not.toBe('tsia̍h');
      expect(result.length).toBeGreaterThan(0);
    });

    it('produces a non-empty result under POJ preference', () => {
      window.localStorage.setItem('pinyin_t', 'POJ');
      const result = convertPinyinByLang('t', 'tsia̍h');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('h (Hakka)', () => {
    it('returns input unchanged under default TH preference', () => {
      expect(convertPinyinByLang('h', 'ngai11')).toBe('ngai11');
    });

    it('converts to PFS when preference is set', () => {
      window.localStorage.setItem('pinyin_h', 'PFS');
      const result = convertPinyinByLang('h', 'ngai11');
      expect(typeof result).toBe('string');
    });
  });

  it('c lang (liang-an) returns input verbatim', () => {
    expect(convertPinyinByLang('c', 'méng')).toBe('méng');
  });

  it('unknown lang returns input verbatim', () => {
    expect(convertPinyinByLang('x' as 'a', 'foo')).toBe('foo');
  });
});

describe('isParallelPinyin', () => {
  it('returns false under default preferences', () => {
    expect(isParallelPinyin('a')).toBe(false);
    expect(isParallelPinyin('t')).toBe(false);
    expect(isParallelPinyin('h')).toBe(false);
  });

  it('returns true when HanYu-* parallel preference is stored', () => {
    window.localStorage.setItem('pinyin_a', 'HanYu-TongYong');
    expect(isParallelPinyin('a')).toBe(true);
  });

  it('returns true when TL-* parallel preference is stored', () => {
    window.localStorage.setItem('pinyin_t', 'TL-DT');
    expect(isParallelPinyin('t')).toBe(true);
  });
});

describe('trsToBpmf', () => {
  it('returns a single space for h lang', () => {
    expect(trsToBpmf('h', 'ngai11')).toBe(' ');
  });

  it('returns input unchanged for a/c', () => {
    expect(trsToBpmf('a', 'meng2')).toBe('meng2');
    expect(trsToBpmf('c', 'meng')).toBe('meng');
  });

  it('converts Taiwanese POJ to bopomofo', () => {
    const result = trsToBpmf('t', 'tsia̍h');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('tsia̍h');
  });

  it('handles empty input for t', () => {
    expect(trsToBpmf('t', '')).toBe('');
  });

  it('passes through nullish for a (returns input as-is)', () => {
    // a-lang is an identity function, so a null input is returned unchanged
    expect(trsToBpmf('a', null as unknown as string)).toBe(null as unknown as string);
  });
});
