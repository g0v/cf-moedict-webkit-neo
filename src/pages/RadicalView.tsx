/**
 * 部首表頁面
 * 用途：顯示部首列表
 * 路由：/@, /~@
 * 參數：lang (靜態 - 由路由指定)
 */

type RadicalLang = 'a' | 'c';

interface RadicalViewProps {
  lang: RadicalLang;
}

export function RadicalView({ lang }: RadicalViewProps) {
  return (
    <div>
      <h1>部首表</h1>
      <p>語言：{lang}</p>
    </div>
  );
}

