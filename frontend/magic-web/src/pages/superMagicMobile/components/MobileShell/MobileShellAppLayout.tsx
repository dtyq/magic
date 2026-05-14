import type { ReactNode } from "react"

import type { MobileShellMenuContextValue } from "./MobileShellMenuContext"
import { MobileShellMenuProvider } from "./MobileShellMenuContext"
import MobileShellScaffold from "./MobileShellScaffold"

export interface MobileShellAppLayoutProps {
	/** 与 `MobileShellScaffold` 一致，各路由唯一 */
	testIdPrefix?: string
	syncDocumentTheme?: boolean
	closeSidebarAriaLabel: string
	isSidebarOpen: boolean
	onCloseSidebar: () => void
	menuValue: MobileShellMenuContextValue
	sidebar: ReactNode
	/** 一般为 `<Outlet />`，也可传静态节点 */
	panel: ReactNode
}

/**
 * 业务路由父级可挂载的 Shell：固定 `MobileShellMenuProvider` + `MobileShellScaffold`，
 * `panel` 通常为 `<Outlet />`，子路由只渲染面板内业务。
 */
export function MobileShellAppLayout({
	testIdPrefix = "mobile-shell",
	syncDocumentTheme = true,
	closeSidebarAriaLabel,
	isSidebarOpen,
	onCloseSidebar,
	menuValue,
	sidebar,
	panel,
}: MobileShellAppLayoutProps) {
	return (
		<MobileShellMenuProvider value={menuValue}>
			<MobileShellScaffold
				isSidebarOpen={isSidebarOpen}
				sidebar={sidebar}
				panel={panel}
				onCloseSidebar={onCloseSidebar}
				closeSidebarAriaLabel={closeSidebarAriaLabel}
				testIdPrefix={testIdPrefix}
				syncDocumentTheme={syncDocumentTheme}
			/>
		</MobileShellMenuProvider>
	)
}
