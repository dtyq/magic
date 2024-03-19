import type { CSSProperties, ReactNode } from "react"

export interface MenuItem {
	key: string
	label: string
	icon?: ReactNode
	subtitle?: string
	groupTitle?: string
	background?: string
}

export interface SettingPanelProps {
	menuItems: MenuItem[]
	activeKey: string
	onActiveKeyChange: (key: string) => void
	renderContent: (activeKey: string) => ReactNode
	onClose?: () => void
	className?: string
	style?: CSSProperties
}

export interface SettingSidebarProps {
	menuItems: MenuItem[]
	activeKey: string
	onActiveKeyChange: (key: string) => void
}

export interface SettingHeaderProps {
	title: string
	subtitle?: string
	icon?: ReactNode
	background?: string
	onClose?: () => void
}

export interface SettingContentProps {
	children: ReactNode
}

export interface SettingPanelModalProps {
	menuItems: MenuItem[]
	renderContent: (activeKey: string) => React.ReactNode
	defaultActiveKey?: string
	onClose?: () => void
	isResponsive?: boolean
	width?: number | string
	height?: number | string
}

export interface SettingPanelModalRef {
	close: () => void
	setActiveKey: (key: string) => void
}
