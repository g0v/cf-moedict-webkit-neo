/**
 * 字詞記錄簿頁面
 * 用途：顯示使用者收藏的字詞記錄
 * 路由：/=*, /'=*, /:=*, /~=*
 * 參數：lang (靜態), entry (由 MiddlePoint 傳入)
 */

type Lang = 'a' | 't' | 'h' | 'c';

interface StarredPageProps {
  lang: Lang;
  entry?: string;
}

export function StarredPage({ lang, entry }: StarredPageProps) {
  return (
    <div>
      <h1>字詞記錄簿</h1>
      <p>語言：{lang}</p>
      <p>記錄項目：{entry || '(未提供)'}</p>
    </div>
  );
}

