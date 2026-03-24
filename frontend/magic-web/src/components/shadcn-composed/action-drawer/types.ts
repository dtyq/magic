import type { ReactNode } from "react"

export interface ActionDrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title?: ReactNode
	children?: ReactNode
	showCancel?: boolean
	cancelText?: string
	onCancel?: () => void
	/** When provided, a confirm button is rendered alongside the cancel button */
	onConfirm?: () => void
	confirmText?: string
	className?: string
	contentClassName?: string
}

export interface ActionGroupProps {
	children: ReactNode
	className?: string
}

export interface ActionItemProps {
	label: ReactNode
	icon?: ReactNode
	onClick?: () => void
	disabled?: boolean
	variant?: "default" | "destructive"
	className?: string
	"data-testid"?: string
}

export namespace ActionDrawer {
	export type Props = ActionDrawerProps
	export type GroupProps = ActionGroupProps
	export type ItemProps = ActionItemProps
}
