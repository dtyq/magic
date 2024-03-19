import { memo } from "react"
import Avatar from "@/components/Avatar"
import { IconSitemap } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { CSSProperties, ReactNode } from "react"

interface IconAvatarProps {
	className?: string
	style?: CSSProperties
	name: string
	size?: number
	iconSize?: number
	icon?: ReactNode
}

function IconAvatar({ name, size = 32, iconSize = 20, className, icon, style }: IconAvatarProps) {
	return (
		<Avatar
			className={cn(
				"rounded-lg bg-[var(--icon-avatar-bg)] text-[var(--icon-avatar-text)]",
				className,
			)}
			style={style}
			shape="square"
			size={size}
			src={icon || <IconSitemap size={iconSize} />}
		>
			{name}
		</Avatar>
	)
}

export default memo(IconAvatar)
