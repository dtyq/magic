import type { CSSProperties, ReactNode } from "react"

export interface FileTypeIconProps {
	type?: string
	color?: string
	size?: number
	icon?: ReactNode
	className?: string
	style?: CSSProperties
	title?: string
}
