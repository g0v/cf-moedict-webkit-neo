type DictionaryLang = 'a' | 't' | 'h' | 'c';

interface DictionaryObjectLike {
  text(): Promise<string>;
}

interface DictionaryBucketLike {
  get(key: string): Promise<DictionaryObjectLike | null>;
}

interface DictionaryEnv {
  DICTIONARY: DictionaryBucketLike;
}

interface ErrorResponse {
  error: string;
  message: string;
  terms?: string[];
}

interface DictionaryEntry {
  [key: string]: unknown;
  h?: Array<{ b?: string; d?: Array<{ f?: string; l?: string }> }>;
}

interface DictionaryAPIResponse {
  [key: string]: unknown;
  xrefs?: Array<{ lang: DictionaryLang; words: string[] }>;
}

interface XRefData {
  [targetLang: string]: Record<string, string | string[]>;
}

export async function handleDictionaryAPI(
  request: Request,
  url: URL,
  env: DictionaryEnv,
): Promise<Response> {
  if (url.pathname.includes('com.chrome.devtools') || url.pathname.includes('.well-known')) {
    return new Response('Not Found', { status: 404 });
  }

  const { lang, cleanText } = parseTextFromUrl(url.pathname);
  const fixedText = fixMojibake(cleanText);

  try {
    if (fixedText.startsWith('@')) {
      return await handleRadicalLookup(request, fixedText, lang, env);
    }

    if (fixedText.startsWith('=')) {
      return await handleListLookup(request, fixedText, lang, env);
    }

    const processedEntry = await lookupDictionaryEntry(fixedText, lang, env);
    if (!processedEntry) {
      const terms = await performFuzzySearch(fixedText);
      const status = 404;
      if (terms.length === 0) {
        const errorResponse: ErrorResponse = {
          error: 'Not Found',
          message: `找不到詞彙: ${fixedText}`,
          terms: [],
        };
        return jsonResponse(request, errorResponse, status);
      }
      return jsonResponse(request, { terms }, status);
    }

    return jsonResponse(request, processedEntry, 200);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to process dictionary request',
    };
    return jsonResponse(request, errorResponse, 500);
  }
}

function parseTextFromUrl(pathname: string): { lang: DictionaryLang; cleanText: string } {

  console.log(`Parsing text from URL pathname: ${pathname}`);

  const noSuffix = pathname.replace('/api/', '').replace(/\.json$/, '');
  const noLeadingSlash = noSuffix.replace(/^\//, '');
  const decoded = decodeURIComponent(noLeadingSlash);

  console.log(`Decoded text from URL: ${decoded}`);

  const slashParts = decoded.split('/').filter(Boolean);
  if (slashParts.length >= 2 && isDictionaryLang(slashParts[0])) {
    return {
      lang: slashParts[0],
      cleanText: slashParts.slice(1).join('/'),
    };
  }

  let lang: DictionaryLang = 'a';
  let cleanText = decoded;
  if (decoded.startsWith("'") || decoded.startsWith('!')) {
    lang = 't';
    cleanText = decoded.slice(1);
  } else if (decoded.startsWith(':')) {
    lang = 'h';
    cleanText = decoded.slice(1);
  } else if (decoded.startsWith('~')) {
    lang = 'c';
    cleanText = decoded.slice(1);
  }

  return { lang, cleanText };
}

function isDictionaryLang(input: string): input is DictionaryLang {
  return input === 'a' || input === 't' || input === 'h' || input === 'c';
}

function fixMojibake(text: string): string {
  return text;
}

function getCORSHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(request: Request, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders(request),
    },
  });
}

function bucketOf(text: string, lang: DictionaryLang): string {
  if (/^[=@]/.test(text)) {
    return text[0];
  }

  let code = text.charCodeAt(0);
  if (code >= 0xd800 && code <= 0xdbff) {
    code = text.charCodeAt(1) - 0xdc00;
  }

  const bucketSize = lang === 'a' ? 1024 : 128;
  return String(code % bucketSize);
}

async function fillBucket(
  id: string,
  bucket: string,
  lang: DictionaryLang,
  env: DictionaryEnv,
): Promise<{ data: DictionaryEntry | null; err: boolean }> {
  try {
    const bucketPath = `p${lang}ck/${bucket}.txt`;
    const bucketObject = await env.DICTIONARY.get(bucketPath);
    if (!bucketObject) {
      return { data: null, err: true };
    }

    const bucketData = await bucketObject.text();
    const responseData = JSON.parse(bucketData) as Record<string, DictionaryEntry>;
    const key = escape(id);
    const part = responseData[key];

    if (!part) {
      return { data: null, err: true };
    }

    return { data: part, err: false };
  } catch {
    return { data: null, err: true };
  }
}

async function handleRadicalLookup(
  request: Request,
  text: string,
  lang: DictionaryLang,
  env: DictionaryEnv,
): Promise<Response> {
  const radicalPath = `${lang}/${text}.json`;
  const radicalObject = await env.DICTIONARY.get(radicalPath);

  if (!radicalObject) {
    return jsonResponse(
      request,
      { error: 'Not Found', message: `找不到部首: ${text}`, terms: [] } satisfies ErrorResponse,
      404,
    );
  }

  const radicalData = await radicalObject.text();
  return jsonResponse(request, JSON.parse(radicalData), 200);
}

async function handleListLookup(
  request: Request,
  text: string,
  lang: DictionaryLang,
  env: DictionaryEnv,
): Promise<Response> {
  const listPath = `${lang}/${text}.json`;
  const listObject = await env.DICTIONARY.get(listPath);

  if (!listObject) {
    return jsonResponse(
      request,
      { error: 'Not Found', message: `找不到列表: ${text}`, terms: [] } satisfies ErrorResponse,
      404,
    );
  }

  const listData = await listObject.text();
  return jsonResponse(request, JSON.parse(listData), 200);
}

export async function lookupDictionaryEntry(
  text: string,
  lang: DictionaryLang,
  env: DictionaryEnv,
): Promise<DictionaryAPIResponse | null> {

  console.log(`Looking up dictionary entry for text: "${text}" in language: "${lang}"`);

  if (text.startsWith('@') || text.startsWith('=')) {
    return null;
  }

  const bucket = bucketOf(text, lang);
  const bucketResult = await fillBucket(text, bucket, lang, env);
  if (bucketResult.err || !bucketResult.data) {
    return null;
  }

  const entry = bucketResult.data;
  const processedEntry = processDictionaryEntry(entry, lang);
  processedEntry.xrefs = await getCrossReferences(text, lang, env);
  return processedEntry;
}

function processDictionaryEntry(entry: DictionaryEntry, lang: DictionaryLang): DictionaryAPIResponse {
  const decoded = decodeLangPart(lang, JSON.stringify(entry));
  const parsedEntry = JSON.parse(decoded) as Record<string, unknown>;

  const result: DictionaryAPIResponse = {};
  if (parsedEntry.Deutsch) result.Deutsch = parsedEntry.Deutsch;
  if (parsedEntry.English || parsedEntry.english) result.English = parsedEntry.English || parsedEntry.english;
  if (parsedEntry.francais) result.francais = parsedEntry.francais;
  if (parsedEntry.heteronyms) result.heteronyms = parsedEntry.heteronyms;
  if (parsedEntry.radical) result.radical = parsedEntry.radical;
  if (parsedEntry.stroke_count) result.stroke_count = parsedEntry.stroke_count;
  if (parsedEntry.non_radical_stroke_count) result.non_radical_stroke_count = parsedEntry.non_radical_stroke_count;
  if (parsedEntry.title) result.title = parsedEntry.title;
  if (parsedEntry.translation) result.translation = parsedEntry.translation;

  return result;
}

function decodeLangPart(lang: DictionaryLang, part = ''): string {
  while (part.match(/"`辨~\u20DE&nbsp`似~\u20DE"[^}]*},{"f":"([^（]+)[^"]*"/)) {
    part = part.replace(
      /"`辨~\u20DE&nbsp`似~\u20DE"[^}]*},{"f":"([^（]+)[^"]*"/,
      '"辨\u20DE 似\u20DE $1"',
    );
  }

  part = part.replace(/"`(.)~\u20DE"[^}]*},{"f":"([^（]+)[^"]*"/g, '"$1\u20DE $2"');

  const keyMap: Record<string, string> = {
    h: 'heteronyms',
    b: 'bopomofo',
    p: 'pinyin',
    d: 'definitions',
    c: 'stroke_count',
    n: 'non_radical_stroke_count',
    f: 'def',
    t: 'title',
    r: 'radical',
    e: 'example',
    l: 'link',
    s: 'synonyms',
    a: 'antonyms',
    q: 'quote',
    _: 'id',
    '=': 'audio_id',
    E: 'english',
    T: 'trs',
    A: 'alt',
    V: 'vernacular',
    C: 'combined',
    D: 'dialects',
    S: 'specific_to',
  };

  part = part.replace(/"([hbpdcnftrelsaqETAVCDS_=])":/g, (_match, k: string) => `"${keyMap[k]}":`);

  const HASH_OF: Record<DictionaryLang, string> = { a: '#', t: "#'", h: '#:', c: '#~' };
  const h = `./#${HASH_OF[lang] || '#'}`;

  part = part.replace(
    /([「【『（《])`([^~]+)~([。，、；：？！─…．·－」』》〉]+)/g,
    '<span class=\\"punct\\">$1<a href=\\"' + h + '$2\\">$2</a>$3</span>',
  );
  part = part.replace(
    /([「【『（《])`([^~]+)~/g,
    '<span class=\\"punct\\">$1<a href=\\"' + h + '$2\\">$2</a></span>',
  );
  part = part.replace(
    /`([^~]+)~([。，、；：？！─…．·－」』》〉]+)/g,
    '<span class=\\"punct\\"><a href=\\"' + h + '$1\\">$1</a>$2</span>',
  );
  part = part.replace(/`([^~]+)~/g, '<a href=\\"' + h + '$1\\">$1</a>');

  part = part.replace(/([)）])/g, '$1\u200B');
  part = part.replace(/\.\/##/g, './#');

  return part;
}

async function getCrossReferences(
  text: string,
  lang: DictionaryLang,
  env: DictionaryEnv,
): Promise<Array<{ lang: DictionaryLang; words: string[] }>> {
  try {
    const xrefPath = `${lang}/xref.json`;
    console.log(`Looking for cross-reference at: ${xrefPath}`);
    const xrefObject = await env.DICTIONARY.get(xrefPath);
    if (!xrefObject) {
      return [];
    }

    const xrefData = await xrefObject.text();
    const xref = JSON.parse(xrefData) as XRefData;
    const result: Array<{ lang: DictionaryLang; words: string[] }> = [];

    for (const [targetLang, words] of Object.entries(xref)) {
      const wordData = words[text];
      if (!wordData) {
        continue;
      }

      const wordList = Array.isArray(wordData)
        ? wordData
        : wordData
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean);

      if (wordList.length > 0 && isDictionaryLang(targetLang)) {
        result.push({ lang: targetLang, words: wordList });
      }
    }

    return result;
  } catch {
    return [];
  }
}

async function performFuzzySearch(text: string): Promise<string[]> {
  const cleanText = text.replace(/[`~]/g, '');
  const terms = Array.from(cleanText).filter((char) => char.trim());
  return terms.length > 0 ? terms : cleanText ? [cleanText] : [];
}
