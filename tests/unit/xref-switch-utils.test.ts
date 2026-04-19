import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  LANG_PREFIX,
  computeLangSwitchPath,
  computeLangSwitchPathAsync,
  setCurrentXrefs,
} from '../../src/utils/xref-switch-utils';
import { addToLRU, clearLRUWords } from '../../src/utils/word-record-utils';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  clearLRUWords('a');
  clearLRUWords('t');
  clearLRUWords('h');
  clearLRUWords('c');
  vi.restoreAllMocks();
});

describe('LANG_PREFIX', () => {
  it('maps each lang to its URL prefix', () => {
    expect(LANG_PREFIX).toEqual({ a: '', t: "'", h: ':', c: '~' });
  });
});

describe('computeLangSwitchPath', () => {
  it('same lang → reformats with prefix', () => {
    expect(computeLangSwitchPath('a', 'a', '萌')).toBe('/萌');
    expect(computeLangSwitchPath('t', 't', '食')).toBe("/'食");
  });

  it("a ↔ c swaps prefix without consulting xref", () => {
    expect(computeLangSwitchPath('a', 'c', '萌')).toBe('/~萌');
    expect(computeLangSwitchPath('c', 'a', '萌')).toBe('/萌');
  });

  it('falls back to LRU of target lang when xref is absent', () => {
    addToLRU('記憶', 't');
    expect(computeLangSwitchPath('a', 't', '萌')).toBe("/'記憶");
  });

  it('falls back to default word when xref and LRU are empty', () => {
    expect(computeLangSwitchPath('a', 't', '萌')).toBe("/'發穎");
    expect(computeLangSwitchPath('a', 'h', '萌')).toBe('/:發芽');
  });

  it('uses entry.xrefs fallback when set via setCurrentXrefs', () => {
    setCurrentXrefs('萌', 'a', [{ lang: 't', words: ['發穎'] }]);
    expect(computeLangSwitchPath('a', 't', '萌')).toBe("/'發穎");
  });

  it('decodes percent-encoded input word', () => {
    setCurrentXrefs('萌', 'a', [{ lang: 't', words: ['發穎'] }]);
    expect(computeLangSwitchPath('a', 't', '%E8%90%8C')).toBe("/'發穎");
  });
});

describe('computeLangSwitchPathAsync', () => {
  it('loads xref JSON on first call and uses it', async () => {
    const xrefPayload = { t: { 萌: '發穎' } };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      expect(url).toMatch(/\/api\/xref\/a\.json$/);
      return new Response(JSON.stringify(xrefPayload), { status: 200 });
    }) as typeof fetch;

    const path = await computeLangSwitchPathAsync('a', 't', '萌');
    expect(path).toBe("/'發穎");
  });

  it('falls back cleanly when fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as typeof fetch;
    // NOTE: module-level cache already loaded in previous test may persist; create a fresh fromLang
    const path = await computeLangSwitchPathAsync('h', 'a', 'nothing');
    expect(path.startsWith('/')).toBe(true);
  });
});
