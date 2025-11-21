/**
 * 部首展開表頁面
 * 用途：顯示特定部首下的所有字詞
 * 路由：/@{部首}, /~@{部首}
 * 參數：radical (動態), lang (靜態 - 由路由指定)
 */

type RadicalLang = 'a' | 'c';

interface RadicalDetailViewProps {
  lang: RadicalLang;
  radical?: string;
}

export function RadicalDetailView({ lang, radical }: RadicalDetailViewProps) {
  return (
    <div>
      <h1>部首展開表</h1>
      <p>部首：{radical || '(未提供)'}</p>
      <p>語言：{lang}</p>
    </div>
  );
}

