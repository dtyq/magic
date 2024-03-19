import type { ReactNode, CSSProperties } from "react"
import type { User } from "@/opensource/types/user"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// Component specific interfaces
export interface OrganizationSwitchProps extends BaseComponentProps {
	onClose?: () => void
	showCurrentAccount?: boolean
	showAddAccount?: boolean
}

// Organization item interfaces
export interface OrganizationItemProps {
	disabled: boolean
	isSelected: boolean
	onClick?: () => void
	account: User.UserAccount
	organization: User.MagicOrganization
	hasBadge?: boolean
	badgeText?: string
}

// Account section interfaces
export interface AccountCardProps {
	account: User.UserAccount
	accountIndex: number
	platformName?: string
	clustersConfig?: Record<string, { name: string }>
	showPlatformName?: boolean
	onLogout?: (account: User.UserAccount) => void
	onClose?: () => void
	onSwitchBefore?: () => void
}

// Event handler types
export type LogoutHandler = (account: User.UserAccount) => Promise<void>
export type SwitchHandler = (
	account: User.UserAccount,
	organization: User.MagicOrganization,
) => Promise<void>
