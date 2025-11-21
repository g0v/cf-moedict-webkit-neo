/**
 * 分類索引頁面
 * 用途：顯示特定分類下的字詞索引（如成語、天文、諺語等）
 * 路由：/={類名}, /'={類名}, /:={類名}, /~={類名}
 * 參數：category (動態), lang (靜態 - 由路由指定)
 */

type Lang = 'a' | 't' | 'h' | 'c';

interface GroupIndexProps {
  lang: Lang;
  category?: string;
}

export function GroupIndex({ lang, category }: GroupIndexProps) {
  return (
    <div>
      <h1>分類索引</h1>
      <p>分類：{category || '(未提供)'}</p>
      <p>語言：{lang}</p>
    </div>
  );
}

