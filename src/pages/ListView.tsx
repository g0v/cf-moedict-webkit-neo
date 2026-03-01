/**
 * 分類詞彙列表頁面
 * 用途：顯示特定分類下的字詞列表（如成語、天文、諺語等）
 * 路由：/={類名}, /'={類名}, /:={類名}, /~={類名}
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'a' | 't' | 'h' | 'c';

interface ListViewProps {
  lang: Lang;
  category: string;
}

const LANG_PREFIX: Record<Lang, string> = {
  a: '',
  t: "'",
  h: ':',
  c: '~',
};

function wordPath(lang: Lang, word: string): string {
  return `/${LANG_PREFIX[lang]}${word}`;
}

export function ListView({ lang, category }: ListViewProps) {
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setWords([]);

    const prefix = LANG_PREFIX[lang];
    const apiUrl = `/api/${prefix}=${encodeURIComponent(category)}`;

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`找不到分類：${category}`);
        return res.json();
      })
      .then((data: unknown) => {
        // console.log(data);
        if (Array.isArray(data)) {
          setWords(data as string[]);
        } else {
          setError('資料格式錯誤');
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lang, category]);

  if (loading) {
    return (
      <div id="result" className="result prefer-pinyin-true">
        <div style={{ display: 'inline' }}>
          <h1 itemProp="name" style={{ visibility: 'visible' }}>{category}</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="result" className="result prefer-pinyin-true">
        <div style={{ display: 'inline' }}>
          <h1 itemProp="name" style={{ visibility: 'visible' }}>{category}</h1>
          <span style={{ clear: 'both', display: 'block' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div id="result" className="result prefer-pinyin-true">
      <div style={{ display: 'inline' }}>
        <h1 itemProp="name" style={{ visibility: 'visible' }}>{category}</h1>
        {words.map((word) => (
          <span key={word} style={{ clear: 'both', display: 'block' }}>
            <span>·</span>
            <Link to={wordPath(lang, word)}>{word}</Link>
          </span>
        ))}
      </div>
    </div>
  );
}
