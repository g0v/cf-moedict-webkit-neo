/**
 * Offline API handler for Capacitor apps (Android / iOS / macOS).
 *
 * Monkey-patches window.fetch and XMLHttpRequest.open to intercept /api/*
 * requests and serve dictionary data from locally bundled files.
 *
 * When NOT running inside Capacitor (i.e. on the web), this module is a
 * complete no-op — the guard at the top bails out immediately.
 */

import { handleDictionaryAPI } from './api/handleDictionaryAPI.ts';

if (typeof window !== 'undefined' && (window as any).Capacitor) {

// Keep the original fetch for loading local files and external requests
const originalFetch = window.fetch.bind(window);

const offlineDictionary = {
  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    try {
      const response = await originalFetch(`/dictionary/${key}`);
      if (!response.ok) return null;
      const content = await response.text();
      return { text: () => Promise.resolve(content) };
    } catch {
      return null;
    }
  },
};

const offlineEnv = { DICTIONARY: offlineDictionary };

async function handleOfflineApiRequest(url: string, init?: RequestInit): Promise<Response> {
  const parsedUrl = new URL(url, window.location.origin);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/config') {
    return Response.json({
      assetBaseUrl: '/assets-legacy',
      dictionaryBaseUrl: '',
    });
  }

  const searchIndexMatch = pathname.match(/^\/api\/search-index\/([athc])\.json$/);
  if (searchIndexMatch) {
    return originalFetch(`/search-index/${searchIndexMatch[1]}.json`, init);
  }

  const indexMatch = pathname.match(/^\/api\/index\/([athc])\.json$/);
  if (indexMatch) {
    return originalFetch(`/dictionary/${indexMatch[1]}/index.json`, init);
  }

  const xrefMatch = pathname.match(/^\/api\/xref\/([athc])\.json$/);
  if (xrefMatch) {
    const resp = await originalFetch(`/dictionary/${xrefMatch[1]}/xref.json`, init);
    if (resp.ok) return resp;
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (pathname.startsWith('/api/stroke-json/')) {
    const cp = decodeURIComponent(pathname.slice('/api/stroke-json/'.length));
    if (!cp || !/^[0-9a-f]{4,6}\.json$/i.test(cp)) {
      return Response.json({ error: 'Bad Request' }, { status: 400 });
    }
    try {
      const local = await originalFetch(`/stroke-json/${cp}`);
      if (local.ok) return local;
    } catch { /* fall through to CDN */ }
    try {
      const cdnUrl = `https://829091573dd46381a321-9e8a43b8d3436eaf4353af683c892840.ssl.cf1.rackcdn.com/${cp}`;
      return await originalFetch(cdnUrl);
    } catch {
      return Response.json(
        { error: 'Offline', message: 'Stroke data unavailable' },
        { status: 503 },
      );
    }
  }

  const request = new Request(parsedUrl.href, init);
  return handleDictionaryAPI(request, parsedUrl, offlineEnv);
}

// Monkey-patch XMLHttpRequest for legacy jQuery $.ajax stroke requests
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  method: string,
  url: string | URL,
  async_?: boolean,
  username?: string | null,
  password?: string | null,
) {
  const urlStr = typeof url === 'string' ? url : url.href;
  if (urlStr.startsWith('/api/stroke-json/')) {
    const cp = urlStr.slice('/api/stroke-json/'.length);
    return originalXHROpen.call(this, method, `/stroke-json/${cp}`, async_ ?? true, username, password);
  }
  return originalXHROpen.call(this, method, url, async_ ?? true, username, password);
};

// Monkey-patch fetch to intercept /api/ requests
(window as any).fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url: string;
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else {
    url = input.url;
  }

  const isApiRequest =
    url.startsWith('/api/') ||
    (url.startsWith(window.location.origin) && new URL(url).pathname.startsWith('/api/'));

  if (isApiRequest) {
    return handleOfflineApiRequest(url, init);
  }

  return originalFetch(input, init);
};

} // end Capacitor guard
