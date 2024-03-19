import type { MagicAvatarProps } from "@/opensource/components/base/MagicAvatar"
import type { StructureUserItem } from "@/opensource/types/organization"
import type { BadgeProps } from "antd"

export interface MagicMemberAvatarProps extends Omit<MagicAvatarProps, "children"> {
	uid?: string | null
	showName?: "none" | "vertical" | "horizontal"
	showAvatar?: boolean
	showPopover?: boolean
	classNames?: {
		name?: string
		avatar?: string
	}
	badgeProps?: BadgeProps
	maxWidth?: number
	children?: React.ReactNode | ((user?: StructureUserItem) => React.ReactNode)
}
