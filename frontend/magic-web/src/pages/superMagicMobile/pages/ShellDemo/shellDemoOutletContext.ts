import type { Dispatch, SetStateAction } from "react"

import type { ShellDemoView } from "./types"

/** 父布局通过 `<Outlet context={…} />` 注入，子页面只渲染面板 UI */
export interface ShellDemoOutletContext {
	activeView: ShellDemoView
	setActiveView: Dispatch<SetStateAction<ShellDemoView>>
	viewLabelMap: Record<ShellDemoView, string>
	isSidebarOpen: boolean
	setIsSidebarOpen: Dispatch<SetStateAction<boolean>>
}
