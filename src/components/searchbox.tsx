/**
 * 左側欄搜尋框組件
 * 復刻原專案 moedict-webkit 的 query-box 功能
 * 使用 React Router 進行路由
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Lang = 'a' | 't' | 'h' | 'c';

interface SearchBoxProps {
	currentLang?: Lang;
}

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

/**
 * 從路徑提取搜尋詞
 */
function extractTermFromPath(pathname: string): string {
	if (pathname === '/' || pathname === '') return '';
	
	// 移除語言前綴
	let term = pathname;
	if (term.startsWith("/'")) term = term.slice(2);
	else if (term.startsWith('/:')) term = term.slice(2);
	else if (term.startsWith('/~')) term = term.slice(2);
	else if (term.startsWith('/')) term = term.slice(1);
	
	return term;
}

/**
 * 搜尋框組件
 */
export function SearchBox({ currentLang }: SearchBoxProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [searchValue, setSearchValue] = useState('');
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [suggestions, setSuggestions] = useState<Array<{ label: string; value: string }>>([]);
	const resolvedLang = currentLang || inferLangFromPath(location.pathname);
	const suggestionsRef = useRef<HTMLDivElement>(null);

	// 從路由更新輸入框值
	useEffect(() => {
		const term = extractTermFromPath(location.pathname);
		setSearchValue(term);
	}, [location.pathname]);

	// 處理輸入變化
	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value;
		setSearchValue(value);

		// TODO: 實作自動完成功能
		// 目前先關閉建議
		setSuggestions([]);
		setShowSuggestions(false);
	}, []);

	// 處理選擇建議
	const handleSelectSuggestion = useCallback((suggestion: { label: string; value: string }) => {
		setSearchValue(suggestion.value);
		setShowSuggestions(false);

		// 解析輸入值（可能包含語言前綴）
		const { lang: inputLang, cleanTerm } = parseSearchTerm(suggestion.value);
		// 如果有語言前綴，使用輸入的語言；否則使用當前語言
		const finalLang = cleanTerm !== suggestion.value ? inputLang : resolvedLang;
		const finalTerm = cleanTerm || suggestion.value;

		// 導航到對應路徑
		const path = formatSearchTerm(finalTerm, finalLang);
		navigate(path);
	}, [resolvedLang, navigate]);

	// 處理提交
	const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const trimmed = searchValue.trim();
		if (!trimmed) {
			return;
		}

		// 解析輸入值（可能包含語言前綴）
		const { lang: inputLang, cleanTerm } = parseSearchTerm(trimmed);
		// 如果有語言前綴，使用輸入的語言；否則使用當前語言
		const finalLang = cleanTerm !== trimmed ? inputLang : resolvedLang;
		const finalTerm = cleanTerm || trimmed;

		// 導航到對應路徑
		const path = formatSearchTerm(finalTerm, finalLang);
		navigate(path);
	}, [searchValue, resolvedLang, navigate]);

	// 處理點擊外部關閉建議選單
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				suggestionsRef.current &&
				!suggestionsRef.current.contains(e.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(e.target as Node)
			) {
				setShowSuggestions(false);
			}
		};

		if (showSuggestions) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [showSuggestions]);

	// 處理 Enter 鍵
	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			// 如果有建議且第一個建議被選中，使用第一個建議
			if (showSuggestions && suggestions.length > 0) {
				handleSelectSuggestion(suggestions[0]);
			} else {
				const form = e.currentTarget.closest('form');
				if (form) {
					form.requestSubmit();
				}
			}
		} else if (e.key === 'Escape') {
			setShowSuggestions(false);
		}
	}, [showSuggestions, suggestions, handleSelectSuggestion]);

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
					onFocus={() => {
						if (suggestions.length > 0) {
							setShowSuggestions(true);
						}
					}}
				/>
			</form>
			{showSuggestions && suggestions.length > 0 && (
				<div
					ref={suggestionsRef}
					className="ui-autocomplete"
				>
					<ul>
						{suggestions.slice(0, 50).map((suggestion, idx) => (
							<li
								key={idx}
								className="ui-menu-item"
								onClick={() => handleSelectSuggestion(suggestion)}
							>
								{suggestion.label}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

