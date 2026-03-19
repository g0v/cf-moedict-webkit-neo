# 本專案靜態 CDN 資源清單

本文記錄目前專案程式碼中實際使用的靜態 CDN 資源（含硬編碼與環境變數設定）。

## 一、Rackspace CDN（硬編碼）

### 1) 筆畫 JSON（`stroke-json`）
- CDN：`https://829091573dd46381a321-9e8a43b8d3436eaf4353af683c892840.ssl.cf1.rackcdn.com`
- 用途：提供筆順 JSON 資料（由 Worker 代理，路由為 `/api/stroke-json/{codepoint}.json`）
- 使用位置：`src/api/handleStrokeAPI.ts`

### 2) 音檔 CDN（華語/兩岸）
- CDN：`https://203146b5091e8f0aafda-15d41c68795720c6e932125f5ace0c70.ssl.cf1.rackcdn.com`
- 用途：`a`（華語）與 `c`（兩岸）音檔來源
- 使用位置：`src/utils/audio-utils.ts`

### 3) 音檔 CDN（閩南語）
- CDN：`https://a7ff62cf9d5b13408e72-351edcddf20c69da65316dd74d25951e.ssl.cf1.rackcdn.com`
- 用途：
  - `h`（閩南語）音檔來源
  - 客語腔調音檔組合 URL（`{variant}-{audioId}.ogg`）的 base URL
- 使用位置：`src/utils/audio-utils.ts`、`src/pages/DictionaryPage.tsx`

### 4) 音檔 CDN（客語）
- CDN：`https://1763c5ee9859e0316ed6-db85b55a6a3fbe33f09b9245992383bd.ssl.cf1.rackcdn.com`
- 用途：`t`（客語）音檔來源
- 使用位置：`src/utils/audio-utils.ts`

## 二、Cloudflare R2 公開端點（以變數設定）

### 1) 靜態資產端點
- 變數：`ASSET_BASE_URL`
- 目前設定（本機）：`https://pub-1808868ac1e14b13abe9e2800cace884.r2.dev`
- 用途：當 Worker 內建資產找不到時，回退代理 `/assets/*` 請求到此端點
- 使用位置：`wrangler.jsonc`、`worker/index.ts`

### 2) 字典資料端點
- 變數：`DICTIONARY_BASE_URL`
- 目前設定（本機）：`https://pub-7e5ed83262e5403d85cb5a04ff841cf4.r2.dev`
- 用途：透過 `/api/config` 回傳給前端作為字典資料來源設定
- 使用位置：`wrangler.jsonc`、`worker/index.ts`

## 補充

- 若未來調整 CDN，請同步更新：
  - `src/api/handleStrokeAPI.ts`
  - `src/utils/audio-utils.ts`
  - `src/pages/DictionaryPage.tsx`
  - `wrangler.jsonc`（或部署環境對應設定）
