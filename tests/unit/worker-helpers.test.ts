/**
 * Direct-call tests for the small pure helpers in `worker/index.ts` that
 * `dispatch`'s integration-shaped tests can't reach through normal flows:
 *
 *   - `stripTags`: falsy-input coercion (`String(input || '')`) and HTML/ws cleanup.
 *   - `parseDictionaryRoute`: empty-pathname early return and falsy-pathname coercion.
 *   - `buildDefinitionDescription`: definitions-not-array, empty def, 4-def-break
 *     (inner and outer), all-empty returns null, and long sentence truncation.
 *   - `shouldRenderHtmlShell`: `/api/` and `.json` defensive guards that dispatch's
 *     earlier branches already catch — unreachable through `dispatch` but kept
 *     as in-function safety nets.
 *
 * These helpers are pure and exported so v8 coverage can light up the
 * branches without invoking the full HTTP pipeline.
 */

import { describe, expect, it } from 'vitest';
import {
  buildDefinitionDescription,
  parseDictionaryRoute,
  shouldRenderHtmlShell,
  stripTags,
} from '../../worker/index';

describe('stripTags', () => {
  it('coerces null/undefined to empty string', () => {
    expect(stripTags(null as unknown as string)).toBe('');
    expect(stripTags(undefined as unknown as string)).toBe('');
    expect(stripTags('' as string)).toBe('');
  });

  it('removes HTML tags and collapses whitespace', () => {
    expect(stripTags('<b>hello</b>  world')).toBe('hello world');
    expect(stripTags('  <p>line\n\nbreak</p>  ')).toBe('line break');
  });
});

describe('parseDictionaryRoute', () => {
  it('returns null for empty or slash-only paths (line 39)', () => {
    expect(parseDictionaryRoute('/')).toBeNull();
    expect(parseDictionaryRoute('')).toBeNull();
    expect(parseDictionaryRoute('///')).toBeNull();
  });

  it('coerces falsy pathname via String(... || "") (line 38)', () => {
    expect(parseDictionaryRoute(null as unknown as string)).toBeNull();
    expect(parseDictionaryRoute(undefined as unknown as string)).toBeNull();
  });

  it('returns null for about, radicals, lists, and "=*" meta routes', () => {
    expect(parseDictionaryRoute('/about')).toBeNull();
    expect(parseDictionaryRoute('/about.html')).toBeNull();
    expect(parseDictionaryRoute('/@部首')).toBeNull();
    expect(parseDictionaryRoute('/~@部首')).toBeNull();
    expect(parseDictionaryRoute('/=成語')).toBeNull();
    expect(parseDictionaryRoute("/'=諺語")).toBeNull();
    expect(parseDictionaryRoute('/:=諺語')).toBeNull();
    expect(parseDictionaryRoute('/~=異名')).toBeNull();
    expect(parseDictionaryRoute("/'=*star")).toBeNull();
    expect(parseDictionaryRoute('/:=*star')).toBeNull();
    expect(parseDictionaryRoute('/~=*star')).toBeNull();
    expect(parseDictionaryRoute('/=*star')).toBeNull();
  });

  it('extracts lang and text from prefixed paths', () => {
    expect(parseDictionaryRoute("/'食")).toEqual({ lang: 't', text: '食' });
    expect(parseDictionaryRoute('/:字')).toEqual({ lang: 'h', text: '字' });
    expect(parseDictionaryRoute('/~萌')).toEqual({ lang: 'c', text: '萌' });
    expect(parseDictionaryRoute('/萌')).toEqual({ lang: 'a', text: '萌' });
  });
});

describe('buildDefinitionDescription', () => {
  it('returns null when entry is null or has no heteronyms', () => {
    expect(buildDefinitionDescription(null)).toBeNull();
    expect(buildDefinitionDescription({})).toBeNull();
    expect(buildDefinitionDescription({ heteronyms: [] })).toBeNull();
  });

  it('skips heteronyms whose definitions is not an array (line 55)', () => {
    const entry = {
      heteronyms: [
        { definitions: 'not-an-array' as unknown as Array<{ def?: string }> },
        { definitions: [{ def: '有效定義' }] },
      ],
    };
    expect(buildDefinitionDescription(entry)).toBe('有效定義。');
  });

  it('treats missing/empty def as falsy (lines 57-58) and filters them out', () => {
    const entry = {
      heteronyms: [
        { definitions: [{ def: '' }, { def: '實際定義' }, {}] },
      ],
    };
    // Empty and missing def are filtered; only '實際定義' survives.
    expect(buildDefinitionDescription(entry)).toBe('實際定義。');
  });

  it('returns null when every definition is empty after stripping (line 64)', () => {
    const entry = {
      heteronyms: [
        { definitions: [{ def: '<br>' }, { def: '   ' }, { def: '' }] },
      ],
    };
    expect(buildDefinitionDescription(entry)).toBeNull();
  });

  it('breaks after the 4th def in a single heteronym (line 60)', () => {
    const entry = {
      heteronyms: [
        {
          definitions: [
            { def: '一' }, { def: '二' }, { def: '三' }, { def: '四' }, { def: '五' },
          ],
        },
      ],
    };
    // 4 defs joined with 。, then final 。 appended.
    expect(buildDefinitionDescription(entry)).toBe('一。二。三。四。');
  });

  it('breaks the outer heteronym loop once 4 defs accumulated (line 62)', () => {
    const entry = {
      heteronyms: [
        { definitions: [{ def: '一' }, { def: '二' }] },
        { definitions: [{ def: '三' }, { def: '四' }] },
        { definitions: [{ def: '五' }] },
      ],
    };
    expect(buildDefinitionDescription(entry)).toBe('一。二。三。四。');
  });

  it('truncates sentences longer than 180 chars with an ellipsis (line 66)', () => {
    const longDef = 'あ'.repeat(200);
    const entry = { heteronyms: [{ definitions: [{ def: longDef }] }] };
    const out = buildDefinitionDescription(entry);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(180);
    expect(out!.endsWith('…')).toBe(true);
  });

  it('short sentences pass through untruncated', () => {
    const entry = { heteronyms: [{ definitions: [{ def: '短定義' }] }] };
    expect(buildDefinitionDescription(entry)).toBe('短定義。');
  });
});

describe('shouldRenderHtmlShell', () => {
  const url = (pathname: string) => new URL(`http://localhost${pathname}`);
  const req = (method = 'GET') => new Request('http://localhost/', { method });

  it('returns false for /api/ paths (line 127 defensive guard)', () => {
    expect(shouldRenderHtmlShell(req(), url('/api/config'))).toBe(false);
  });

  it('returns false for .json paths (line 128 defensive guard)', () => {
    expect(shouldRenderHtmlShell(req(), url('/something.json'))).toBe(false);
  });

  it('returns false for /assets/ paths', () => {
    expect(shouldRenderHtmlShell(req(), url('/assets/foo.css'))).toBe(false);
  });

  it('returns false for Vite-internal requests', () => {
    expect(shouldRenderHtmlShell(req(), url('/@vite/client'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/node_modules/x'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/foo?import'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/foo?raw'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/foo?url'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/foo?worker_file'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/foo?html-proxy'))).toBe(false);
  });

  it('returns false for non-GET/HEAD methods', () => {
    expect(shouldRenderHtmlShell(req('POST'), url('/about'))).toBe(false);
    expect(shouldRenderHtmlShell(req('DELETE'), url('/about'))).toBe(false);
  });

  it('returns false for file-extension paths (except .html)', () => {
    expect(shouldRenderHtmlShell(req(), url('/foo.txt'))).toBe(false);
    expect(shouldRenderHtmlShell(req(), url('/bundle.css'))).toBe(false);
  });

  it('returns true for /about.html and /index.html', () => {
    expect(shouldRenderHtmlShell(req(), url('/about.html'))).toBe(true);
    expect(shouldRenderHtmlShell(req(), url('/index.html'))).toBe(true);
  });

  it('returns true for bare paths (dictionary words, about route, root)', () => {
    expect(shouldRenderHtmlShell(req(), url('/'))).toBe(true);
    expect(shouldRenderHtmlShell(req(), url('/about'))).toBe(true);
    expect(shouldRenderHtmlShell(req(), url('/萌'))).toBe(true);
  });

  it('returns true for HEAD on a shell route', () => {
    expect(shouldRenderHtmlShell(req('HEAD'), url('/about'))).toBe(true);
  });
});
