import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import cloudflareLogo from './assets/Cloudflare_Logo.svg'
import { About } from './pages/About'
import { RadicalView } from './pages/RadicalView'
import { MiddlePoint } from './MiddlePoint'
import './App.css'

function Home() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('unknown')

  return (
    <>
      <div>
        <a href='https://vite.dev' target='_blank'>
          <img src={viteLogo} className='logo' alt='Vite logo' />
        </a>
        <a href='https://react.dev' target='_blank'>
          <img src={reactLogo} className='logo react' alt='React logo' />
        </a>
        <a href='https://workers.cloudflare.com/' target='_blank'>
          <img src={cloudflareLogo} className='logo cloudflare' alt='Cloudflare logo' />
        </a>
      </div>
      <h1>Vite + React + Cloudflare</h1>
      <div className='card'>
        <button
          onClick={() => setCount((count) => count + 1)}
          aria-label='increment'
        >
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className='card'>
        <button
          onClick={() => {
            fetch('/api/')
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name))
          }}
          aria-label='get name'
        >
          Name from API is: {name}
        </button>
        <p>
          Edit <code>worker/index.ts</code> to change the name
        </p>
      </div>
      <p className='read-the-docs'>
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
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
      <URLDecoder />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/about.html" element={<About />} />
        
        {/* 部首表（唯一合法的純靜態 segment） */}
        <Route path="/@" element={<RadicalView lang='a' />} />
        <Route path="/~@" element={<RadicalView lang='c' />} />

        {/* 其他路由交由 MiddlePoint 分流 */}
        <Route path="*" element={<MiddlePoint />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
