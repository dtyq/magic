import type { ReactNode } from "react"

export interface MenuItemData {
	id: string
	label: string
	icon: ReactNode
	path?: string
	badge?: number | "dot"
	children?: MenuItemData[]
}

export interface SidebarHeaderProps {
	collapsed: boolean
	onToggleCollapse: () => void
}

export interface SidebarContentProps {
	collapsed: boolean
}

export interface SidebarFooterProps {
	collapsed: boolean
}
