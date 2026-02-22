# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## 開發準備

### 上傳字典與資產

此專案提供兩支腳本，協助將資料與前端資產同步至 Cloudflare R2 Storage。執行前請確認：
- 已安裝並設定 `rclone`，且存在名為 `r2` 的 remote。
- `data/dictionary` 與 `data/assets` 目錄已備妥要上傳的內容。

指令說明：
- `sh commands/upload_dictionary.sh`：同步 `data/dictionary` 底下的 `pack`、`pcck`、`phck`、`ptck` 目錄到 `r2:moedict-dictionary`。 (windows環境是`bash commands/upload_dictionary.sh`)
- `sh commands/upload_assets.sh`：同步 `data/assets` 目錄到 `r2:moedict-assets-preview`。(windows環境是`bash commands/upload_assets.sh`)

腳本會自動檢查環境並以 `rclone sync` 執行上傳，結束後亦會輸出摘要與驗證結果。若需進一步調整或排查，請參考 `commands` 目錄中的腳本內容。


### 設定資產端點（ASSET_BASE_URL）

- 本專案的 CSS/JS/圖片/字體會透過 `ASSET_BASE_URL` 從 R2 公開端點載入。
- 請先複製範本設定，並填上你自己的 bucket 與公開端點：

```bash
cp wrangler.jsonc.example wrangler.jsonc
# 編輯 wrangler.jsonc → vars.ASSET_BASE_URL: "https://<your-pub-id>.r2.dev"
```

- 若未設定 `ASSET_BASE_URL`，伺服器端渲染會直接報錯提示。

### 部署到 CloudFlare

#### 1. 設置 CloudFlare 認證
```bash
wrangler auth login
```

#### 2. 創建必要資源
```bash


# 創建 R2 Storage
wrangler r2 bucket create moedict-fonts
wrangler r2 bucket create moedict-fonts-preview
wrangler r2 bucket create moedict-assets
wrangler r2 bucket create moedict-assets-preview
wrangler r2 bucket create moedict-dictionary
wrangler r2 bucket create moedict-dictionary-preview
```

#### 3. 更新配置
- 以 `wrangler.jsonc.example` 為範本建立 `wrangler.jsonc`
- 在 `vars` 設定你的公開資產端點：

```jsonc
{
  "vars": {
    "ASSET_BASE_URL": "https://<your-pub-id>.r2.dev"
  }
}
```

#### 4. 近端測試

```bash
# 近端測試
npm run dev
```

#### 5. 部署 Worker
```bash
# 部署到生產環境
npm run deploy

# 或使用 wrangler 直接部署
npx wrangler deploy
```
