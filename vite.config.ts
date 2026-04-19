import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from '@cloudflare/vite-plugin'

interface LocalStaticMount {
	prefix: string
	root: string
}

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const localStaticMounts: LocalStaticMount[] = [
	{ prefix: '/assets-legacy/', root: path.resolve(projectRoot, 'data/assets') },
	{ prefix: '/dictionary/', root: path.resolve(projectRoot, 'data/dictionary') },
	{ prefix: '/search-index/', root: path.resolve(projectRoot, 'data/dictionary/search-index') },
]

function contentTypeFor(filePath: string): string {
	switch (path.extname(filePath).toLowerCase()) {
		case '.css':
			return 'text/css; charset=utf-8'
		case '.js':
			return 'application/javascript; charset=utf-8'
		case '.json':
			return 'application/json; charset=utf-8'
		case '.txt':
			return 'text/plain; charset=utf-8'
		case '.xml':
			return 'application/xml; charset=utf-8'
		case '.svg':
			return 'image/svg+xml'
		case '.png':
			return 'image/png'
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg'
		case '.gif':
			return 'image/gif'
		case '.ico':
			return 'image/x-icon'
		case '.woff':
			return 'font/woff'
		case '.woff2':
			return 'font/woff2'
		case '.ttf':
			return 'font/ttf'
		case '.otf':
			return 'font/otf'
		case '.eot':
			return 'application/vnd.ms-fontobject'
		case '.wasm':
			return 'application/wasm'
		default:
			return 'application/octet-stream'
	}
}

function localDataAssetsPlugin(): Plugin {
	return {
		name: 'moedict-local-data-assets',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const requestUrl = req.url;
				if (!requestUrl) {
					next();
					return;
				}

				const pathname = new URL(requestUrl, 'http://localhost').pathname;
				const mount = localStaticMounts.find(({ prefix }) => pathname.startsWith(prefix));
				if (!mount) {
					next();
					return;
				}

				const rawRelativePath = decodeURIComponent(pathname.slice(mount.prefix.length)).replace(/^\/+/, '');
				const normalizedRelativePath = path.posix.normalize(rawRelativePath);
				if (
					normalizedRelativePath.length === 0 ||
					normalizedRelativePath === '.' ||
					normalizedRelativePath.startsWith('..') ||
					normalizedRelativePath.includes('\0')
				) {
					res.statusCode = 403;
					res.end('Forbidden');
					return;
				}

				const resolvedPath = path.resolve(mount.root, normalizedRelativePath);
				const relativeToRoot = path.relative(mount.root, resolvedPath);
				if (
					relativeToRoot.startsWith('..') ||
					path.isAbsolute(relativeToRoot) ||
					!fs.existsSync(resolvedPath) ||
					!fs.statSync(resolvedPath).isFile()
				) {
					res.statusCode = 404;
					res.end('Not Found');
					return;
				}

				res.setHeader('Content-Type', contentTypeFor(resolvedPath));
				res.setHeader('Cache-Control', 'no-store');
				fs.createReadStream(resolvedPath).pipe(res);
			});
		},
	}
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
	const remoteDev = process.env.VITE_CLOUDFLARE_REMOTE_DEV === '1'

	return {
		server: {
			proxy: {
				'/lookup/trs': {
					target: 'https://www.moedict.tw',
					changeOrigin: true,
				},
			},
		},
		plugins: [
			react(),
			command === 'serve'
				? remoteDev
					? cloudflare()
					: localDataAssetsPlugin()
				: cloudflare(),
		],
	}
})
