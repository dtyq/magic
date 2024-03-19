import type { ReactNode, CSSProperties, MouseEvent } from "react"

export interface AvatarProps {
	/** Shape of avatar, options: `circle`, `square` */
	shape?: "circle" | "square"
	size?: number
	fontSize?: number
	gap?: number
	/** Src of image avatar */
	src?: string | ReactNode
	/** Srcset of image avatar */
	srcSet?: string
	draggable?: boolean | "true" | "false"
	/** Icon to be used in avatar */
	icon?: ReactNode
	style?: CSSProperties
	className?: string
	children?: ReactNode
	alt?: string
	onClick?: (e?: MouseEvent<HTMLElement>) => void
	onError?: () => boolean
}

export interface BadgeProps {
	count?: number | ReactNode
	offset?: [number, number]
}

export interface MagicAvatarProps extends AvatarProps {
	badgeProps?: BadgeProps
}
