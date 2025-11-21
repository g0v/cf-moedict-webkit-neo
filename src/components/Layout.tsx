/**
 * Layout 組件
 * 根據 layout 類型切換不同的頁面結構
 */

import type { ReactNode } from 'react';
import { NavbarAbout } from './navbar-about';
import { NavbarNormal } from './navbar-normal';
import { Sidebar } from './sidebar';
import { AssetLoader } from './AssetLoader';
import { InlineStyles } from './InlineStyles';

type Lang = 'a' | 't' | 'h' | 'c';

type LayoutType = 'normal' | 'about';

interface LayoutProps {
	layout: LayoutType;
	children: ReactNode;
	currentLang?: Lang;
	r2Endpoint?: string;
}

/**
 * Layout 組件
 */
export function Layout({ layout, children, currentLang, r2Endpoint }: LayoutProps) {
	return (
		<>
			<AssetLoader r2Endpoint={r2Endpoint} />
			<InlineStyles r2Endpoint={r2Endpoint} />
			{layout === 'about' ? (
				<div className="app-shell">
					<NavbarAbout r2Endpoint={r2Endpoint} />
					<main id="main-content" className="about-layout">
						{children}
					</main>
				</div>
			) : (
				<div className="app-shell">
					<NavbarNormal currentLang={currentLang} />
					<Sidebar currentLang={currentLang} />
					<main id="main-content">
						{children}
					</main>
				</div>
			)}
		</>
	);
}

