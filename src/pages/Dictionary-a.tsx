/**
 * 華語字典頁面
 * 用途：顯示華語字詞的字典內容
 * 路由：/{字}
 * 參數：word (動態), lang = 'a' (靜態)
 */

interface DictionaryProps {
  word?: string;
}

export function DictionaryA({ word }: DictionaryProps) {
  const lang = 'a';

  return (
    <div>
      <h1>華語字典頁面</h1>
      <p>字詞：{word || '(未提供)'}</p>
      <p>語言：{lang}</p>
    </div>
  );
}

