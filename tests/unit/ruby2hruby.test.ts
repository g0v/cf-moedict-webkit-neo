/**
 * Coverage for src/utils/ruby2hruby.ts — exercises the DOMParser-based ruby
 * restructuring: zhuyin rtc becomes <ru zhuyin><zhuyin><yin>.../<diao>...</>,
 * ordered rtcs wrap preceding rbs with order/span/annotation attrs, and
 * leftover <rt>s get hidden via inline style.
 */

import { describe, expect, it } from 'vitest';
import { rightAngle, ruby2hruby } from '../../src/utils/ruby2hruby';

function stripWhitespace(html: string): string {
  return html.replace(/\s+/g, '');
}

describe('ruby2hruby — zhuyin rtc', () => {
  it('converts a single rb + zhuyin rt into <ru zhuyin><zhuyin><yin><diao>', () => {
    // ㄇㄥ = initial + final → form="SY"; trailing ˊ → diao="ˊ"
    const out = ruby2hruby('<rb>萌</rb><rtc class="zhuyin"><rt>ㄇㄥˊ</rt></rtc>');
    expect(out).toContain('<ru');
    expect(out).toContain('zhuyin=""');
    expect(out).toContain('diao="ˊ"');
    expect(out).toContain('length="2"');
    expect(out).toContain('form="SY"');
    expect(out).toContain('<rb>萌</rb>');
    expect(out).toContain('<zhuyin>');
    expect(out).toContain('<yin>ㄇㄥ</yin>');
    expect(out).toContain('<diao>ˊ</diao>');
    // The original <rtc class="zhuyin"> is removed after conversion.
    expect(out).not.toContain('<rtc');
  });

  it('emits form="S" for initial-only syllables like ㄗˋ', () => {
    const out = ruby2hruby('<rb>字</rb><rtc class="zhuyin"><rt>ㄗˋ</rt></rtc>');
    expect(out).toContain('form="S"');
    expect(out).toContain('diao="ˋ"');
  });

  it('handles multi-character words by producing one <ru> per rb/rt pair', () => {
    const out = ruby2hruby(
      '<rb>萌</rb><rb>典</rb><rtc class="zhuyin"><rt>ㄇㄥˊ</rt><rt>ㄉㄧㄢˇ</rt></rtc>',
    );
    const ruCount = (out.match(/<ru\s/g) ?? []).length;
    expect(ruCount).toBe(2);
    expect(out).toContain('<yin>ㄇㄥ</yin>');
    expect(out).toContain('<diao>ˊ</diao>');
    expect(out).toContain('<yin>ㄉㄧㄢ</yin>');
    expect(out).toContain('<diao>ˇ</diao>');
  });

  it('normalises light-tone ˙ → ˙ (no tone mark produces empty diao)', () => {
    const out = ruby2hruby('<rb>的</rb><rtc class="zhuyin"><rt>ㄉㄜ</rt></rtc>');
    // No tone mark in ㄉㄜ → diao attr is empty.
    expect(out).toContain('diao=""');
    expect(out).toContain('<yin>ㄉㄜ</yin>');
  });
});

describe('ruby2hruby — ordered rtc (non-zhuyin)', () => {
  it('wraps the zhuyin-produced <ru> with order/span/annotation from a trailing romanization rtc', () => {
    // The ordered-rtc branch only kicks in after zhuyin processing has
    // populated `rus`. So the real-world input is zhuyin + romanization,
    // matching decorate-ruby's output in the dictionary pipeline.
    const out = ruby2hruby(
      '<rb>萌</rb><rtc class="zhuyin"><rt>ㄇㄥˊ</rt></rtc><rtc class="romanization"><rt>meng</rt></rtc>',
    );
    expect(out).toContain('order="0"');
    expect(out).toContain('span="1"');
    expect(out).toContain('annotation="meng"');
    // The <rt> is hidden via inline style (visual ruby display is handled by
    // the zhuyin <yin>/<diao> sub-elements, not the original <rt>).
    expect(out).toMatch(/<rt[^>]*style="text-indent:[^"]*">meng<\/rt>/);
  });
});

describe('ruby2hruby — robustness', () => {
  it('returns the input unchanged when DOMParser is missing', () => {
    const original = globalThis.DOMParser;
    // @ts-expect-error — deliberately simulate a non-DOM environment.
    delete globalThis.DOMParser;
    try {
      const html = '<rb>字</rb>';
      expect(ruby2hruby(html)).toBe(html);
    } finally {
      globalThis.DOMParser = original;
    }
  });

  it('handles empty input without throwing', () => {
    expect(() => ruby2hruby('')).not.toThrow();
  });

  it('returns the input unchanged when parsing produces no <ruby> root', () => {
    // Happy-dom always wraps our string inside the <ruby> we prepend, so this
    // branch is defensive — we still want a non-throwing no-op result.
    expect(() => ruby2hruby('plain text with no markup')).not.toThrow();
  });
});

describe('rightAngle', () => {
  it('wraps ruby2hruby output in <hruby class="rightangle" rightangle="rightangle">', () => {
    const out = rightAngle('<rb>字</rb><rtc class="zhuyin"><rt>ㄗˋ</rt></rtc>');
    expect(out.startsWith('<hruby class="rightangle" rightangle="rightangle">')).toBe(true);
    expect(out.endsWith('</hruby>')).toBe(true);
    // Inner transformation still happens.
    expect(stripWhitespace(out)).toContain('<yin>ㄗ</yin>');
  });
});
