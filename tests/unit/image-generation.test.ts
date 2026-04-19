import { describe, expect, it } from 'vitest';
import {
  parseTextFromUrl,
  fixMojibake,
  getFontName,
  getCORSHeaders,
} from '../../src/utils/image-generation';

describe('parseTextFromUrl', () => {
  it.each([
    ['/萌.png', { text: '萌', lang: 'a', cleanText: '萌' }],
    ["/%27食.png", { text: "'食", lang: 't', cleanText: '食' }],
    ['/%3A字.png', { text: ':字', lang: 'h', cleanText: '字' }],
    ['/~上訴.png', { text: '~上訴', lang: 'c', cleanText: '上訴' }],
    ['/!食.png', { text: '!食', lang: 't', cleanText: '食' }],
  ])('parses %s', (path, expected) => {
    expect(parseTextFromUrl(path)).toEqual(expected);
  });

  it('strips .json, .html suffixes too', () => {
    expect(parseTextFromUrl('/萌.json').cleanText).toBe('萌');
    expect(parseTextFromUrl('/萌.html').cleanText).toBe('萌');
  });

  it('strips _json/ prefix if present', () => {
    expect(parseTextFromUrl('/_json/萌.json').cleanText).toBe('萌');
  });

  it('handles starred redirect prefix =*', () => {
    // =* is stripped — the *remainder* becomes the parse input
    const result = parseTextFromUrl('/=*萌');
    expect(result.cleanText).toBe('萌');
  });
});

describe('fixMojibake', () => {
  it('is currently an identity function for ASCII + CJK', () => {
    expect(fixMojibake('萌')).toBe('萌');
    expect(fixMojibake('abc')).toBe('abc');
  });
});

describe('getCORSHeaders', () => {
  it('emits wildcard origin and the three Cloudflare-safe headers', () => {
    const headers = getCORSHeaders() as Record<string, string>;
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
  });
});

describe('getFontName', () => {
  it('falls back to TW-Kai for unknown params', () => {
    expect(getFontName('')).toBe('TW-Kai');
    expect(getFontName('unknown-font')).toBe('TW-Kai');
    expect(getFontName('kai')).toBe('TW-Kai');
  });

  it('maps TW-Sung aliases', () => {
    expect(getFontName('sung')).toBe('TW-Sung');
    expect(getFontName('SUNG')).toBe('TW-Sung'); // case-insensitive
  });

  it('maps cwTeX Q family', () => {
    expect(getFontName('cwming')).toBe('cwTeXQMing');
    expect(getFontName('cwhei')).toBe('cwTeXQHei');
    expect(getFontName('cwyuan')).toBe('cwTeXQYuan');
    expect(getFontName('cwkai')).toBe('cwTeXQKai');
    expect(getFontName('cwfangsong')).toBe('cwTeXQFangsong');
  });

  it('maps all seven SourceHanSansTC weights', () => {
    expect(getFontName('srcx')).toBe('SourceHanSansTCExtraLight');
    expect(getFontName('srcl')).toBe('SourceHanSansTCLight');
    expect(getFontName('srcn')).toBe('SourceHanSansTCNormal');
    expect(getFontName('srcr')).toBe('SourceHanSansTCRegular');
    expect(getFontName('srcm')).toBe('SourceHanSansTCMedium');
    expect(getFontName('srcb')).toBe('SourceHanSansTCBold');
    expect(getFontName('srch')).toBe('SourceHanSansTCHeavy');
  });

  it('maps all seven SourceHanSerifTC weights', () => {
    expect(getFontName('shsx')).toBe('SourceHanSerifTCExtraLight');
    expect(getFontName('shsl')).toBe('SourceHanSerifTCLight');
    expect(getFontName('shsm')).toBe('SourceHanSerifTCMedium');
    expect(getFontName('shsr')).toBe('SourceHanSerifTCRegular');
    expect(getFontName('shss')).toBe('SourceHanSerifTCSemiBold');
    expect(getFontName('shsb')).toBe('SourceHanSerifTCBold');
    expect(getFontName('shsh')).toBe('SourceHanSerifTCHeavy');
  });

  it('maps GenWanMinTW weights', () => {
    expect(getFontName('gwmel')).toBe('GenWanMinTWEL');
    expect(getFontName('gwml')).toBe('GenWanMinTWL');
    expect(getFontName('gwmr')).toBe('GenWanMinTWR');
    expect(getFontName('gwmm')).toBe('GenWanMinTWM');
    expect(getFontName('gwmsb')).toBe('GenWanMinTWSB');
  });

  it('maps ebas, shuowen, rxkt, openhuninn', () => {
    expect(getFontName('ebas')).toBe('EBAS');
    expect(getFontName('shuowen')).toBe('ShuoWen');
    expect(getFontName('rxkt')).toBe('Typography');
    expect(getFontName('openhuninn')).toBe('jf-openhuninn-2.1');
  });

  it('maps legacy Hanwang wt* codes via lookup table', () => {
    expect(getFontName('wt001')).toBe('HanWangMingLight');
    expect(getFontName('wt024')).toBe('HanWangFangSongMedium');
    expect(getFontName('wt064')).toBe('HanWangYanKai');
    expect(getFontName('wtcc02')).toBe('HanWangCC02');
    expect(getFontName('wthc06')).toBe('HanWangGB06');
  });
});
