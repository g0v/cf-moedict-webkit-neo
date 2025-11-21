/**
 * 客語字典頁面
 * 用途：顯示客語字詞的字典內容
 * 路由：/:{字}
 * 參數：word (動態), lang = 'h' (靜態)
 */

interface DictionaryProps {
  word?: string;
}

export function DictionaryH({ word }: DictionaryProps) {
  const lang = 'h';

  return (
    <div>
      <h1>客語字典頁面</h1>
      <p>字詞：{word || '(未提供)'}</p>
      <p>語言：{lang}</p>
    </div>
  );
}

