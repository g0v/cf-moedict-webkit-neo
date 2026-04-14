import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'data', 'dictionary', 'ptck');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'data', 'dictionary', 'lookup', 'pinyin', 't');
const PINYIN_TYPES = ['TL', 'DT', 'POJ'];

function normalizeTitle(input) {
	return String(input ?? '')
		.replace(/[`~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeLookupTerm(input) {
	return String(input ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Mark}/gu, '')
		.replace(/ⁿ/g, 'nn')
		.replace(/ɑ/g, 'a')
		.replace(/[^a-z]/g, '');
}

function decodePackedKey(input) {
	return String(input ?? '')
		.replace(/%u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
		.replace(/%([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function extractTitle(packedKey, entry) {
	const fromEntry = normalizeTitle(entry?.t);
	if (fromEntry) return fromEntry;
	return normalizeTitle(decodePackedKey(packedKey));
}

function extractTlRawTokens(romanization) {
	return String(romanization ?? '').match(/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\u0300-\u036F\u207F]+/g) ?? [];
}

function convertTlTokenToDt(rawToken) {
	return String(rawToken ?? '')
		.toLowerCase()
		.replace(/ph(\w)/g, 'PH$1')
		.replace(/b(\w)/g, 'bh$1')
		.replace(/p(\w)/g, 'b$1')
		.replace(/PH(\w)/g, 'p$1')
		.replace(/tsh/g, 'c')
		.replace(/ts/g, 'z')
		.replace(/th(\w)/g, 'TH$1')
		.replace(/t(\w)/g, 'd$1')
		.replace(/TH(\w)/g, 't$1')
		.replace(/kh(\w)/g, 'KH$1')
		.replace(/g(\w)/g, 'gh$1')
		.replace(/k(\w)/g, 'g$1')
		.replace(/KH(\w)/g, 'k$1')
		.replace(/j/g, 'r')
		.replace(/([aeiou])(r?[ptkh])$/g, '$1$2')
		.replace(/nn$/g, 'n')
		.toLowerCase();
}

function convertTlTokenToPoj(rawToken) {
	return String(rawToken ?? '')
		.toLowerCase()
		.replace(/ts/g, 'ch')
		.replace(/u([^\w]*)a/g, 'o$1a')
		.replace(/u([^\w]*)e/g, 'o$1e')
		.replace(/i([^\w]*)k$/g, 'e$1k')
		.replace(/i([^\w]*)ng/g, 'e$1ng')
		.replace(/nnh$/g, 'hnn')
		.replace(/nn$/g, 'n')
		.replace(/([ie])r/g, '$1');
}

function insertIndex(index, title, terms) {
	const posMap = new Map();
	const freqMap = new Map();

	for (const [position, term] of terms.entries()) {
		const normalized = normalizeLookupTerm(term);
		if (!normalized) continue;

		if (!posMap.has(normalized)) {
			posMap.set(normalized, position);
		}
		freqMap.set(normalized, (freqMap.get(normalized) ?? 0) + 1);
	}

	for (const [term, frequency] of freqMap.entries()) {
		let docs = index.get(term);
		if (!docs) {
			docs = new Map();
			index.set(term, docs);
		}

		const existing = docs.get(title);
		if (!existing) {
			docs.set(title, [posMap.get(term) ?? 0, frequency]);
			continue;
		}

		existing[1] += frequency;
	}
}

function collectTermsByType(trsValue) {
	const tlRawTokens = extractTlRawTokens(trsValue);

	const tl = [];
	const dt = [];
	const poj = [];

	for (const token of tlRawTokens) {
		const tlToken = normalizeLookupTerm(token);
		if (tlToken) tl.push(tlToken);

		const dtToken = normalizeLookupTerm(convertTlTokenToDt(token));
		if (dtToken) dt.push(dtToken);

		const pojToken = normalizeLookupTerm(convertTlTokenToPoj(token));
		if (pojToken) poj.push(pojToken);
	}

	return { TL: tl, DT: dt, POJ: poj };
}

function sortDocs(termDocs) {
	return Array.from(termDocs.entries())
		.map(([title, [firstPos, frequency]]) => ({ title, firstPos, frequency }))
		.sort((left, right) => {
			return (
				left.title.length - right.title.length ||
				left.firstPos - right.firstPos ||
				right.frequency - left.frequency ||
				left.title.localeCompare(right.title, 'zh-Hant')
			);
		})
		.map((row) => row.title);
}

async function getBucketFiles(sourceDir) {
	const files = await fs.readdir(sourceDir);
	return files
		.filter((name) => /^\d+\.txt$/.test(name))
		.sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));
}

async function ensureOutputDirs() {
	await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
	for (const type of PINYIN_TYPES) {
		await fs.mkdir(path.join(OUTPUT_ROOT, type), { recursive: true });
	}
}

async function writeIndexes(indexByType) {
	for (const type of PINYIN_TYPES) {
		const typeDir = path.join(OUTPUT_ROOT, type);
		const typeIndex = indexByType.get(type);
		let count = 0;

		for (const [term, docs] of typeIndex.entries()) {
			const filePath = path.join(typeDir, `${encodeURIComponent(term)}.json`);
			const payload = JSON.stringify(sortDocs(docs));
			await fs.writeFile(filePath, payload);
			count += 1;
		}

		console.log(`[build-pinyin-lookup] wrote t/${type}: ${count} terms`);
	}
}

async function main() {
	const bucketFiles = await getBucketFiles(SOURCE_DIR);
	if (bucketFiles.length === 0) {
		throw new Error(`找不到台語詞典資料：${SOURCE_DIR}`);
	}

	const indexByType = new Map(PINYIN_TYPES.map((type) => [type, new Map()]));

	for (const bucketFile of bucketFiles) {
		const bucketPath = path.join(SOURCE_DIR, bucketFile);
		const bucketRaw = await fs.readFile(bucketPath, 'utf8');
		const bucket = JSON.parse(bucketRaw);

		for (const [packedKey, entry] of Object.entries(bucket)) {
			const title = extractTitle(packedKey, entry);
			if (!title) continue;

			const heteronyms = Array.isArray(entry?.h) ? entry.h : [];
			for (const heteronym of heteronyms) {
				const trs = heteronym?.T;
				if (typeof trs !== 'string' || trs.trim().length === 0) continue;

				const termsByType = collectTermsByType(trs);
				for (const type of PINYIN_TYPES) {
					insertIndex(indexByType.get(type), title, termsByType[type]);
				}
			}
		}
	}

	await ensureOutputDirs();
	await writeIndexes(indexByType);
}

main().catch((error) => {
	console.error('[build-pinyin-lookup] failed', error);
	process.exitCode = 1;
});
