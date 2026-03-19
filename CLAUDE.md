# cf-moedict-webkit-neo

萌典（moedict）字典查詢網站，部署於 Cloudflare Workers，使用 React + TypeScript + Vite 開發。

## 技術棧

- **前端**: React 19, TypeScript, Vite, react-router-dom v7
- **後端**: Cloudflare Workers (`worker/index.ts`)
- **儲存**: Cloudflare R2（FONTS、ASSETS、DICTIONARY buckets）
- **部署工具**: Wrangler v4

## 目錄結構

```
src/
  pages/          # 頁面元件（Dictionary-a/c/h/t、About、GroupIndex、RadicalView、StarredPage）
  components/     # 共用元件（Layout、navbar、searchbox、sidebar、AssetLoader、InlineStyles）
  api/            # API 呼叫
  hooks/          # 自訂 hooks
  utils/          # 工具函式
worker/
  index.ts        # Cloudflare Worker 入口
data/
  dictionary/     # 字典資料（上傳至 R2）
  assets/         # 前端資產（上傳至 R2）
commands/         # 上傳腳本（upload_dictionary.sh、upload_assets.sh）
```

## 常用指令

```bash
npm run dev       # 本地開發
npm run build     # 建置
npm run deploy    # 建置並部署至 Cloudflare
npm run lint      # ESLint 檢查
```

## 環境設定

專案已版本化管理 `wrangler.jsonc`，無須從範本複製。若使用自有 R2 bucket 或公開網域，請直接編輯該檔：

- `r2_buckets`: 各 `binding`（`FONTS`、`ASSETS`、`DICTIONARY`）對應的 bucket 名稱
- `vars.ASSET_BASE_URL`: CSS/JS/圖片/字體的公開基底 URL
- `vars.DICTIONARY_BASE_URL`: `/api/config` 回傳的字典基底 URL（實際 JSON 多由 Worker 綁定 `DICTIONARY` R2 提供）

## R2 Buckets

| Binding    | Bucket Name               |
|------------|---------------------------|
| FONTS      | moedict-fonts             |
| ASSETS     | moedict-assets            |
| DICTIONARY | moedict-dictionary        |

## 部署流程

1. `wrangler auth login`（首次）
2. 建立 R2 buckets（首次）
3. 上傳字典資料：`sh commands/upload_dictionary.sh`
4. 上傳資產：`sh commands/upload_assets.sh`
5. `npm run deploy`

## 注意事項

- 字典頁面依語言分為 Dictionary-a（All）、Dictionary-c（漢語）、Dictionary-h（閩南語）、Dictionary-t（客語）
