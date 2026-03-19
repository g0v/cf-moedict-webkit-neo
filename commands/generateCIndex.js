#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const cDictionaryDir = path.join(projectRoot, 'data', 'dictionary', 'c');
const categoryListFile = path.join(cDictionaryDir, '=.json');
const outputFile = path.join(projectRoot, 'data', 'dictionary', 'c', 'index.json');

async function readJsonArray(filePath) {
	const raw = await readFile(filePath, 'utf8');
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error(`檔案不是陣列格式：${filePath}`);
	}
	return parsed;
}

async function main() {
	const categories = await readJsonArray(categoryListFile);
	const merged = [];

	for (const category of categories) {
		const categoryName = String(category || '').trim();
		if (!categoryName) continue;

		const sourceFile = path.join(cDictionaryDir, `=${categoryName}.json`);
		const words = await readJsonArray(sourceFile);
		merged.push(
			...words
				.map((word) => String(word || '').trim())
				.filter((word) => word.length > 0 && !word.startsWith(';'))
		);
	}

	await mkdir(path.dirname(outputFile), { recursive: true });
	await writeFile(outputFile, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

	console.log(`已輸出 ${merged.length} 筆到 ${path.relative(projectRoot, outputFile)}`);
}

main().catch((error) => {
	console.error('[generateCIndex] failed:', error);
	process.exitCode = 1;
});
