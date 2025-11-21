/**
 * 內聯樣式組件
 * 注入原專案 page-rendering.tsx 中的內聯樣式
 */

import { useEffect, useState } from 'react';

interface InlineStylesProps {
	r2Endpoint?: string;
}

/**
 * 內聯樣式組件
 */
export function InlineStyles({ r2Endpoint }: InlineStylesProps) {
	const [endpoint, setEndpoint] = useState(r2Endpoint || '');

	useEffect(() => {
		if (!endpoint) {
			fetch('/api/config')
				.then((res) => res.json())
				.then((data: { assetBaseUrl?: string }) => {
					if (data.assetBaseUrl) {
						setEndpoint(data.assetBaseUrl.replace(/\/$/, ''));
					} else {
						setEndpoint('/assets');
					}
				})
				.catch(() => {
					setEndpoint('/assets');
				});
		}
	}, [endpoint]);

	if (!endpoint) return null;

	const basePath = endpoint;

	return (
		<style
			dangerouslySetInnerHTML={{
				__html: `
		/* 修正導航列壓版問題 */
		body {
			padding-top: 50px; /* 為固定導航列留出空間 */
		}

		/* 確保導航列背景正確顯示 */
		.nav-bg {
			height: 50px;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			z-index: 1029;
		}

		/* 確保導航列在背景之上 */
		.navbar-fixed-top {
			z-index: 1030;
		}

		/* 確保主內容區域不會被左側欄遮擋 */
		#main-content {
			margin-left: 260px;
		}

		/* About 頁面沒有 Sidebar，所以不需要 margin-left */
		#main-content.about-layout {
			margin-left: 0;
		}

		/* 部首頁的內容區域也需要 margin-left */
		.result {
			padding: 20px;
			max-width: 1200px;
			margin-left: 0;
			margin-right: auto;
		}

		@media only screen and (max-width: 767px) {
			#main-content {
				margin-left: 0;
				margin-top: 55px;
			}
		}

		/* 左側欄（query-box）樣式 - 復刻原專案 */
		.query-box {
			width: 260px;
			position: fixed;
			border-right: 1px solid hsl(360, 1%, 83%);
			top: 45px;
			bottom: 0;
			z-index: 9;
			padding: 20px;
			box-sizing: border-box;
			background-color: hsl(0, 0%, 97%);
		}

		@media print {
			.query-box { display: none; }
		}

		@media only screen and (max-width: 767px) {
			.query-box {
				right: auto !important;
				width: 100% !important;
				top: 40px !important;
				height: 65px !important;
				bottom: auto !important;
				padding: 15px !important;
				padding-bottom: 3px !important;
				z-index: 10 !important;
				border-right: none !important;
			}

			#main-content {
				margin-left: 0;
			}
		}

		/* Autocomplete 選單樣式 */
		.ui-autocomplete {
			overflow: auto;
			height: auto !important;
			position: fixed !important;
			box-sizing: border-box;
			background: #fff;
			border: 1px solid #ddd;
			border-radius: 4px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.15);
		}

		.ui-autocomplete ul {
			list-style: none;
			margin: 0;
			padding: 0;
		}

		.ui-autocomplete .ui-menu-item {
			padding: 8px 12px;
			cursor: pointer;
			border-bottom: 1px solid #eee;
		}

		.ui-autocomplete .ui-menu-item:hover {
			background: #f0f0f0;
		}

		@media only screen and (min-width: 768px) {
			.ui-autocomplete {
				top: 113px !important;
				bottom: auto !important;
				left: 19px !important;
				width: 221px !important;
				max-height: 80% !important;
			}
		}

		@media only screen and (max-width: 767px) {
			ul.ui-autocomplete {
				top: 100px !important;
				height: auto !important;
				max-height: 75% !important;
				left: 0 !important;
				width: 100% !important;
			}
		}

		/* 搜尋輸入框樣式 */
		.query-box input.query {
			display: block;
			border: 1px solid #ddd;
			font-size: 1.2em;
			width: 100%;
			height: 1.8em;
			box-sizing: border-box;
			padding: 4px 8px;
		}

		.query-box .search-form {
			width: 100%;
		}

		/* 隱藏搜尋輸入框的取消按鈕 */
		::-webkit-search-cancel-button {
			-webkit-appearance: none;
		}

		/* FontAwesome 字體定義 */
		@font-face {
			font-family: 'FontAwesome';
			src: url('${basePath}/fonts/fontawesome-webfont.eot?v=3.2.1');
			src: url('${basePath}/fonts/fontawesome-webfont.eot?#iefix&v=3.2.1') format('embedded-opentype'),
				 url('${basePath}/fonts/fontawesome-webfont.woff?v=3.2.1') format('woff'),
				 url('${basePath}/fonts/fontawesome-webfont.ttf?v=3.2.1') format('truetype'),
				 url('${basePath}/fonts/fontawesome-webfont.svg#fontawesomeregular?v=3.2.1') format('svg');
			font-weight: normal;
			font-style: normal;
		}

		/* 基礎圖示樣式 */
		[class^="icon-"]:before,
		[class*=" icon-"]:before {
			font-family: FontAwesome;
			font-weight: normal;
			font-style: normal;
			text-decoration: inherit;
			-webkit-font-smoothing: antialiased;
			*margin-right: .3em;
		}

		/* 手機版調整 */
		@media (max-width: 767px) {
			body {
				padding-top: 0;
			}

			.nav-bg {
				position: static;
			}
		}
		`
			}}
		/>
	);
}

