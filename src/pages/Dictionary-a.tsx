import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanTextForTTS, speakText } from '../tts-utils';
import { getAudioUrl, playAudioUrl } from '../audio-utils';

type DictionaryLang = 'a' | 't' | 'h' | 'c';

interface Definition {
  type?: string;
  def?: string;
  example?: string[] | string;
  quote?: string[] | string;
  link?: string[] | string;
  synonyms?: string[] | string;
  antonyms?: string[] | string;
}

interface Heteronym {
  bopomofo?: string;
  pinyin?: string;
  trs?: string;
  alt?: string;
  audio_id?: string;
  definitions?: Definition[];
}

interface DictionaryAPIResponse {
  title?: string;
  heteronyms?: Heteronym[];
  radical?: string;
  stroke_count?: number;
  non_radical_stroke_count?: number;
  translation?: Record<string, string | string[]>;
  English?: string | string[];
  Deutsch?: string | string[];
  francais?: string | string[];
  xrefs?: Array<{ lang: DictionaryLang; words: string[] }>;
}

interface DictionaryErrorResponse {
  error?: string;
  message?: string;
  terms?: string[];
}

interface DictionaryProps {
  word?: string;
}

interface DictionaryState {
  loading: boolean;
  entry: DictionaryAPIResponse | null;
  terms: string[];
  error: string | null;
}

function toStringArray(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function normalizeHref(rawHref: string): string | null {
  const href = rawHref.trim();
  if (!href) return null;
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) return null;

  if (href.startsWith('/')) {
    return href;
  }

  let token = href;
  token = token.replace(/^\.\//, '');
  token = token.replace(/^#/, '');
  token = token.replace(/^#/, '');
  token = token.trim();

  if (!token) return null;
  return `/${token}`;
}

function untag(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

function formatTranslation(value: string[] | string): string {
  return untag(Array.isArray(value) ? value.join(', ') : value);
}

function getLangPrefix(lang: DictionaryLang): string {
  if (lang === 't') return "'";
  if (lang === 'h') return ':';
  if (lang === 'c') return '~';
  return '';
}

function getLangName(lang: DictionaryLang): string {
  if (lang === 't') return '台語';
  if (lang === 'h') return '客語';
  if (lang === 'c') return '兩岸';
  return '華語';
}

const LANG_A: DictionaryLang = 'a';

export function DictionaryA({ word }: DictionaryProps) {
  const navigate = useNavigate();
  const queryWord = useMemo(() => (word ?? '').trim(), [word]);
  const [state, setState] = useState<DictionaryState>({
    loading: false,
    entry: null,
    terms: [],
    error: null,
  });

  useEffect(() => {
    if (!queryWord) {
      setState({ loading: false, entry: null, terms: [], error: '未提供字詞' });
      return;
    }

    const controller = new AbortController();
    setState({ loading: true, entry: null, terms: [], error: null });

    fetch(`/api/${encodeURIComponent(queryWord)}.json`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as DictionaryAPIResponse | DictionaryErrorResponse;
        if (res.ok) {
          setState({ loading: false, entry: data as DictionaryAPIResponse, terms: [], error: null });
          return;
        }

        const terms = Array.isArray((data as DictionaryErrorResponse).terms)
          ? (data as DictionaryErrorResponse).terms ?? []
          : [];
        const message = (data as DictionaryErrorResponse).message ?? `查詢失敗 (${res.status})`;
        setState({ loading: false, entry: null, terms, error: terms.length > 0 ? null : message });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : '查詢失敗';
        setState({ loading: false, entry: null, terms: [], error: message });
      });

    return () => {
      controller.abort();
    };
  }, [queryWord]);

  const onContentClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;

    const normalized = normalizeHref(href);
    if (!normalized) return;
    event.preventDefault();
    navigate(normalized);
  };

  if (state.loading) {
    return (
      <div className="result">
        <h1 className="title">查詢中：{queryWord}</h1>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="result">
        <h1 className="title">找不到：{queryWord}</h1>
        <div className="entry">
          <div className="entry-item">
            <p className="def">{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.terms.length > 0) {
    return (
      <div className="result">
        <h1 className="title">未找到完整詞條：{queryWord}</h1>
        <div className="entry">
          <div className="entry-item">
            <p>可嘗試以下分字：</p>
            <ul>
              {state.terms.map((term) => (
                <li key={term}>
                  <a
                    href={`/${term}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/${term}`);
                    }}
                  >
                    {term}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const entry = state.entry;
  if (!entry) {
    return null;
  }

  const title = entry.title || queryWord;
  const heteronyms = Array.isArray(entry.heteronyms) ? entry.heteronyms : [];
  const translation = entry.translation ?? {};
  const english = translation.English ?? entry.English;
  const deutsch = translation.Deutsch ?? entry.Deutsch;
  const francais = translation.francais ?? entry.francais;

  return (
    <div className="result" onClick={onContentClick}>
      {heteronyms.map((heteronym, idx) => {
        const definitions = Array.isArray(heteronym.definitions) ? heteronym.definitions : [];
        const groups = new Map<string, Definition[]>();

        for (const def of definitions) {
          const key = (def.type ?? '').trim();
          const current = groups.get(key) ?? [];
          current.push(def);
          groups.set(key, current);
        }

        return (
          <div key={`${title}-${idx}`} className="entry">
            {(entry.radical || entry.stroke_count || entry.non_radical_stroke_count) && (
              <div className="radical">
                {entry.radical ? <span className="glyph">{entry.radical}</span> : null}
                <span className="sym">+</span>
                <span>{entry.non_radical_stroke_count ?? 0}</span>
                <span className="count"> = {entry.stroke_count ?? ''}</span>
              </div>
            )}

            <h1 className="title" data-title={title}>
              <span dangerouslySetInnerHTML={{ __html: title }} />
              {heteronym.audio_id && (
                <span className="audioBlock">
                  <i
                    role="button"
                    tabIndex={0}
                    className="icon-play playAudio part-of-speech"
                    title="播放發音"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudioUrl(getAudioUrl(LANG_A, heteronym.audio_id!));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        playAudioUrl(getAudioUrl(LANG_A, heteronym.audio_id!));
                      }
                    }}
                  />
                </span>
              )}
            </h1>

            {(heteronym.bopomofo || heteronym.pinyin || heteronym.trs) && (
              <div className="bopomofo">
                {heteronym.alt && (
                  <div lang="zh-Hans" className="cn-specific">
                    <span className="xref part-of-speech">简</span>
                    <span className="xref">{heteronym.alt}</span>
                  </div>
                )}
                {heteronym.bopomofo ? (
                  <div className="main-pronunciation">
                    <span className="bopomofo" dangerouslySetInnerHTML={{ __html: heteronym.bopomofo }} />
                  </div>
                ) : null}
                {heteronym.pinyin ? (
                  <div className="main-pronunciation">
                    <span className="pinyin" dangerouslySetInnerHTML={{ __html: heteronym.pinyin }} />
                  </div>
                ) : null}
                {heteronym.trs ? (
                  <div className="main-pronunciation">
                    <span className="pinyin" dangerouslySetInnerHTML={{ __html: heteronym.trs }} />
                  </div>
                ) : null}
              </div>
            )}

            {Array.from(groups.entries()).map(([type, items], groupIdx) => (
              <div key={`${type}-${groupIdx}`} className="entry-item">
                {type
                  ? type
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span key={`${type}-${tag}`} className="part-of-speech">
                          {untag(tag)}
                        </span>
                      ))
                  : null}
                <ol className={type ? 'margin-modified' : undefined}>
                  {items.map((def, defIdx) => (
                    <li key={`${type}-${defIdx}`}>
                      {def.def ? (
                        <div className="def" dangerouslySetInnerHTML={{ __html: def.def }} />
                      ) : null}

                      {toStringArray(def.example).map((text, exampleIdx) => (
                        <div
                          key={`example-${exampleIdx}`}
                          className="example"
                          dangerouslySetInnerHTML={{ __html: text.replace('例⃝', '<span class="specific">例</span>') }}
                        />
                      ))}

                      {toStringArray(def.quote).map((text, quoteIdx) => (
                        <div key={`quote-${quoteIdx}`} className="quote" dangerouslySetInnerHTML={{ __html: text }} />
                      ))}

                      {toStringArray(def.link).map((text, linkIdx) => (
                        <div key={`link-${linkIdx}`} className="quote" dangerouslySetInnerHTML={{ __html: text }} />
                      ))}

                      {toStringArray(def.synonyms).length > 0 ? (
                        <div className="synonyms">
                          <span className="part-of-speech">似</span>
                          <span>{untag(toStringArray(def.synonyms).join('、').replace(/,/g, '、'))}</span>
                        </div>
                      ) : null}

                      {toStringArray(def.antonyms).length > 0 ? (
                        <div className="antonyms">
                          <span className="part-of-speech">反</span>
                          <span>{untag(toStringArray(def.antonyms).join('、').replace(/,/g, '、'))}</span>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}

          </div>
        );
      })}

      {(english || deutsch || francais) && (
        <div className="xrefs">
          {english ? (
            <div className="xref-line">
              <span className="fw_lang">英</span>
              <span
                className="fw_def"
                data-label="英"
                data-text={cleanTextForTTS(english)}
                onClick={(e) => {
                  e.stopPropagation();
                  const text = (e.currentTarget.getAttribute('data-text') ?? '').trim();
                  if (text) speakText('英', text);
                }}
              >
                {formatTranslation(english)}
              </span>
            </div>
          ) : null}
          {deutsch ? (
            <div className="xref-line">
              <span className="fw_lang">德</span>
              <span
                className="fw_def"
                data-label="德"
                data-text={cleanTextForTTS(deutsch)}
                onClick={(e) => {
                  e.stopPropagation();
                  const text = (e.currentTarget.getAttribute('data-text') ?? '').trim();
                  if (text) speakText('德', text);
                }}
              >
                {formatTranslation(deutsch)}
              </span>
            </div>
          ) : null}
          {francais ? (
            <div className="xref-line">
              <span className="fw_lang">法</span>
              <span
                className="fw_def"
                data-label="法"
                data-text={cleanTextForTTS(francais)}
                onClick={(e) => {
                  e.stopPropagation();
                  const text = (e.currentTarget.getAttribute('data-text') ?? '').trim();
                  if (text) speakText('法', text);
                }}
              >
                {formatTranslation(francais)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {entry.xrefs && entry.xrefs.length > 0 ? (
        <div className="xrefs">
          {entry.xrefs.map((xref) => (
            <div key={xref.lang} className="xref-line">
              <span className="xref part-of-speech">{getLangName(xref.lang)}</span>
              <span className="xref">
                {xref.words.map((xrefWord, idx) => {
                  const to = `/${getLangPrefix(xref.lang)}${xrefWord}`;
                  return (
                    <span key={`${xref.lang}-${xrefWord}-${idx}`}>
                      {idx > 0 ? '、' : ''}
                      <a
                        href={to}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(to);
                        }}
                      >
                        {xrefWord}
                      </a>
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
