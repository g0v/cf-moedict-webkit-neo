/**
 * 一般頁面的導航列組件
 * 復刻原專案 moedict-webkit 的導航列介面
 * 使用 React Router 進行路由
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type Lang = 'a' | 't' | 'h' | 'c';

interface NavbarNormalProps {
	currentLang?: Lang;
}

/**
 * 語言選項配置
 */
const LANG_OPTIONS = [
	{ key: 'a' as Lang, label: '華語辭典', path: '/' },
	{ key: 't' as Lang, label: '臺灣台語', path: "/'" },
	{ key: 'h' as Lang, label: '臺灣客語', path: '/:' },
	{ key: 'c' as Lang, label: '兩岸詞典', path: '/~' }
];

/**
 * 語言對應的特殊頁面
 */
const LANG_SPECIAL_PAGES = {
	a: [
		{ label: '…分類索引', path: '/=' },
		{ label: '…部首表', path: '/@' }
	],
	t: [
		{ label: '…分類索引', path: "/'=" },
		{ label: '…諺語', path: "/'=諺語" }
	],
	h: [
		{ label: '…諺語', path: '/:=諺語' }
	],
	c: [
		{ label: '…分類索引', path: '/~=' },
		{ label: '…部首表', path: '/~@' }
	]
};

/**
 * 根據語言獲取搜尋查詢附加條件
 */
function getSearchQueryAddition(lang: Lang): string {
	const searchConfig = {
		a: '-"臺灣台語萌典" -"兩岸萌典" -"臺灣客語萌典" -"推特" -"moedict tw lab" -"moedict tw dodo"',
		t: '+"臺灣台語萌典" -"兩岸萌典" -"臺灣客語萌典" -"推特" -"moedict tw lab" -"moedict tw dodo"',
		h: '+"臺灣客語萌典" -"臺灣台語萌典" -"兩岸萌典" -"推特" -"moedict tw lab" -"moedict tw dodo"',
		c: '+"兩岸萌典" -"臺灣台語萌典" -"臺灣客語萌典" -"推特" -"moedict tw lab" -"moedict tw dodo"'
	};

	return searchConfig[lang] || searchConfig.a;
}

/**
 * 從當前路徑推斷語言
 */
function inferLangFromPath(pathname: string): Lang {
	if (pathname.startsWith("/'")) return 't';
	if (pathname.startsWith('/:')) return 'h';
	if (pathname.startsWith('/~')) return 'c';
	return 'a';
}

function getStarredPath(lang: Lang): string {
	if (lang === 't') return "/'=*";
	if (lang === 'h') return '/:=*';
	if (lang === 'c') return '/~=*';
	return '/=*';
}

/**
 * 主要導航列組件
 */
export function NavbarNormal({ currentLang }: NavbarNormalProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const resolvedLang = currentLang || inferLangFromPath(location.pathname);
	const starredPath = getStarredPath(resolvedLang);
	const currentLangOption = LANG_OPTIONS.find(opt => opt.key === resolvedLang);
	const escAttr = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
	const [dropdownInitialized, setDropdownInitialized] = useState(false);
	const [r2Endpoint, setR2Endpoint] = useState<string>('');

	// 取得 R2 endpoint
	useEffect(() => {
		fetch('/api/config')
			.then((res) => res.json())
			.then((data: { assetBaseUrl?: string }) => {
				if (data.assetBaseUrl) {
					const endpoint = data.assetBaseUrl.replace(/\/$/, '');
					setR2Endpoint(endpoint);
				}
			})
			.catch(() => {
				// 如果 API 失敗，使用 /assets 路徑（由 Worker 代理）
				setR2Endpoint('');
			});
	}, []);

	// 動態載入 Bootstrap Dropdown
	useEffect(() => {
		if (dropdownInitialized) return;
		if (!r2Endpoint) {
			// 等待 AssetLoader 載入 jQuery
			const checkInterval = setInterval(() => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if ((window as any).jQuery) {
					clearInterval(checkInterval);
					initDropdown();
				}
			}, 100);
			return () => clearInterval(checkInterval);
		}

		const basePath = r2Endpoint || '/assets';

		const loadScript = (src: string): Promise<void> => {
			return new Promise((resolve, reject) => {
				// 檢查是否已經載入
				const existing = document.querySelector(`script[src="${src}"]`);
				if (existing) {
					resolve();
					return;
				}

				const script = document.createElement('script');
				script.src = src;
				script.onload = () => resolve();
				script.onerror = () => reject(new Error(`Failed to load: ${src}`));
				document.head.appendChild(script);
			});
		};

		const initDropdown = async () => {
			try {
				// 確保 jQuery 已載入
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if (!(window as any).jQuery) {
					await loadScript(`${basePath}/js/jquery-2.1.1.min.js`);
				}
				// 確保 Bootstrap dropdown 已載入
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if (!(window as any).jQuery?.fn?.dropdown) {
					await loadScript(`${basePath}/js/bootstrap/dropdown.js`);
				}
				// 初始化 dropdown
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const $ = (window as any).jQuery;
				if ($) {
					$(() => {
						try {
							$('.dropdown-toggle').dropdown();
						} catch (e) {
							console.warn('Dropdown 初始化失敗:', e);
						}
					});
				}
				setDropdownInitialized(true);
			} catch (e) {
				console.warn('載入 Bootstrap Dropdown 失敗:', e);
			}
		};

		if (r2Endpoint !== undefined) {
			initDropdown();
		}
	}, [dropdownInitialized, r2Endpoint]);

	const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
		// 允許外部連結和特殊按鍵行為
		if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
			return;
		}
		e.preventDefault();
		navigate(path);
	}, [navigate]);

	return (
		<>
			{/* 導航列背景 */}
			<div className="nav-bg navbar-fixed-top"></div>

			{/* 主要導航列 */}
			<nav role="navigation" className="navbar navbar-inverse navbar-fixed-top" style={{ opacity: 1 }}>
				{/* 左側區域 */}
				<div className="navbar-header">
					<Link to="/" className="navbar-brand brand ebas">
						萌典
					</Link>
				</div>

				<ul className="nav navbar-nav">
					{/* 辭典下拉選單 */}
					<li className="dropdown">
						<a href="#" data-toggle="dropdown" className="dropdown-toggle">
							<i className="icon-book">&nbsp;</i>
							<span
								style={{ margin: 0, padding: 0 }}
								itemProp="articleSection"
								className="lang-active"
							>
								{currentLangOption?.label || '華語辭典'}
							</span>
							<b className="caret"></b>
						</a>
						<ul role="navigation" className="dropdown-menu">
							{/* 每種語言及其特殊頁面 */}
							{LANG_OPTIONS.map(option => {
								const specialPages = LANG_SPECIAL_PAGES[option.key] || [];
								return (
									<Fragment key={option.key}>
										{/* 語言選項 */}
										<li role="presentation">
											<a
												role="menuitem"
												href={option.path}
												className={`lang-option ${option.key}`}
												onClick={(e) => handleLinkClick(e, option.path)}
											>
												{option.label}
											</a>
										</li>
										{/* 該語言的特殊頁面 */}
										{specialPages.map((page, index) => (
											<li key={`${option.key}-${index}`} role="presentation">
												<a
													href={page.path}
													className={`lang-option ${option.key} ${page.path.includes('諺語') ? 'idiom' : ''}`}
													onClick={(e) => handleLinkClick(e, page.path)}
												>
													{page.label}
												</a>
											</li>
										))}
									</Fragment>
								);
							})}
						</ul>
					</li>

					{/* 字詞紀錄簿按鈕 */}
					<li id="btn-starred">
						<a
							title="字詞紀錄簿"
							href={starredPath}
							onClick={(e) => handleLinkClick(e, starredPath)}
						>
							<i className="icon-bookmark-empty"></i>
						</a>
					</li>

					{/* 偏好設定按鈕 */}
					<li id="btn-pref">
						<a title="偏好設定" href="#">
							<i className="icon-cogs"></i>
						</a>
					</li>

					{/* 字體大小調整按鈕（僅 App 版） */}
					<li
						style={{ position: 'absolute', top: '2px', left: '8em', padding: '3px' }}
						className="resize-btn app-only"
					>
						<a
							style={{ paddingLeft: '5px', paddingRight: '5px', marginRight: '30px' }}
							onClick={(e) => {
								e.preventDefault();
								// TODO: 實現字體大小調整功能
							}}
						>
							<i className="icon-resize-small"></i>
						</a>
					</li>
					<li
						style={{ position: 'absolute', top: '2px', left: '8em', padding: '3px', marginLeft: '30px' }}
						className="resize-btn app-only"
					>
						<a
							style={{ paddingLeft: '5px', paddingRight: '5px' }}
							onClick={(e) => {
								e.preventDefault();
								// TODO: 實現字體大小調整功能
							}}
						>
							<i className="icon-resize-full"></i>
						</a>
					</li>
				</ul>

				{/* 右側區域 - 下載連結、搜尋框、社群連結 */}
				<ul className="nav pull-right hidden-xs" style={{ display: 'flex' }}>
					{/* Google 站內搜尋 */}
					<li style={{ display: 'inline-block' }} className="web-inline-only">
						<div id="gcse">
							<span
								className={`lang-${resolvedLang}-only`}
								dangerouslySetInnerHTML={{
									__html: `<gcse:search webSearchQueryAddition="${escAttr(getSearchQueryAddition(resolvedLang))}"></gcse:search>`
								}}
							/>
						</div>
					</li>

					<li style={{ display: 'inline-block' }}>
						<a
							href="https://racklin.github.io/moedict-desktop/download.html"
							target="_blank"
							rel="noopener noreferrer"
							title="桌面版下載(可離線使用)"
							style={{ color: '#ccc' }}
						>
							<i className="icon-download-alt"></i>
						</a>
					</li>

					<li style={{ display: 'inline-block' }}>
						<a
							href="https://play.google.com/store/apps/details?id=org.audreyt.dict.moe"
							target="_blank"
							rel="noopener noreferrer"
							title="Google Play 下載"
							style={{ color: '#ccc' }}
						>
							<i className="icon-android"></i>
						</a>
					</li>
					<li style={{ display: 'inline-block' }}>
						<a
							href="http://itunes.apple.com/app/id1434947403"
							target="_blank"
							rel="noopener noreferrer"
							title="App Store 下載"
							style={{ color: '#ccc' }}
						>
							<i className="icon-apple"></i>
						</a>
					</li>

					<li>
						<Link to="/about" title="關於本站">
							<span className="iconic-circle" style={{ backgroundColor: '#400' }}>
								<i className="icon-info"></i>
							</span>
						</Link>
					</li>
				</ul>
			</nav>
		</>
	);
}
