/**
 * 左側欄搜尋框組件
 * 復刻原專案 moedict-webkit 的 query-box 功能
 * 使用 React Router 進行路由
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Lang = 'a' | 't' | 'h' | 'c';

interface SearchBoxProps {
	currentLang?: Lang;
}

interface SuggestionItem {
	label: string;
	value: string;
	lang: Lang;
}

const SEARCH_RESULT_LIMIT = 50;
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';
const INDEX_CACHE = new Map<Lang, string[]>();
const INDEX_PROMISE_CACHE = new Map<Lang, Promise<string[]>>();
const INDEX_FALLBACK_ORDER: Record<Lang, Lang[]> = {
	a: ['a'],
	t: ['t'],
	h: ['h'],
	c: ['c', 'a'],
};

/**
 * 從字詞提取語言前綴和清理後的字詞
 */
function parseSearchTerm(term: string): { lang: Lang; cleanTerm: string } {
	const trimmed = term.trim();
	if (trimmed.startsWith("'") || trimmed.startsWith('!')) {
		return { lang: 't', cleanTerm: trimmed.slice(1) };
	}
	if (trimmed.startsWith(':')) {
		return { lang: 'h', cleanTerm: trimmed.slice(1) };
	}
	if (trimmed.startsWith('~')) {
		return { lang: 'c', cleanTerm: trimmed.slice(1) };
	}
	return { lang: 'a', cleanTerm: trimmed };
}

/**
 * 格式化字詞為完整路由路徑（包含語言前綴）
 */
function formatSearchTerm(term: string, lang: Lang): string {
	if (!term || !term.trim()) {
		return '/';
	}
	const prefix = lang === 'a' ? '' : lang === 't' ? "/'" : lang === 'h' ? '/:' : '/~';
	return `${prefix}${term.trim()}`;
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

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * 從路徑提取搜尋詞
 */
function extractTermFromPath(pathname: string): string {
	if (pathname === '/' || pathname === '') return '';

	const rawPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
	if (!rawPath) return '';

	const decodedPath = safeDecode(rawPath);
	if (decodedPath.includes('/')) return '';

	if (decodedPath.startsWith("'")) {
		const term = decodedPath.slice(1);
		return term.startsWith('=') ? '' : term;
	}

	if (decodedPath.startsWith(':')) {
		const term = decodedPath.slice(1);
		return term.startsWith('=') ? '' : term;
	}

	if (decodedPath.startsWith('~')) {
		const term = decodedPath.slice(1);
		if (!term || term.startsWith('@') || term.startsWith('=')) return '';
		return term;
	}

	if (decodedPath.startsWith('@') || decodedPath.startsWith('=')) {
		return '';
	}

	return decodedPath;
}

function resolveSearchInput(input: string, fallbackLang: Lang): { lang: Lang; term: string } | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	const { lang: parsedLang, cleanTerm } = parseSearchTerm(trimmed);
	const hasLangPrefix = cleanTerm !== trimmed;
	const term = cleanTerm.trim();
	if (!term) return null;

	return {
		lang: hasLangPrefix ? parsedLang : fallbackLang,
		term,
	};
}

async function fetchIndexForLang(lang: Lang): Promise<string[]> {
	const cached = INDEX_CACHE.get(lang);
	if (cached) {
		return cached;
	}

	const pending = INDEX_PROMISE_CACHE.get(lang);
	if (pending) {
		return pending;
	}

	const request = fetch(`/api/index/${lang}.json`, {
		headers: { Accept: 'application/json' },
	})
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`索引讀取失敗: ${response.status}`);
			}
			const data = (await response.json()) as unknown;
			if (!Array.isArray(data)) {
				return [];
			}
			return data.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
		})
		.catch(() => [])
		.then((list) => {
			INDEX_CACHE.set(lang, list);
			return list;
		})
		.finally(() => {
			INDEX_PROMISE_CACHE.delete(lang);
		});

	INDEX_PROMISE_CACHE.set(lang, request);
	return request;
}

async function loadIndexByLang(lang: Lang): Promise<string[]> {
	const fallbackOrder = INDEX_FALLBACK_ORDER[lang] ?? [lang];
	for (const targetLang of fallbackOrder) {
		const list = await fetchIndexForLang(targetLang);
		if (list.length > 0 || targetLang === fallbackOrder[fallbackOrder.length - 1]) {
			return list;
		}
	}
	return [];
}

function collectMatchedTerms(list: string[], keyword: string, limit: number): string[] {
	const cleanKeyword = keyword.trim();
	if (!cleanKeyword) return [];

	const matched: string[] = [];
	for (const term of list) {
		if (!term.includes(cleanKeyword)) continue;
		matched.push(term);
		if (matched.length >= limit) break;
	}
	return matched;
}

/**
 * 搜尋框組件
 */
export function SearchBox({ currentLang }: SearchBoxProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const requestIdRef = useRef(0);
	const [searchValue, setSearchValue] = useState('');
	const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
		if (typeof window === 'undefined') return false;
		return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
	});
	const [showMobileResults, setShowMobileResults] = useState(false);
	const resolvedLang = currentLang || inferLangFromPath(location.pathname);

	// 從路由更新輸入框值
	useEffect(() => {
		const term = extractTermFromPath(location.pathname);
		setSearchValue(term);
	}, [location.pathname]);

	// 監聽 viewport，切換桌機/手機搜尋結果行為
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
		const handleChange = (event: MediaQueryListEvent) => {
			setIsMobileViewport(event.matches);
		};

		setIsMobileViewport(mediaQuery.matches);

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', handleChange);
			return () => {
				mediaQuery.removeEventListener('change', handleChange);
			};
		}

		mediaQuery.addListener(handleChange);
		return () => {
			mediaQuery.removeListener(handleChange);
		};
	}, []);

	const activeSearch = useMemo(
		() => resolveSearchInput(searchValue, resolvedLang),
		[searchValue, resolvedLang]
	);
	const activeSearchLang = activeSearch?.lang ?? resolvedLang;
	const activeSearchTerm = activeSearch?.term ?? '';
	const hasActiveSearch = activeSearchTerm.length > 0;

	// Search 字詞變更時，手機結果面板預設收合
	useEffect(() => {
		setShowMobileResults(false);
	}, [activeSearchLang, activeSearchTerm, isMobileViewport]);

	// 從 index.json 載入搜尋結果
	useEffect(() => {
		if (!hasActiveSearch) {
			setLoadingSuggestions(false);
			setSuggestions([]);
			return;
		}

		const requestId = ++requestIdRef.current;
		setLoadingSuggestions(true);

		const timer = window.setTimeout(() => {
			loadIndexByLang(activeSearchLang)
				.then((indexTerms) => {
					if (requestId !== requestIdRef.current) return;
					const matchedTerms = collectMatchedTerms(indexTerms, activeSearchTerm, SEARCH_RESULT_LIMIT);
					setSuggestions(
						matchedTerms.map((term) => ({
							label: term,
							value: term,
							lang: activeSearchLang,
						}))
					);
				})
				.catch(() => {
					if (requestId !== requestIdRef.current) return;
					setSuggestions([]);
				})
				.finally(() => {
					if (requestId === requestIdRef.current) {
						setLoadingSuggestions(false);
					}
				});
		}, 100);

		return () => {
			window.clearTimeout(timer);
		};
	}, [activeSearchLang, activeSearchTerm, hasActiveSearch]);

	const syncRouteWithInput = useCallback(
		(rawValue: string, replace: boolean) => {
			const resolved = resolveSearchInput(rawValue, resolvedLang);
			if (!resolved) return;

			const nextPath = formatSearchTerm(resolved.term, resolved.lang);
			if (nextPath === location.pathname) return;
			navigate(nextPath, { replace });
		},
		[location.pathname, navigate, resolvedLang]
	);

	// 處理輸入變化：同步更新路由
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.currentTarget.value;
			setSearchValue(value);
			syncRouteWithInput(value, true);
		},
		[syncRouteWithInput]
	);

	// 處理選擇建議
	const handleSelectSuggestion = useCallback(
		(suggestion: SuggestionItem) => {
			setSearchValue(suggestion.value);
			setShowMobileResults(false);

			const path = formatSearchTerm(suggestion.value, suggestion.lang);
			navigate(path);
		},
		[navigate]
	);

	// 處理提交
	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			const resolved = resolveSearchInput(searchValue, resolvedLang);
			if (!resolved) return;
			const path = formatSearchTerm(resolved.term, resolved.lang);
			navigate(path);
		},
		[navigate, resolvedLang, searchValue]
	);

	// 處理 Enter 鍵
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				if (!loadingSuggestions && suggestions.length > 0) {
					handleSelectSuggestion(suggestions[0]);
					return;
				}

				const form = e.currentTarget.closest('form');
				if (form) {
					form.requestSubmit();
				}
			} else if (e.key === 'Escape') {
				setShowMobileResults(false);
			}
		},
		[handleSelectSuggestion, loadingSuggestions, suggestions]
	);

	const shouldShowMobileToggle = isMobileViewport && hasActiveSearch;
	const shouldRenderResultList = hasActiveSearch && (!isMobileViewport || showMobileResults);

	return (
		<div className="search-container" style={{ position: 'relative' }}>
			<form onSubmit={handleSubmit} className="search-form">
				<input
					ref={inputRef}
					id="query"
					type="search"
					className="query"
					autoComplete="off"
					placeholder="請輸入欲查詢的字詞"
					value={searchValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
				/>
			</form>
			{shouldShowMobileToggle && (
				<button
					type="button"
					className="mobile-search-toggle"
					aria-expanded={showMobileResults}
					onClick={() => setShowMobileResults((prev) => !prev)}
				>
					<span className="mobile-search-toggle-arrow" aria-hidden="true">
						{showMobileResults ? '↓' : '→'}
					</span>
					<span className="mobile-search-toggle-label">列出所有含有「{activeSearchTerm}」的詞</span>
				</button>
			)}
			{shouldRenderResultList && (
				<ul
					className="ui-autocomplete ui-front ui-menu ui-widget ui-widget-content ui-corner-all invisible search-results"
					id="sidebar-search-results"
					role="listbox"
					style={{ position: 'fixed', zIndex: isMobileViewport ? 2200 : 1200 }}
				>
					{loadingSuggestions && (
						<li className="ui-menu-item is-status" role="presentation">
							<span className="ui-corner-all">搜尋中…</span>
						</li>
					)}
					{!loadingSuggestions && suggestions.length === 0 && (
						<li className="ui-menu-item is-status" role="presentation">
							<span className="ui-corner-all">沒有符合結果</span>
						</li>
					)}
					{!loadingSuggestions &&
						suggestions.map((suggestion, idx) => (
							<li key={`${suggestion.lang}:${suggestion.value}:${idx}`} className="ui-menu-item" role="presentation">
								<a
									className="ui-corner-all"
									tabIndex={-1}
									role="button"
									onClick={() => handleSelectSuggestion(suggestion)}
									onKeyDown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											handleSelectSuggestion(suggestion);
										}
									}}
								>
									{suggestion.label}
								</a>
							</li>
						))}
				</ul>
			)}
		</div>
	);
}
