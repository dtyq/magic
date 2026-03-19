import type { ReactNode, CSSProperties } from "react"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// Main page props
export interface ContactsMobilePageProps extends BaseComponentProps {
	// Add any specific props if needed
}

// Company info props
export interface CompanyInfoProps extends BaseComponentProps {
	logo?: string
	name: string
	badge?: string
	departments: DepartmentItem[]
}

export interface DepartmentItem {
	id: string
	name: string
	onClick?: () => void
}

// Partner props
export interface PartnerProps extends BaseComponentProps {
	partners: PartnerItem[]
}

export interface PartnerItem {
	id: string
	name: string
	logo?: string
	type: "customer" | "agent" | "company"
	onClick?: () => void
}

// Quick action props
export interface QuickActionProps extends BaseComponentProps {
	actions: QuickActionItem[]
}

export interface QuickActionItem extends BaseComponentProps {
	id: string
	name: string
	icon: ReactNode
	backgroundColor: string
	onClick?: () => void
}

// Section props
export interface SectionProps extends BaseComponentProps {
	title: string
	children: ReactNode
}

// Event handler types
export type EventHandler<T = void> = (event: T) => void
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>
