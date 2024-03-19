import type { ReactNode } from "react"
import type { MagicAvatarProps } from "../base/MagicAvatar"

export interface MagicListItemData {
	id: string
	avatar?: string | MagicAvatarProps | ((isHover: boolean) => ReactNode)
	title?: string | ReactNode | ((isHover: boolean) => ReactNode)
	hoverSection?: ReactNode
	[key: string]: any
}
