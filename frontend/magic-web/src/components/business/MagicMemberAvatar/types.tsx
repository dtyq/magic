import type { MagicAvatarProps } from "@/components/base/MagicAvatar"
import type { StructureUserItem } from "@/types/organization"
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
