import React, { memo, ReactNode } from "react"
import useAvatar from "../hooks/useAvatar"

interface ItemAvatarProps {
	showIcon: boolean
	avatar?: string
	icon?: ReactNode
	color?: string
	type?: any
}

const ItemAvatar = memo(({ showIcon, avatar, icon, color }: ItemAvatarProps) => {
	const { AvatarComponent } = useAvatar({
		showIcon,
		avatar,
		icon,
		color,
	})

	return AvatarComponent
})

export default ItemAvatar
