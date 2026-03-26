/**
 * 復刻 moedict-webkit 舊版搜尋框的萬用字元語意：
 * - `*`/`%`：任意長度
 * - `?`/`.`/`_`：單一字元
 * - `^`/`$`：開頭／結尾
 */

function escapeRegex(text: string): string {
	return text.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

export function normalizeLegacySearchKeyword(keyword: string): string {
	return keyword
		.replace(/\*/g, '%')
		.replace(/[-—]/g, '－')
		.replace(/[,﹐]/g, '，')
		.replace(/[;﹔]/g, '；')
		.replace(/[﹒．]/g, '。');
}

export function hasLegacyPatternOperators(keyword: string): boolean {
	return /[%?._^$*]/.test(keyword);
}

function buildLegacySearchMatcher(keyword: string): ((word: string) => boolean) | null {
	const normalizedKeyword = normalizeLegacySearchKeyword(keyword);
	if (!normalizedKeyword.trim()) {
		return null;
	}

	const hasWildcard = /[%?._]/.test(normalizedKeyword);
	const anchorStart = /\s$/.test(normalizedKeyword) || /\^/.test(normalizedKeyword);
	const anchorEnd = /^\s/.test(normalizedKeyword) || /\$/.test(normalizedKeyword);
	const bareKeyword = normalizedKeyword
		.replace(/\^/g, '')
		.replace(/\$/g, '')
		.replace(/\s/g, '');

	let source = '';
	for (const char of Array.from(bareKeyword)) {
		if (char === '%') {
			source += '.*';
			continue;
		}
		if (char === '?' || char === '.' || char === '_') {
			source += '.';
			continue;
		}
		source += escapeRegex(char);
	}

	if (hasWildcard) {
		source = `^${source}$`;
	} else {
		if (anchorStart) {
			source = `^${source}`;
		}
		if (anchorEnd) {
			source = `${source}$`;
		}
	}

	try {
		const matcher = new RegExp(source);
		return (word: string) => matcher.test(word);
	} catch {
		return null;
	}
}

export function collectLegacyMatchedTerms(list: string[], keyword: string, limit: number): string[] {
	if (limit <= 0) {
		return [];
	}

	const matcher = buildLegacySearchMatcher(keyword);
	if (!matcher) {
		return [];
	}

	const matched: string[] = [];
	for (const term of list) {
		if (!matcher(term)) continue;
		matched.push(term);
		if (matched.length >= limit) {
			break;
		}
	}

	return matched;
}
