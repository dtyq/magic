import type { ReactElement } from "react"

export interface SettingsModalChildrenProps {
	onClose?: () => void
}

export interface TabConfig {
	key: string
	label: string
	icon?: React.ComponentType<any>
	component: ReactElement<SettingsModalChildrenProps>
}

export interface SettingsModalProps extends SettingsModalChildrenProps {
	tabs: TabConfig[]
	defaultTab?: string
}
