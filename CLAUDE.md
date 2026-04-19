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
npm run typecheck # tsc -b --noEmit

# Tests (three tiers)
npm run test:unit          # Vitest + happy-dom (src/utils, src/ssr, src/api)
npm run test:integration   # Miniflare-backed worker API tests (hermetic, seeded from data/dictionary/)
npm run test:e2e           # Playwright browser tests (excludes visual regression)
npm run test:e2e:visual    # Playwright visual regression (baselines per-OS)
npm run test:e2e:update    # Regenerate Playwright snapshots for current platform
npm run test               # Run all three tiers sequentially
```

### Visual regression baselines

Visual snapshots live at `tests/e2e/visual-snapshots.spec.ts-snapshots/`. Only `*-chromium-linux.png`
is committed (see `.gitignore`); darwin/win32 variants are developer-local. To update Linux
baselines, run the `visual` CI job with `--update-snapshots` (or use a Linux runner/Codespace).

### Combined coverage across tiers

```bash
npm run test:coverage   # unit + integration + e2e, merged into coverage/combined/
```

The merge pipeline (`scripts/merge-coverage.mjs`) unifies three coverage sources into a single
Istanbul report:

- **Unit** (vitest v8 provider) — per-statement attribution, written to `coverage/unit/`.
- **Integration** (vitest v8 provider) — mostly empty on `src/api/**` and `worker/**` because the
  worker runs in Miniflare's separate workerd isolate, which vitest's collector can't see into.
  API handlers are attributed via `tests/unit/api-handlers-direct.test.ts` which calls them
  directly with a mock R2. The routing switch in `worker/index.ts` is similarly attributed via
  `tests/unit/worker-dispatch.test.ts` — we export a pure `dispatch(request, env)` function that
  both the default handler and the unit tests call, so the full 535-line routing table lights up
  under vitest's instrumentation without needing workerd's inspector. (Miniflare exposes the CDP
  inspector, but workerd doesn't implement `Profiler.*`, so precise V8 coverage extraction through
  it isn't available — hence the refactor.)
- **E2E** (Playwright `page.coverage.startJSCoverage`) — collected per-test by the fixture in
  `tests/e2e/_fixtures.ts`, then converted back to `src/**/*.ts` via `v8-to-istanbul` using Vite
  sourcemaps (emitted only when `E2E_COVERAGE=1` is set during the build).

Output lives in `coverage/combined/` (`coverage-final.json` + `lcov.info`). The text summary
reports ~96% combined statement coverage but two caveats:

- **V8's "line" metric is coarse.** V8 reports function-level coverage and v8-to-istanbul maps
  function declarations (not bodies) to lines, so a file whose functions are loaded but never
  called can show up as 100% lines / 0% functions. Prefer the statement and function numbers.
- **workerd still isn't instrumented.** Integration runs don't attribute anything to `src/api/**`
  or `worker/index.ts` at runtime — those files are covered instead by the direct-call unit tests
  (`tests/unit/api-handlers-direct.test.ts` and `tests/unit/worker-dispatch.test.ts`). If you add
  a new branch to worker/index.ts or a handler, make sure the matching direct-call test exercises
  it; Miniflare integration alone won't move the coverage needle.

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
