/**
 * Direct-call coverage for the `/raw/{word}.json`, `/uni/{word}.json`, and
 * `/pua/{word}.json` handler family inside `handleDictionaryAPI`, plus the
 * `handleLanguageSubRoute` branches (@radical + =list + bucket 404) that
 * were previously unreachable from `tests/unit/api-handlers-direct.test.ts`.
 *
 * Also exercises the full converter pipeline that sits behind those three
 * routes (`convertDictionaryStructure` / `cleanRawData` / `convertPuaTo{IDS,CharCode}`
 * / `addBopomofo2` / `stripAudioIdAndShape` / the PUA string manipulation
 * inside `convertToPuaFormat`), so the coverage-by-direct-call approach
 * lights up the same code paths that Miniflare integration tests hit.
 *
 * Follows the `makeR2` / `makeRequest` stub pattern from
 * `tests/unit/api-handlers-direct.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  addBopomofo2,
  bucketOf,
  handleDictionaryAPI,
  lookupDictionaryEntry,
  performFuzzySearch,
  stripAudioIdAndShape,
} from '../../src/api/handleDictionaryAPI';

interface R2Stub {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
}

function makeR2(entries: Record<string, string>): R2Stub {
  return {
    async get(key) {
      const payload = entries[key];
      if (payload === undefined) return null;
      return { text: async () => payload };
    },
  };
}

function makeRequest(pathname: string, init?: RequestInit): { request: Request; url: URL } {
  const url = new URL(`http://localhost${pathname}`);
  return { request: new Request(url.toString(), init), url };
}

function makeEnv(entries: Record<string, string>): { DICTIONARY: R2Stub } {
  return { DICTIONARY: makeR2(entries) };
}

// 萌 is the anchor fixture word: codepoint 0x840C → bucket (0x840C % 1024) = 12,
// escape()-key = %u840C. `bucketOf` is re-run below to keep the two in sync
// in case the bucketing formula ever changes.
const BUCKET_KEY = bucketOf('萌', 'a'); // '12'
const BUCKET_PATH = `pack/${BUCKET_KEY}.txt`;
const ESCAPED_KEY = escape('萌'); // '%u840C'

// Real-world PUA codepoints used by the dictionary:
// - 0xF9264: definition-internal marker that the /pua route round-trips
// - 0xF9064: likewise, round-trips through /pua only
// - 0xF8FF0: maps to '⿰亻壯' via PUA_TO_IDS_MAP (covered by /uni)
// - 0xF9868: maps to '⿱禾千'
const PUA_F9264 = String.fromCodePoint(0xf9264);
const PUA_F9064 = String.fromCodePoint(0xf9064);
const PUA_F8FF0 = String.fromCodePoint(0xf8ff0);
const PUA_F9868 = String.fromCodePoint(0xf9868);

function makePackEntry(heteronyms: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  return {
    t: '萌',
    c: 12,
    r: '艸',
    h: heteronyms,
    ...extra,
  };
}

function makeBucketJson(entry: Record<string, unknown>): string {
  return JSON.stringify({ [ESCAPED_KEY]: entry });
}

describe('bucketOf sanity guard for 萌', () => {
  // If this ever fails, the other tests in this file are wiring the wrong
  // bucket path. The task brief explicitly called out verifying this.
  it('lands 萌 in bucket 12 for lang "a"', () => {
    expect(BUCKET_KEY).toBe('12');
    expect(ESCAPED_KEY).toBe('%u840C');
  });
});

describe('/raw/{word}.json → convertToRawFormat', () => {
  it('expands compact keys, adds bopomofo2, strips audio_id, and encodes PUA as {[hex]}', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson(
        makePackEntry([
          {
            b: 'ㄇㄥˊ',
            '=': 'audio-should-be-stripped',
            d: [
              { f: `前${PUA_F9264}後` },
              { f: `周${PUA_F9064}圍` },
            ],
          },
        ]),
      ),
    });
    const { request, url } = makeRequest('/raw/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      title?: unknown;
      heteronyms: Array<Record<string, unknown>>;
    };
    expect(body.title).toBe('萌');
    expect(Array.isArray(body.heteronyms)).toBe(true);

    const het = body.heteronyms[0];
    // addBopomofo2 wrote the romanised form onto the heteronym.
    expect(het.bopomofo).toBe('ㄇㄥˊ');
    expect(typeof het.bopomofo2).toBe('string');
    expect((het.bopomofo2 as string).length).toBeGreaterThan(0);
    // stripAudioIdAndShape removed the audio_id field.
    expect(het).not.toHaveProperty('audio_id');
    // convertPuaToCharCode encoded both PUA glyphs into {[hex]} notation.
    const defs = het.definitions as Array<{ def: string }>;
    expect(defs[0].def).toContain('{[9264]}');
    expect(defs[0].def).not.toContain(PUA_F9264);
    expect(defs[1].def).toContain('{[9064]}');
    expect(defs[1].def).not.toContain(PUA_F9064);
  });

  it('returns 404 when the word is unknown in the raw bucket', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/raw/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; terms?: string[] };
    expect(body.error).toBe('Not Found');
  });
});

describe('/uni/{word}.json → convertToUniFormat', () => {
  it('expands PUA glyphs to IDS (ideographic description sequences)', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson(
        makePackEntry([
          {
            b: 'ㄓㄨㄤˋ',
            d: [
              { f: `包含${PUA_F8FF0}字形` },
              { f: `也有${PUA_F9868}另一個` },
            ],
          },
        ]),
      ),
    });
    const { request, url } = makeRequest('/uni/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      title?: unknown;
      heteronyms: Array<Record<string, unknown>>;
    };
    expect(body.title).toBe('萌');
    const het = body.heteronyms[0];
    const defs = het.definitions as Array<{ def: string }>;
    expect(defs[0].def).toContain('⿰亻壯');
    expect(defs[0].def).not.toContain(PUA_F8FF0);
    expect(defs[1].def).toContain('⿱禾千');
    expect(defs[1].def).not.toContain(PUA_F9868);
  });

  it('returns 404 when the word is missing from the bucket', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/uni/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
  });
});

describe('/pua/{word}.json → convertToPuaFormat', () => {
  it('decodes {[9264]} and {[9064]} literal markers back to PUA codepoints', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson(
        makePackEntry([
          {
            b: 'ㄇㄥˊ',
            d: [
              { f: '前{[9264]}後 — 另有 {[9064]} 標記' },
            ],
          },
        ]),
      ),
    });
    const { request, url } = makeRequest('/pua/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      title?: unknown;
      heteronyms: Array<Record<string, unknown>>;
    };
    expect(body.title).toBe('萌');
    const het = body.heteronyms[0];
    const defs = het.definitions as Array<{ def: string }>;
    expect(defs[0].def).toContain(PUA_F9264);
    expect(defs[0].def).toContain(PUA_F9064);
    expect(defs[0].def).not.toContain('{[9264]}');
    expect(defs[0].def).not.toContain('{[9064]}');
  });

  it('returns 404 when the word is missing from the bucket', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/pua/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
  });
});

describe('/{a|t|h|c}/{word}.json sub-route handler — branches beyond the happy path', () => {
  // These tests hit the `handleLanguageSubRoute` branches that
  // tests/unit/api-handlers-direct.test.ts does NOT cover:
  //   * @radical lookup inside the sub-route (not the /api/@… form)
  //   * @青 / @靑 variant fallback inside the sub-route
  //   * =list lookup inside the sub-route
  //   * 404 when the bucket does not contain the requested word
  //   * 404 when @radical and =list targets are missing

  it('serves /a/@子.json via the sub-route @radical branch', async () => {
    const env = makeEnv({
      'a/@子.json': JSON.stringify([['孜', '孟']]),
    });
    const { request, url } = makeRequest('/a/%40%E5%AD%90.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([['孜', '孟']]);
  });

  it('falls back to @靑.json when /a/@青.json is missing', async () => {
    const env = makeEnv({
      'a/@靑.json': JSON.stringify([['青']]),
    });
    const { request, url } = makeRequest('/a/%40%E9%9D%92.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([['青']]);
  });

  it('falls back to @青.json when /a/@靑.json is missing', async () => {
    const env = makeEnv({
      'a/@青.json': JSON.stringify([['靑']]),
    });
    const { request, url } = makeRequest('/a/%40%E9%9D%91.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([['靑']]);
  });

  it('404s via the sub-route @radical branch when neither variant exists', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/a/%40%E6%9C%A8.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not Found');
  });

  it('serves /a/=成語.json via the sub-route =list branch', async () => {
    const env = makeEnv({
      'a/=成語.json': JSON.stringify(['守株待兔', '畫蛇添足']),
    });
    const { request, url } = makeRequest('/a/=%E6%88%90%E8%AA%9E.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(['守株待兔', '畫蛇添足']);
  });

  it('404s via the sub-route =list branch when the category is missing', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/a/=missing.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not Found');
  });

  it('404s via the sub-route bucket path when the word is unknown', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/a/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not Found');
  });

  // NOTE: handleSubRouteAPI's `catch (error)` block (lines 152-157) is
  // unreachable for async R2 rejections because the inner handlers are
  // returned without `await` — the rejection propagates past the try/catch
  // and all the way up to handleDictionaryAPI itself. That behaviour is
  // exercised by `tests/unit/api-handlers-direct.test.ts` ("returns 500
  // when the R2 backend throws unexpectedly") via the top-level path.
});

describe('getCrossReferences branches', () => {
  // Line 710 of handleDictionaryAPI.ts is the `return []` inside
  // `if (!xrefObject)` — exercised when a word lookup succeeds but the
  // xref JSON file is absent. The subsequent `catch` branch is already
  // covered by tests/unit/api-handlers-direct.test.ts ("swallows malformed
  // xref JSON"); we also exercise it here with unparsable bytes for belt
  // and braces, so both sides of the if/catch around the JSON parse are
  // hit by this file alone.

  it('returns [] (line 710) when the xref file is absent', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      // no 'a/xref.json' seeded
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result).toBeTruthy();
    expect(result?.xrefs).toEqual([]);
  });

  it('catches unparsable xref JSON bytes and returns []', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      // seeded with bytes that JSON.parse will throw on
      'a/xref.json': '<<< not valid JSON >>>',
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result).toBeTruthy();
    expect(result?.xrefs).toEqual([]);
  });

  it('skips xref entries for the target word when word data is empty', async () => {
    // Covers the `if (!wordData) continue` branch (line 719)
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      'a/xref.json': JSON.stringify({
        t: { '其他字': '不相關' }, // no entry for 萌
      }),
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result?.xrefs).toEqual([]);
  });

  it('handles xref word-data that is already an array', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      'a/xref.json': JSON.stringify({
        t: { 萌: ['發穎', '初生'] },
      }),
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result?.xrefs).toEqual([{ lang: 't', words: ['發穎', '初生'] }]);
  });

  it('splits comma-separated xref strings into a word list', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      'a/xref.json': JSON.stringify({
        t: { 萌: '發穎, 初生 , 始生' },
      }),
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result?.xrefs).toEqual([{ lang: 't', words: ['發穎', '初生', '始生'] }]);
  });

  it('skips xref groups whose target lang is not a/t/h/c', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', h: [{ b: 'ㄇㄥˊ', d: [{ f: '草芽' }] }] }),
      'a/xref.json': JSON.stringify({
        garbage: { 萌: ['不應出現'] },
      }),
    });
    const result = await lookupDictionaryEntry('萌', 'a', env);
    expect(result?.xrefs).toEqual([]);
  });
});

describe('addBopomofo2 — tone + vowel-pick branch coverage', () => {
  // applyTone (inner helper) has a waterfall of `includes()` checks for
  // a / o / e / iu / ui / u / i / ü. Each branch needs both a "present"
  // and "absent" hit for branch coverage to light up; we feed it bopomofo
  // syllables that decompose into each of those vowel shapes.

  it('tone=ˊ with a (`ma´`) applies to the first `a` vowel', () => {
    // ㄇㄚ → ma; tone ˊ → má
    const [result] = addBopomofo2([{ bopomofo: 'ㄇㄚˊ' }]);
    expect(result.bopomofo2).toBe('má');
  });

  it('tone=ˇ with a yields the carón (hǎi)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄏㄞˇ' }]);
    expect(result.bopomofo2).toBe('hǎi');
  });

  it('tone=ˋ with a yields the grave (dà)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄚˋ' }]);
    expect(result.bopomofo2).toBe('dà');
  });

  it('neutral tone (˙) is returned unchanged', () => {
    // tone === '˙' takes the early-return path in applyTone
    const [result] = addBopomofo2([{ bopomofo: 'ㄇㄚ˙' }]);
    expect(result.bopomofo2).toBe('ma');
  });

  it('no tone mark is returned unchanged', () => {
    // tone === '' path (!tone)
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄚ' }]);
    expect(result.bopomofo2).toBe('da');
  });

  it('o branch: ㄉㄛˊ → dó (no `a`, has `o`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄛˊ' }]);
    expect(result.bopomofo2).toBe('dó');
  });

  it('e branch: ㄉㄜˇ → dě (no `a`/`o`, has `e`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄜˇ' }]);
    expect(result.bopomofo2).toBe('dě');
  });

  it('iu branch: ㄉㄧㄨˊ → diú (has `iu` substring, not `a`/`o`/`e`)', () => {
    // Bopomofo ㄧ + ㄨ is two separate replacements (i then u), producing "iu"
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄧㄨˊ' }]);
    expect(result.bopomofo2).toBe('diú');
  });

  it('ui branch: ㄉㄨㄧˇ → duǐ (has `ui` substring, skips `iu`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄨㄧˇ' }]);
    expect(result.bopomofo2).toBe('duǐ');
  });

  it('u branch: ㄉㄨˊ → dú (only `u`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄨˊ' }]);
    expect(result.bopomofo2).toBe('dú');
  });

  it('i branch: ㄉㄧˊ → dí (only `i`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄧˊ' }]);
    expect(result.bopomofo2).toBe('dí');
  });

  it('ü branch: ㄋㄩˊ → nǘ (only `ü`)', () => {
    const [result] = addBopomofo2([{ bopomofo: 'ㄋㄩˊ' }]);
    expect(result.bopomofo2).toBe('nǘ');
  });

  it('applies the shiou→shiōu start-replacement before applying tone', () => {
    // ㄒㄧㄡ → shiou → shiōu (iou→iōu at line 637)
    // applyTone then falls through to the `u` branch (no a/o/e/iu/ui).
    const [result] = addBopomofo2([{ bopomofo: 'ㄒㄧㄡˊ' }]);
    expect(typeof result.bopomofo2).toBe('string');
    expect((result.bopomofo2 as string).includes('ō')).toBe(true);
  });

  it('rewrites trailing `ao` → `au` (line 634-635)', () => {
    // ㄉㄠ → `d` + `ao` = `dao`. After the endsWith-`ao` rewrite → `dau`.
    // Tone ˊ then applies to the `a` (still present), giving `dáu`.
    const [result] = addBopomofo2([{ bopomofo: 'ㄉㄠˊ' }]);
    expect(result.bopomofo2).toBe('dáu');
  });

  it('handles multi-syllable bopomofo (space-separated)', () => {
    // Exercises the `.map(syl)` path + the joiner at the end
    const [result] = addBopomofo2([{ bopomofo: 'ㄇㄥˊ ㄧㄚˊ' }]);
    expect(typeof result.bopomofo2).toBe('string');
    expect((result.bopomofo2 as string).split(' ').length).toBe(2);
  });

  it('gracefully handles empty syllables from leading whitespace', () => {
    // ' ㄇㄚˊ'.split(/\s+/) → ['', 'ㄇㄚˊ'] — the empty entry hits the
    // `if (!syl) return ''` branch inside the syllable map.
    const [result] = addBopomofo2([{ bopomofo: ' ㄇㄚˊ' }]);
    expect(typeof result.bopomofo2).toBe('string');
  });

  it('returns syllable unchanged when no vowels match (applyTone fallback, line 595)', () => {
    // 'ㄅ' (consonant only) after all replacements is 'b' — no a/o/e/i/u/ü,
    // so applyTone falls through to the final `return syllable`.
    const [result] = addBopomofo2([{ bopomofo: 'ㄅˊ' }]);
    expect(result.bopomofo2).toBe('b');
  });

  it('returns heteronym unchanged when bopomofo is missing', () => {
    const input = [{ definitions: [{ def: 'no-bopomofo' }] }];
    const [result] = addBopomofo2(input);
    expect(result).toEqual(input[0]);
    expect(result).not.toHaveProperty('bopomofo2');
  });

  it('returns heteronym unchanged when bopomofo is the empty string', () => {
    const input = [{ bopomofo: '' }];
    const [result] = addBopomofo2(input);
    expect(result).toEqual(input[0]);
    expect(result).not.toHaveProperty('bopomofo2');
  });

  it('returns heteronym unchanged when bopomofo is not a string', () => {
    const input = [{ bopomofo: 12345 as unknown as string }];
    const [result] = addBopomofo2(input);
    expect(result).toEqual(input[0]);
    expect(result).not.toHaveProperty('bopomofo2');
  });
});

describe('stripAudioIdAndShape non-object guard', () => {
  // Reachable via /raw on a pack entry that has no heteronyms array —
  // convertDictionaryStructure still returns an object (so we hit the
  // `Array.isArray(converted.heteronyms) ? ... : []` guard), and the
  // whole pipeline terminates at stripAudioIdAndShape with `heteronyms: []`.

  it('/raw on an entry without heteronyms returns heteronyms: []', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', c: 12, r: '艸' }),
    });
    const { request, url } = makeRequest('/raw/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title?: unknown; heteronyms: unknown[] };
    expect(body.title).toBe('萌');
    expect(body.heteronyms).toEqual([]);
  });
});

describe('top-level /api/{word}.json — processed-entry happy path + fuzzy fallback', () => {
  // These tests hit the `/api/萌.json` form (no lang prefix in the path),
  // which routes via `handleDictionaryAPI` → `lookupDictionaryEntry` →
  // `processDictionaryEntry`, and specifically covers:
  //   * line 115 — `return jsonResponse(request, processedEntry, 200)`
  //   * lines 429-437 — each optional-field copy in processDictionaryEntry
  //   * lines 105-110 — the `terms.length === 0` fuzzy-search fallback
  //   * the `handleRadicalLookup` and `handleListLookup` 404 branches

  it('serves /api/萌.json via the top-level entry path and copies every field', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({
        t: '萌',
        Deutsch: 'Keimen',
        English: 'to sprout',
        francais: 'germer',
        r: '艸',
        c: 8,
        n: 4,
        translation: { Deutsch: ['keimen'] },
        h: [{ b: 'ㄇㄥˊ', d: [{ f: '發芽' }] }],
      }),
    });
    const { request, url } = makeRequest('/api/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    // processDictionaryEntry copied each optional field:
    expect(body.Deutsch).toBe('Keimen');
    expect(body.English).toBe('to sprout');
    expect(body.francais).toBe('germer');
    expect(body.heteronyms).toBeDefined();
    expect(body.radical).toBe('艸');
    expect(body.stroke_count).toBe(8);
    expect(body.non_radical_stroke_count).toBe(4);
    expect(body.title).toBe('萌');
    expect(body.translation).toEqual({ Deutsch: ['keimen'] });
  });

  it('uses lowercase `english` alias when `English` is absent (line 430 both-arms)', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({
        t: '萌',
        english: 'to sprout',
        h: [{ b: 'ㄇㄥˊ', d: [{ f: 'x' }] }],
      }),
    });
    const { request, url } = makeRequest('/api/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    const body = await res.json() as Record<string, unknown>;
    // decodeLangPart inserts ZWSP after closing parens, so tolerate that.
    expect(typeof body.English).toBe('string');
    expect((body.English as string).startsWith('to sprout')).toBe(true);
  });

  it('returns 404 with empty terms when fuzzy search yields nothing (lines 105-110)', async () => {
    const env = makeEnv({});
    // performFuzzySearch("") returns [], so the terms.length === 0 branch fires.
    const { request, url } = makeRequest('/api/.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; terms: string[] };
    expect(body.error).toBe('Not Found');
    expect(body.terms).toEqual([]);
  });

  it('/api/@木.json returns 404 when no radical variant exists (lines 371-375)', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/api/%40%E6%9C%A8.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not Found');
  });

  it('/api/@靑.json falls back to @青.json in the top-level handler (line 367)', async () => {
    const env = makeEnv({
      'a/@青.json': JSON.stringify([['靑']]),
    });
    const { request, url } = makeRequest('/api/%40%E9%9D%91.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([['靑']]);
  });

  it('/api/=missing.json returns 404 when the list target does not exist (lines 392-396)', async () => {
    const env = makeEnv({});
    const { request, url } = makeRequest('/api/=missing.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not Found');
  });
});

describe('fillBucket — recovery branches', () => {
  // fillBucket has two internal failure modes beyond the `bucketObject === null`
  // path:
  //   * `if (!part)` when the bucket file exists but the escape()-key is
  //     missing — line 346, exercised by seeding an empty bucket.
  //   * `catch` when JSON.parse throws on malformed bucket bytes —
  //     line 351, exercised with non-JSON bytes at the bucket path.
  // Both surface as 404 Not Found via lookupDictionaryEntry.

  it('returns 404 when the bucket file exists but the word key is absent (line 346)', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: JSON.stringify({}), // empty object → no %u840C key
    });
    const { request, url } = makeRequest('/api/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the bucket payload is not valid JSON (line 351 catch)', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: '<<< not valid JSON >>>',
    });
    const { request, url } = makeRequest('/api/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(404);
  });
});

describe('stripAudioIdAndShape — null/non-object guard (line 652-654)', () => {
  // When called with anything that isn't an object, returns the default
  // `{ heteronyms: [] }` shape. The normal converter pipeline guarantees an
  // object here, so this guard is only reachable via direct invocation.

  it('returns { heteronyms: [] } for null input', () => {
    expect(stripAudioIdAndShape(null)).toEqual({ heteronyms: [] });
  });

  it('returns { heteronyms: [] } for undefined input', () => {
    expect(stripAudioIdAndShape(undefined)).toEqual({ heteronyms: [] });
  });

  it('returns { heteronyms: [] } for primitive inputs', () => {
    expect(stripAudioIdAndShape(42)).toEqual({ heteronyms: [] });
    expect(stripAudioIdAndShape('string')).toEqual({ heteronyms: [] });
    expect(stripAudioIdAndShape(true)).toEqual({ heteronyms: [] });
  });

  it('passes an object through (non-null object branch)', () => {
    const input = { title: 't', heteronyms: [{ a: 1, audio_id: 'x' }] };
    const out = stripAudioIdAndShape(input);
    expect(out.title).toBe('t');
    expect(out.heteronyms).toEqual([{ a: 1 }]);
  });
});

describe('performFuzzySearch — whitespace-only input (line 740 cleanText fallback)', () => {
  // `terms` comes from Array.from(cleanText).filter(c.trim()), so whitespace
  // chars get filtered. For input like '   ', terms is [] but cleanText is
  // truthy, which exercises the `cleanText ? [cleanText] : []` arm.

  it('returns [cleanText] when input is pure whitespace', async () => {
    const out = await performFuzzySearch('   ');
    expect(out).toEqual(['   ']);
  });

  it('returns [] when cleanText is empty after `~`/`\\`` stripping', async () => {
    expect(await performFuzzySearch('')).toEqual([]);
    expect(await performFuzzySearch('`~`~')).toEqual([]);
  });
});

describe('convertDictionaryStructure — unmapped keys fallback (line 484)', () => {
  // KEY_MAP is keyed by short codes (h, t, c, ...); keys not in the map fall
  // back to themselves via `KEY_MAP[key] || key`. Feed a heteronym with a
  // custom field to exercise the nested-object walker (top-level non-
  // {title,heteronyms} fields are filtered by stripAudioIdAndShape, so the
  // custom key must live inside a heteronym to survive to the response).

  it('preserves an unmapped heteronym field via /raw', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({
        t: '萌',
        h: [{ b: 'ㄇㄥˊ', d: [{ f: '發芽' }], customField: 'keepme' }],
      }),
    });
    const { request, url } = makeRequest('/raw/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { heteronyms: Array<Record<string, unknown>> };
    // customField isn't in KEY_MAP → walker falls back to the original key.
    expect(body.heteronyms[0].customField).toBe('keepme');
  });
});

describe('convertToUniFormat / convertToPuaFormat — Array.isArray false (L679, L689)', () => {
  // When the pack entry has no `h` (heteronyms) key, convertDictionaryStructure
  // still returns an object, so `Array.isArray(converted.heteronyms)` is false
  // and addBopomofo2 is skipped. Cover both the /uni and /pua variants of
  // that branch (the /raw variant is already covered elsewhere).

  it('/uni on an entry without heteronyms returns heteronyms: []', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', c: 12, r: '艸' }),
    });
    const { request, url } = makeRequest('/uni/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title?: unknown; heteronyms: unknown[] };
    expect(body.title).toBe('萌');
    expect(body.heteronyms).toEqual([]);
  });

  it('/pua on an entry without heteronyms returns heteronyms: []', async () => {
    const env = makeEnv({
      [BUCKET_PATH]: makeBucketJson({ t: '萌', c: 12, r: '艸' }),
    });
    const { request, url } = makeRequest('/pua/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title?: unknown; heteronyms: unknown[] };
    expect(body.title).toBe('萌');
    expect(body.heteronyms).toEqual([]);
  });
});

describe('handleSubRouteAPI — catch block (lines 152-158)', () => {
  // `handleSubRouteAPI` now uses `return await`, so rejections from the
  // language sub-route handlers propagate into the try/catch. The
  // language handler's radical path (text starting with '@') calls
  // env.DICTIONARY.get directly — outside fillBucket's swallowing catch —
  // so a throwing env reaches this catch. That covers both arms of the
  // `error instanceof Error ? error.message : ...` ternary on line 155.

  function makeThrowingEnv(err: unknown): { DICTIONARY: R2Stub } {
    return {
      DICTIONARY: {
        async get() {
          throw err;
        },
      },
    };
  }

  it('returns 500 with error.message when the handler throws a real Error', async () => {
    const env = makeThrowingEnv(new Error('R2 exploded'));
    // /a/@萌.json → sub-route → handleLanguageSubRoute radical branch →
    // direct env.get throw → caught by handleSubRouteAPI.
    const { request, url } = makeRequest('/a/%40%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string; message: string };
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('R2 exploded');
  });

  it('returns 500 with the default message when the handler throws a non-Error', async () => {
    const env = makeThrowingEnv({ kind: 'weird' });
    const { request, url } = makeRequest('/a/%40%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string; message: string };
    expect(body.message).toBe('Failed to process sub-route request');
  });

  it('also catches on the list (=) sub-route path', async () => {
    // handleLanguageSubRoute's '=' branch calls env.get directly too, so
    // the catch also fires for /a/=成語.json with a throwing env.
    const env = makeThrowingEnv(new Error('list failure'));
    const { request, url } = makeRequest('/a/%3D%E6%88%90%E8%AA%9E.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(500);
  });
});

describe('handleDictionaryAPI — top-level catch non-Error branch (line 119)', () => {
  // The top-level try/catch at line 91 catches throws from handleRadicalLookup,
  // handleListLookup, and the fuzzy-search path. The `error instanceof Error`
  // arm is already covered; feed a non-Error throw to hit the default-message
  // arm. /api/@萌.json routes via the top-level radical branch (not sub-route),
  // which calls env.get directly and re-throws.

  it('returns 500 with the default message when a non-Error is thrown', async () => {
    const env = {
      DICTIONARY: {
        async get() {
          throw 'bare-string-thrown';
        },
      },
    };
    const { request, url } = makeRequest('/api/%40%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(500);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('Failed to process dictionary request');
  });
});

describe('decodeLangPart — 辨/似 pattern recursion', () => {
  // The while-loop at lines 443-447 fires when the stored definition contains
  // the 「`辨`似」 inline marker paired with an `f`-keyed follow-up. Feed the
  // real pattern through /api/{word}.json so processDictionaryEntry →
  // decodeLangPart exercises the loop body.

  it('rewrites embedded 「辨/似」 markers when decoding a definition', async () => {
    // Regex at line 443 requires the stringified entry to contain the exact
    // sequence `"`辨~⃞&nbsp`似~⃞"[^}]*},{"f":"([^（]+)[^"]*"`. Two adjacent
    // definition objects satisfy that: first `f` value is exactly the marker,
    // second `f` contains the replacement text (no `（` so [^（]+ matches).
    const marker = '`辨~\u20DE&nbsp`似~\u20DE';
    const entry = JSON.stringify({
      [ESCAPED_KEY]: {
        t: '萌',
        h: [
          {
            b: 'ㄇㄥˊ',
            d: [
              { f: marker, extra: 1 },
              { f: '芽' },
            ],
          },
        ],
      },
    });
    const env = makeEnv({
      [BUCKET_PATH]: entry,
    });
    const { request, url } = makeRequest('/api/%E8%90%8C.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { heteronyms: unknown[] };
    expect(Array.isArray(body.heteronyms)).toBe(true);
  });

  it('uses /api/!食 (lang=t) to exercise the t-hash prefix branch in decodeLangPart', async () => {
    // The /api/!{word}.json form sets lang='t', which routes through the
    // top-level entry path (processDictionaryEntry → decodeLangPart), using
    // HASH_OF['t'] = "#'" as the link prefix. This lights up the
    // `HASH_OF[lang]` lookup arm that the default-'a' path doesn't reach.
    const tBucket = bucketOf('食', 't');
    const env = makeEnv({
      [`ptck/${tBucket}.txt`]: JSON.stringify({
        [escape('食')]: {
          t: '食',
          h: [{ b: 'ㄕˊ', d: [{ f: '`吃~ 東西' }] }],
        },
      }),
    });
    const { request, url } = makeRequest('/api/%21%E9%A3%9F.json');
    const res = await handleDictionaryAPI(request, url, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { title?: string };
    expect(body.title).toBe('食');
  });
});
