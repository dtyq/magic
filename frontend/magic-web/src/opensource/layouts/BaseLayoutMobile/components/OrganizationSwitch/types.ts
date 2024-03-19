import type { ReactNode, CSSProperties } from "react"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// Component specific interfaces
export interface OrganizationSwitchProps extends BaseComponentProps {
	onClose?: () => void
	onSwitchBefore?: () => void
	showCurrentAccount?: boolean
	showAddAccount?: boolean
}
