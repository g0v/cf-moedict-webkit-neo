/**
 * Regression for closed issues #39 / #81: the About page's "Fork me on
 * GitHub" banner and inline source link must point at the g0v/moedict.tw
 * repo, not a fork. Also guards the page title (#47).
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { About } from '../../src/pages/About';
import { resolveHeadByPath } from '../../src/ssr/head';

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <About assetBaseUrl="https://r2-assets.test.local" />
    </MemoryRouter>,
  );
}

describe('About page links', () => {
  it('includes the canonical g0v/moedict.tw GitHub link (inline)', () => {
    const html = render();
    expect(html).toContain('href="https://github.com/g0v/moedict.tw"');
  });

  it('does not link to the old moedict/moedict-webkit repo', () => {
    const html = render();
    expect(html).not.toMatch(/moedict\/moedict-webkit/);
    expect(html).not.toMatch(/audreyt\/moedict-webkit/);
  });
});

describe('About page title (#47)', () => {
  it('/about resolves to a 關於 title via resolveHeadByPath', () => {
    const head = resolveHeadByPath('/about');
    expect(head.title).toMatch(/關於/);
  });
});
