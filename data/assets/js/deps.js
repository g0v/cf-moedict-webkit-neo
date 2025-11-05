/**
 * 萌典前端依賴打包文件
 * 這個文件整合了前端所需的主要依賴庫
 */

// 注意：這是一個簡化版本
// 實際運行時，前端會動態載入所需的依賴

// 動態載入依賴的輔助函數
window.loadScript = function(src, callback) {
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = src;
	script.onload = callback || function() {};
	script.onerror = function() {
		console.error('Failed to load script:', src);
	};
	document.head.appendChild(script);
};

// 初始化函數
window.initMoedict = function() {
	console.log('萌典前端初始化...');

	// 載入必要的依賴
	var scripts = [
		'/js/jquery-2.1.1.min.js',
		'/js/jquery-migrate-3.0.0.min.js',
		'/js/jquery-ui-1.10.4.custom.min.js',
		'/js/prelude-browser-min.js',
		'/js/han.js',
		'/js/raphael.js',
		'/js/sax.js',
		'/js/jquery.strokeWords.js'
	];

	// 順序載入腳本
	function loadNext(index) {
		if (index >= scripts.length) {
			console.log('所有依賴已載入');
			return;
		}

		loadScript(scripts[index], function() {
			loadNext(index + 1);
		});
	}

	loadNext(0);
};

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', window.initMoedict);
} else {
	window.initMoedict();
}

