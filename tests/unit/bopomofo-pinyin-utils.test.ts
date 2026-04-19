import { describe, expect, it } from 'vitest';
import {
  formatBopomofo,
  formatPinyin,
  removeBopomofo,
  decorateRuby,
} from '../../src/utils/bopomofo-pinyin-utils';

describe('removeBopomofo', () => {
  it('strips the zhuyin block (U+3105-312F) and modifiers', () => {
    expect(removeBopomofo('萌ㄇㄥˊ')).toBe('萌');
    expect(removeBopomofo('ㄓㄥ字 ')).toBe('字 ');
  });

  it('keeps non-bopomofo characters', () => {
    expect(removeBopomofo('hello')).toBe('hello');
    expect(removeBopomofo('')).toBe('');
  });

  it('removes Hokkien-style tone marks (˙ˊˇˋ)', () => {
    expect(removeBopomofo('ㄓˊ')).toBe('');
  });
});

describe('formatBopomofo', () => {
  it('wraps tone marks in <span class="tone">…</span>', () => {
    expect(formatBopomofo('ㄇㄥˊ')).toBe('ㄇㄥ<span class="tone">ˊ</span>');
  });

  it('handles empty input', () => {
    expect(formatBopomofo('')).toBe('');
  });
});

describe('formatPinyin', () => {
  it('wraps Hanyu tone vowels in span.tone', () => {
    expect(formatPinyin('méng')).toBe('m<span class="tone">é</span>ng');
  });
});

describe('decorateRuby', () => {
  it("builds a ruby structure for 'a' lang from a title + bopomofo", () => {
    const result = decorateRuby({
      LANG: 'a',
      title: '萌',
      bopomofo: 'ㄇㄥˊ',
      pinyin: 'méng',
    });
    expect(result.ruby).toContain('<rb>');
    expect(result.ruby).toContain('萌');
    expect(result.ruby).toContain('ㄇㄥ');
    expect(result.ruby).toContain('méng');
    expect(result.bopomofo).toContain('ㄇㄥ');
    expect(result.pinyin).toContain('méng');
  });

  it('marks chinese-specific pronunciation (陸)', () => {
    const result = decorateRuby({
      LANG: 'c',
      title: '萌',
      bopomofo: 'ㄇㄥˊ<br>陸 ㄇㄥ',
      pinyin: 'méng<br>陸 meng',
    });
    expect(result.cnSpecific).toBe('cn-specific');
  });

  it('handles Taiwanese (t) with trs input', () => {
    const result = decorateRuby({
      LANG: 't',
      title: '食',
      trs: 'tsia̍h',
    });
    expect(result.ruby).toContain('食');
    expect(result.bopomofo.length).toBeGreaterThanOrEqual(0);
  });

  it('handles missing input gracefully (no crash)', () => {
    expect(() => decorateRuby({ LANG: 'a' })).not.toThrow();
  });

  it('clears bopomofo for Hakka (LANG=h)', () => {
    const result = decorateRuby({
      LANG: 'h',
      title: '字',
      bopomofo: 'ㄘˋ',
      pinyin: 'cii^',
    });
    // Hakka pipeline always blanks bopomofo (the zhuyin column isn't shown
    // for Hakka entries in the UI).
    expect(result.bopomofo).toBe('');
  });

  it('clears both bopomofo and pinyin for LANG=c without <br>', () => {
    const result = decorateRuby({
      LANG: 'c',
      title: '萌',
      bopomofo: 'ㄇㄥˊ',
      pinyin: 'méng',
    });
    // 兩岸詞典 only shows pronunciation for entries whose data carries a
    // Mainland-specific form (the `<br>陸…` block). Plain entries get blanked.
    expect(result.bopomofo).toBe('');
    expect(result.pinyin).toBe('');
  });

  it('extracts the Mainland pronunciation after <br> for LANG=c', () => {
    const result = decorateRuby({
      LANG: 'c',
      title: '萌',
      bopomofo: 'ㄇㄥˊ<br>陸 ㄇㄥ',
      pinyin: 'méng<br>陸 meng',
    });
    // The Mainland-form branch keeps content *after* <br>, stripped of the 陸
    // marker — non-empty output proves we took the `if (processedBopomofo.match(/<br>/))`
    // branch rather than the blanking else.
    expect(result.bopomofo.length).toBeGreaterThan(0);
    expect(result.pinyin.length).toBeGreaterThan(0);
    expect(result.bopomofo).not.toContain('<br>');
    expect(result.pinyin).not.toContain('<br>');
    expect(result.cnSpecific).toBe('cn-specific');
  });

  it('computes rbspan for Taiwanese (LANG=t) hyphenated trs', () => {
    // tsia̍h has no hyphen; use a compound like "tsia̍h-pn̄g" to exercise the
    // rbspan counting branch for LANG=t.
    const result = decorateRuby({
      LANG: 't',
      title: '食飯',
      trs: 'tsia̍h-pn̄g',
    });
    expect(result.ruby).toMatch(/rbspan="\d+"/);
  });
});
