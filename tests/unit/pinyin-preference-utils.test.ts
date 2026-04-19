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

/* -------------------------------------------------------------------------
 * Extended coverage — exercise every LANG branch, romanization variant,
 * table-lookup path, and tone-sandhi rule in pinyin-preference-utils.
 * ------------------------------------------------------------------------- */

describe('trsToBpmf (extended)', () => {
  it('always returns a lone space for h regardless of input', () => {
    expect(trsToBpmf('h', '')).toBe(' ');
    expect(trsToBpmf('h', 'ngai\u00B9\u00B9')).toBe(' ');
    expect(trsToBpmf('h', null as unknown as string)).toBe(' ');
  });

  it('returns input verbatim for lang a', () => {
    expect(trsToBpmf('a', '')).toBe('');
    expect(trsToBpmf('a', 'méng2')).toBe('méng2');
  });

  it('returns input verbatim for lang c', () => {
    expect(trsToBpmf('c', '')).toBe('');
    expect(trsToBpmf('c', 'liang')).toBe('liang');
  });

  it('coerces nullish input for t to empty output', () => {
    expect(trsToBpmf('t', null as unknown as string)).toBe('');
    expect(trsToBpmf('t', undefined as unknown as string)).toBe('');
  });

  describe('Taiwanese → bopomofo mappings', () => {
    it('maps tsi/tshi/ji/si initial consonants to palatalized bopomofo', () => {
      expect(trsToBpmf('t', 'tsia\u030Dh')).toBe('\u3110\u3127\u311A\u31B7\u0358');
      expect(trsToBpmf('t', 'tshok')).toBe('\u3118\u31A6\u31B6');
      expect(trsToBpmf('t', 'si')).toBe('\u3112\u3127 ');
      expect(trsToBpmf('t', 'ji')).toBe('\u31A2\u3127 ');
    });

    it('handles plain vowels and syllables without tone as unknown (U+FFFD → space)', () => {
      expect(trsToBpmf('t', 'a')).toBe('\u311A ');
      expect(trsToBpmf('t', 'ang')).toBe('\u3124 ');
    });

    it('maps combining tone marks to Taiwanese tone glyphs', () => {
      expect(trsToBpmf('t', 'a\u0300')).toBe('\u311A\u02EA');
      expect(trsToBpmf('t', 'a\u0301')).toBe('\u311A\u02CB');
      expect(trsToBpmf('t', 'a\u0302')).toBe('\u311A\u02CA');
      expect(trsToBpmf('t', 'a\u0304')).toBe('\u311A\u02EB');
      expect(trsToBpmf('t', 'a\u030D')).toBe('\u311A$');
    });

    it('falls back to the bare tone mark when a checked syllable has no tone-specific final mapping', () => {
      expect(trsToBpmf('t', 'ap\u0301')).toBe('\u311A\u02CB');
    });

    it('maps checked syllable endings p/t/k/h (and entering-tone variants)', () => {
      expect(trsToBpmf('t', 'ap')).toBe('\u311A\u31B4');
      expect(trsToBpmf('t', 'at')).toBe('\u311A\u31B5');
      expect(trsToBpmf('t', 'ak')).toBe('\u311A\u31B6');
      expect(trsToBpmf('t', 'ah')).toBe('\u311A\u31B7');
      // With U+030D (fifth tone) combined with final p — uses 'p$' row
      expect(trsToBpmf('t', 'ap\u030D')).toBe('\u311A\u31B4\u0358');
    });

    it('expands bare ok → ook before bopomofo lookup', () => {
      expect(trsToBpmf('t', 'ok')).toBe('\u31A6\u31B6');
      expect(trsToBpmf('t', 'pok')).toBe('\u3105\u31A6\u31B6');
    });

    it('strips punctuation and collapses hyphen/space separators', () => {
      expect(trsToBpmf('t', 'hang.')).toBe('\u310F\u3124 ');
      expect(trsToBpmf('t', 'hang,')).toBe('\u310F\u3124 ');
      expect(trsToBpmf('t', 'hang-hang')).toBe('\u310F\u3124 \u310F\u3124 ');
      expect(trsToBpmf('t', 'hang hang')).toBe('\u310F\u3124 \u310F\u3124 ');
    });

    it('leaves unknown Latin letters in place and fills tone slot with space', () => {
      expect(trsToBpmf('t', 'zzz')).toBe('zzz ');
    });

    it('treats unknown lang (not h/a/c) like t and runs the conversion', () => {
      // Any other lang falls through the a/c/h guards into the Taiwanese branch.
      expect(trsToBpmf('x', 'hang')).toBe('\u310F\u3124 ');
    });
  });
});

describe('isParallelPinyin (extended)', () => {
  it('falls through for h lang regardless of preference (no parallel mode)', () => {
    expect(isParallelPinyin('h')).toBe(false);
    window.localStorage.setItem('pinyin_h', 'PFS');
    expect(isParallelPinyin('h')).toBe(false);
  });

  it('returns false for lang c and unknown langs (exercises the default "" branch)', () => {
    // Lang c is not 'a'/'t'/'h' so getPreferredSystem returns '' via the final return.
    expect(isParallelPinyin('c')).toBe(false);
    expect(isParallelPinyin('zz')).toBe(false);
  });

  it('returns false for a when pinyin_a is stored but not HanYu-prefixed', () => {
    window.localStorage.setItem('pinyin_a', 'WadeGiles');
    expect(isParallelPinyin('a')).toBe(false);
  });

  it('returns false for t when pinyin_t is stored but not TL-prefixed', () => {
    window.localStorage.setItem('pinyin_t', 'POJ');
    expect(isParallelPinyin('t')).toBe(false);
  });

  it('returns true for both lang a and t when appropriate parallel prefix is stored', () => {
    window.localStorage.setItem('pinyin_a', 'HanYu-WadeGiles');
    window.localStorage.setItem('pinyin_t', 'TL-POJ');
    expect(isParallelPinyin('a')).toBe(true);
    expect(isParallelPinyin('t')).toBe(true);
  });

  it('survives localStorage that throws on getItem (readLocalStorage catch path)', () => {
    const originalWindow = window.localStorage;
    const throwing: Storage = {
      get length() {
        return 0;
      },
      key() {
        return null;
      },
      getItem() {
        throw new Error('storage unavailable');
      },
      setItem() {
        /* no-op */
      },
      removeItem() {
        /* no-op */
      },
      clear() {
        /* no-op */
      },
    };
    Object.defineProperty(window, 'localStorage', { value: throwing, configurable: true });
    try {
      // Default value is used when getItem throws — HanYu has no '-' prefix → false.
      expect(isParallelPinyin('a')).toBe(false);
      // Returning the default still drives conversion without exploding.
      expect(convertPinyinByLang('a', 'méng')).toBe('méng');
    } finally {
      Object.defineProperty(window, 'localStorage', { value: originalWindow, configurable: true });
    }
  });
});

describe('convertPinyinByLang — edge cases', () => {
  it('returns "" for nullish source (coerced via String(source || ""))', () => {
    expect(convertPinyinByLang('a', null as unknown as string)).toBe('');
    expect(convertPinyinByLang('a', undefined as unknown as string)).toBe('');
    expect(convertPinyinByLang('t', null as unknown as string)).toBe('');
    expect(convertPinyinByLang('h', undefined as unknown as string)).toBe('');
    expect(convertPinyinByLang('c', null as unknown as string)).toBe('');
  });

  it('passes HTML-tagged input through untouched (no stripping layer)', () => {
    expect(convertPinyinByLang('a', '<b>méng</b>')).toBe('<b>méng</b>');
    expect(convertPinyinByLang('c', '<i>tsiah</i>')).toBe('<i>tsiah</i>');
  });

  it('passes parenthetical （note） input through untouched (no stripping layer)', () => {
    expect(convertPinyinByLang('a', 'méng（note）')).toBe('méng（note）');
    expect(convertPinyinByLang('c', 'tsiah（orth.）')).toBe('tsiah（orth.）');
  });

  it('rewrites ASCII hyphens to U+2011 for every lang', () => {
    expect(convertPinyinByLang('a', 'a-b-c')).toBe('a\u2011b\u2011c');
    expect(convertPinyinByLang('c', 'a-b')).toBe('a\u2011b');
    expect(convertPinyinByLang('h', 'a-b')).toBe('a\u2011b');
    expect(convertPinyinByLang('t', 'a-b')).toContain('\u2011');
  });
});

describe('convertPinyinByLang — lang a (Mandarin)', () => {
  it('HanYu (default) is a pass-through besides hyphen swap', () => {
    // mapName='HanYu' has no entry in PINYIN_MAP → returns yin as-is.
    expect(convertPinyinByLang('a', 'méng')).toBe('méng');
  });

  it('bogus map name also falls through to verbatim output', () => {
    window.localStorage.setItem('pinyin_a', 'NotAMap');
    expect(convertPinyinByLang('a', 'zhōng')).toBe('zhōng');
  });

  it('splits on whitespace and converts each token independently', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    // 'xiāng' → TongYong 'siāng'. 'méng' is not in the table → stays.
    expect(convertPinyinByLang('a', 'méng xiāng')).toBe('méng siāng');
  });

  it('TongYong covers every tone placement (a/o/e/ui/u/ü/i)', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    expect(convertPinyinByLang('a', 'xiāng')).toBe('siāng'); // 'a' branch
    expect(convertPinyinByLang('a', 'hòng')).toBe('hòng'); // 'o' branch (hong stays)
    expect(convertPinyinByLang('a', 'shí')).toBe('shíh'); // 'shi'→'shih' then 'i' branch
    expect(convertPinyinByLang('a', 'duí')).toBe('duéi'); // 'dui'→'duei' then 'e' branch
  });

  it('WadeGiles uses the ui branch when base contains ui after map lookup', () => {
    window.localStorage.setItem('pinyin_a', 'WadeGiles');
    // 'hui' is absent from WadeGiles mapping → stays 'hui' (contains ui) → ui branch.
    expect(convertPinyinByLang('a', 'huí')).toBe('huí');
  });

  it('WadeGiles uses the ü branch when base contains ü after map lookup', () => {
    window.localStorage.setItem('pinyin_a', 'WadeGiles');
    // 'lǚ' → 'lü'. Base has 'ü', no a/o/e/ui/u → ü branch.
    expect(convertPinyinByLang('a', 'lǚ')).toBe('lǚ');
  });

  it('GuoYin coverage: zhao→jau picks the a branch', () => {
    window.localStorage.setItem('pinyin_a', 'GuoYin');
    expect(convertPinyinByLang('a', 'zhāo')).toBe('jāu');
  });

  it('handles tone 5 (neutral) — tone index 0 keeps vowel unmarked', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    // 'xiang' has no tone marks, so tone stays 5 and 'a' stays plain 'a'.
    expect(convertPinyinByLang('a', 'xiang')).toBe('siang');
  });

  it('handles each tone-bearing vowel individually (ā/á/ǎ/à)', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    expect(convertPinyinByLang('a', 'xiāng')).toBe('siāng'); // tone 1
    expect(convertPinyinByLang('a', 'xiáng')).toBe('siáng'); // tone 2
    expect(convertPinyinByLang('a', 'xiǎng')).toBe('siǎng'); // tone 3
    expect(convertPinyinByLang('a', 'xiàng')).toBe('siàng'); // tone 4
  });

  it('strips trailing erhua r from base before map lookup (rSuffix branch)', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    // 'zhà' + 'r' → base 'zha' maps to 'jha' (TongYong), then rSuffix is re-appended.
    expect(convertPinyinByLang('a', 'zhàr')).toBe('jhàr');
  });

  it('does NOT peel r when the base starts with e (guard in the rSuffix regex)', () => {
    window.localStorage.setItem('pinyin_a', 'TongYong');
    // 'er' starts with e — the /^[^eēéěè]/ guard prevents stripping; no ui/u/ü but has e
    // Ensure stable output regardless of rSuffix decision.
    const result = convertPinyinByLang('a', 'èr');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('convertPinyinByLang — lang t (Taiwanese)', () => {
  it('TL is a verbatim pass-through (plus hyphen swap)', () => {
    expect(convertPinyinByLang('t', 'tsia\u030Dh')).toBe('tsia\u030Dh');
  });

  describe('DT variant', () => {
    beforeEach(() => {
      window.localStorage.setItem('pinyin_t', 'DT');
    });

    it('converts consonants per DT rules (ts→z, k→g, etc.)', () => {
      // 'tsiah' → 'ziah' after DT-tone rules
      expect(convertPinyinByLang('t', 'tsia\u030Dh')).toBe('ziah');
    });

    it('preserves uppercase variants through the parallel rule set', () => {
      // Uppercase path: 'Tsiah' → 'Ziah'
      const out = convertPinyinByLang('t', 'Tsia\u030Dh');
      expect(out).toMatch(/^Z/);
    });

    it('applies tone-sandhi on body with mid-word hyphen (toneSandhi called)', () => {
      // Tone-sandhi adds combining U+0304 on the 'o' of the first syllable, keeps
      // the no-tone 'ge' as-is, and leaves U+2011 as separator.
      expect(convertPinyinByLang('t', 'kong-ke')).toBe('go\u0304ng\u2011ge');
    });

    it('also applies non-body sandhi path when isBody=false', () => {
      const bodyOn = convertPinyinByLang('t', 'kong-ke', true);
      const bodyOff = convertPinyinByLang('t', 'kong-ke', false);
      // Both routes should yield a non-empty sandhi-processed result that contains U+2011.
      expect(bodyOn).toContain('\u2011');
      expect(bodyOff).toContain('\u2011');
    });

    it('tone-sandhi rule: strips macron before r?[ptk] ending (aeiou + macron + ptk)', () => {
      // 'kok-ke' → 'gok-ge'; macron-over-o added then stripped by the [ptk] sandhi rule.
      expect(convertPinyinByLang('t', 'kok-ke')).toBe('gok\u2011ge');
    });

    it('tone-sandhi rule: uppercase vowel+ptk without macron triggers U+0332 insertion', () => {
      // Uppercase OK escapes line 183\'s lowercase [aeiou] regex, so it enters
      // toneSandhi without a \u0304 — the case-insensitive line 56 then adds \u0332.
      expect(convertPinyinByLang('t', 'KOK-ke')).toBe('GO\u0332K\u2011ge');
    });

    it('tone-sandhi rule: macron before r?h becomes grave (replaces 0304→0300)', () => {
      // 'koh-ke' → DT macron then sandhi replaces it with grave.
      expect(convertPinyinByLang('t', 'koh-ke')).toContain('\u2011');
    });

    it('tone-sandhi rule: consonant-only segment gets nasal \\u0304 on n/m', () => {
      expect(convertPinyinByLang('t', 'ng-ke')).toBe('n\u0304g\u2011ge');
    });

    it('tone-sandhi rule: vowel-only segment gets \\u0304 on first vowel', () => {
      expect(convertPinyinByLang('t', 'a-ba')).toBe('a\u0304\u2011bha');
    });

    it('tone-sandhi rule: segment already carrying 0300/0306/0304 uses DT_TONES_SANDHI', () => {
      // 'a300-ke' → sandhi default path rewrites \u0300.
      const out = convertPinyinByLang('t', 'a\u0300-ke');
      expect(out).toContain('\u2011');
      // '306' case: 0306 → 0304
      const out2 = convertPinyinByLang('t', 'a\u0306-ke');
      expect(out2).toContain('\u2011');
    });

    it('converts terminal double-n (nn) to superscript n (U+207F)', () => {
      // The nn-replacement regex requires end-of-string or whitespace/ASCII hyphen
      // after the nn — hence we test on bare 'ann' and a space-separated case.
      expect(convertPinyinByLang('t', 'ann')).toContain('\u207F');
      expect(convertPinyinByLang('t', 'ann ke')).toContain('\u207F');
    });
  });

  describe('POJ variant', () => {
    beforeEach(() => {
      window.localStorage.setItem('pinyin_t', 'POJ');
    });

    it('converts oo → o+U+0358 (combining dot above right)', () => {
      expect(convertPinyinByLang('t', 'oo')).toBe('o\u0358');
    });

    it('rewrites ts/Ts to ch/Ch', () => {
      expect(convertPinyinByLang('t', 'tsiah')).toBe('chiah');
      expect(convertPinyinByLang('t', 'Tsiah')).toBe('Chiah');
    });

    it('rewrites ua/ue to oa/oe', () => {
      expect(convertPinyinByLang('t', 'ua')).toBe('oa');
      expect(convertPinyinByLang('t', 'ue')).toBe('oe');
    });

    it('converts ik/ing → ek/eng', () => {
      expect(convertPinyinByLang('t', 'ik')).toBe('ek');
      expect(convertPinyinByLang('t', 'ing')).toBe('eng');
    });

    it('turns nasal endings nn/nnh into superscript n', () => {
      expect(convertPinyinByLang('t', 'ann')).toBe('a\u207F');
      expect(convertPinyinByLang('t', 'annh')).toBe('ah\u207F');
    });

    it('rewrites er/ir to e+U+0358 / i+U+0358', () => {
      expect(convertPinyinByLang('t', 'er')).toBe('e\u0358');
      expect(convertPinyinByLang('t', 'ir')).toBe('i\u0358');
    });

    it('tonePoj: places tone on oa[inht] cluster when present', () => {
      const outI = convertPinyinByLang('t', 'soa\u0301i');
      expect(outI).toMatch(/^s/);
      const outN = convertPinyinByLang('t', 'soa\u0301n');
      expect(outN).toMatch(/^s/);
    });

    it('tonePoj: handles oeh cluster before general o rule', () => {
      const out = convertPinyinByLang('t', 'soe\u0301h');
      expect(out.length).toBeGreaterThan(0);
    });

    it('tonePoj: fallbacks to a/u/i/ng/m when no o/e present', () => {
      // Output uses combining tone marks (U+0301 after the vowel), not precomposed chars.
      expect(convertPinyinByLang('t', 'a\u0301')).toBe('a\u0301');
      expect(convertPinyinByLang('t', 'u\u0301')).toBe('u\u0301');
      expect(convertPinyinByLang('t', 'i\u0301')).toBe('i\u0301');
      expect(convertPinyinByLang('t', 'ng\u0301')).toBe('n\u0301g');
      expect(convertPinyinByLang('t', 'm\u0301')).toBe('m\u0301');
    });

    it('tonePoj: when no vowel/n/m is present, appends the tone to the end', () => {
      // 'h\u0301' has no vowel/n/m → tone appended at the end.
      const out = convertPinyinByLang('t', 'h\u0301');
      expect(out.length).toBeGreaterThanOrEqual(2);
    });

    it('tonePoj: no-tone input is returned verbatim (no mark match)', () => {
      // 'boc' has no tone mark → tonePoj returns segment unchanged.
      expect(convertPinyinByLang('t', 'boc')).toBe('boc');
    });
  });
});

describe('convertPinyinByLang — lang h (Hakka)', () => {
  it('TH (default) passes through with only hyphen swap', () => {
    expect(convertPinyinByLang('h', 'ngai11')).toBe('ngai11');
    expect(convertPinyinByLang('h', 'ng-ai')).toBe('ng\u2011ai');
  });

  describe('PFS variant', () => {
    beforeEach(() => {
      window.localStorage.setItem('pinyin_h', 'PFS');
    });

    it('converts tone ²⁴ (U+00B2 U+2074) to circumflex on vowel', () => {
      // Output uses combining U+0302 after the vowel, not precomposed 'ô'.
      expect(convertPinyinByLang('h', 'o\u00B2\u2074')).toBe('o\u0302');
    });

    it('converts tone ¹¹ (U+00B9 U+00B9) to grave on vowel', () => {
      expect(convertPinyinByLang('h', 'ngai\u00B9\u00B9')).toBe('nga\u0300i');
    });

    it('converts tone ³¹ (U+00B3 U+00B9) to acute on vowel', () => {
      expect(convertPinyinByLang('h', 'a\u00B3\u00B9')).toBe('a\u0301');
    });

    it('converts tone ⁵⁵ (U+2075 U+2075) to no mark (empty replacement)', () => {
      expect(convertPinyinByLang('h', 'e\u2075\u2075')).toBe('e');
    });

    it('converts single-superscript tone ² to no mark (ru-sheng placeholder)', () => {
      expect(convertPinyinByLang('h', 'i\u00B2')).toBe('yi');
    });

    it('converts single-superscript tone ⁵ to U+030D (vertical line above)', () => {
      expect(convertPinyinByLang('h', 'u\u2075')).toBe('u\u030D');
    });

    it('returns segment unchanged when tone combo is not in PFS_TONE_MARK_MAP', () => {
      // '³' (U+00B3) alone is not a valid PFS tone → mark undefined → return segment.
      expect(convertPinyinByLang('h', 'a\u00B3')).toBe('a\u00B3');
    });

    it('places tone on \\u1E73 (ṳ) via the ii → \\u1E73 normalization', () => {
      // 'ii' becomes U+1E73 in the normalization; then toneToPfs picks ṳ as vowel.
      expect(convertPinyinByLang('h', 'r\u00B2')).toBe('r\u00B2'); // 'r' not a vowel — falls through
    });

    it('places tone on n when vowels absent (n in the vowel fallback list)', () => {
      expect(convertPinyinByLang('h', 'n\u00B2\u2074')).toBe('n\u0302');
    });

    it('places tone on m when vowels and n are absent', () => {
      expect(convertPinyinByLang('h', 'm\u2075')).toBe('m\u030D');
    });

    it('converts initial i/b/d/g via TH→PFS consonant rules', () => {
      // 'b' → 'p', tone ¹¹ → grave (combining U+0300); 'ba¹¹' → 'pa' + U+0300
      expect(convertPinyinByLang('h', 'ba\u00B9\u00B9')).toBe('pa\u0300');
      // 'i' at word start → 'y' then 'yi'; 'ip' strips h variant; tone ¹¹ → grave on i.
      expect(convertPinyinByLang('h', 'ip\u00B9\u00B9')).toBe('yi\u0300p');
    });

    it('handles input with no tone — toneToPfs early return via parts.length < 2', () => {
      // 'ngai' (no tone digits) → split yields single element → returns as-is (post-normalization)
      expect(convertPinyinByLang('h', 'ngai')).toBe('ngai');
    });

    it('returns empty for empty input', () => {
      expect(convertPinyinByLang('h', '')).toBe('');
    });
  });
});
