import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom'
import { About } from './pages/About'
import { RadicalView } from './pages/RadicalView'
import { MiddlePoint } from './MiddlePoint'
import { DictionaryA } from './pages/Dictionary-a'
import { Layout } from './components/Layout'
import './App.css'

/**
 * Normal Layout 包裝器
 */
function NormalLayout() {
  const [r2Endpoint, setR2Endpoint] = useState<string>('');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: { assetBaseUrl?: string }) => {
        if (data.assetBaseUrl) {
          const endpoint = data.assetBaseUrl.replace(/\/$/, '');
          setR2Endpoint(endpoint);
        }
      })
      .catch((err) => {
        console.error('取得 ASSET_BASE_URL 失敗:', err);
      });
  }, []);

  return (
    <Layout layout="normal" r2Endpoint={r2Endpoint}>
      <Outlet />
    </Layout>
  )
}

/**
 * About Layout 包裝器
 */
function AboutLayout() {
  const [r2Endpoint, setR2Endpoint] = useState<string>('');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: { assetBaseUrl?: string }) => {
        if (data.assetBaseUrl) {
          const endpoint = data.assetBaseUrl.replace(/\/$/, '');
          setR2Endpoint(endpoint);
        }
      })
      .catch((err) => {
        console.error('取得 ASSET_BASE_URL 失敗:', err);
      });
  }, []);

  return (
    <Layout layout="about" r2Endpoint={r2Endpoint}>
      <Outlet />
    </Layout>
  )
}

/**
 * 路由切換時捲動至頁面頂部
 */
function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

/**
 * URL 解碼組件：監聽 URL 變化，當發現被編碼時自動還原
 * 注意：主要的攔截邏輯已經在 main.tsx 中設置，這裡只處理路由變化後的檢查
 */
function URLDecoder() {
  const location = useLocation();

  useEffect(() => {
    // 當路由變化時，檢查並修正 URL（作為備用機制）
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('%')) {
      try {
        const decoded = decodeURIComponent(currentPath);
        if (decoded !== currentPath) {
          // 使用 replaceState 避免在歷史記錄中留下編碼的 URL
          window.history.replaceState(null, '', decoded);
        }
      } catch (e) {
        console.warn('URL 解碼失敗:', e);
      }
    }
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <URLDecoder />
      <Routes>
        {/* About 頁面使用 about layout */}
        <Route element={<AboutLayout />}>
          <Route path="/about" element={<About />} />
          <Route path="/about.html" element={<About />} />
        </Route>

        {/* 其他頁面使用 normal layout */}
        <Route element={<NormalLayout />}>
          {/* 首頁路由 */}
          <Route path="/" element={<DictionaryA word="萌" />} />
          
          {/* 部首表（唯一合法的純靜態 segment） */}
          <Route path="/@" element={<RadicalView lang='a' />} />
          <Route path="/~@" element={<RadicalView lang='c' />} />

          {/* 其他路由交由 MiddlePoint 分流 */}
          <Route path="*" element={<MiddlePoint />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
