import type { ReactNode, ElementType } from "react"

// Base interfaces
export interface MenuItemIcon {
	color?: string
	component: ElementType<any, any>
	size?: number
}

export interface MenuItem {
	key: string
	icon?: MenuItemIcon
	label: string
}

// Component props interfaces
export interface MenuItemListProps {
	menuItems: MenuItem[]
	onItemClick: (key: string) => void
	className?: string
}
