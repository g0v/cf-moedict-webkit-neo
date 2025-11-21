/**
 * 兩岸字典頁面
 * 用途：顯示兩岸字詞的字典內容
 * 路由：/~{字}
 * 參數：word (動態), lang = 'c' (靜態)
 */

interface DictionaryProps {
  word?: string;
}

export function DictionaryC({ word }: DictionaryProps) {
  const lang = 'c';

  return (
    <div>
      <h1>兩岸字典頁面</h1>
      <p>字詞：{word || '(未提供)'}</p>
      <p>語言：{lang}</p>
    </div>
  );
}

