import { prefix } from "@/MagicFlow/constants"
import clsx from "clsx"
import React, { useMemo } from "react"
import styles from "../index.module.less"

type UseAvatarProps = {
	icon: React.ReactNode | null
	color: string
	avatar?: string
	showIcon: boolean
}

export default function useAvatar({ icon, color, avatar, showIcon }: UseAvatarProps) {
	const AvatarComponent = useMemo(() => {
		if (!showIcon) return null
		if (avatar) {
			return (
				<img
					className={clsx(styles.avatar, `${prefix}avatar`)}
					src={avatar}
					alt=""
					width={24}
					height={24}
				/>
			)
		}
		if (!icon) return null
		return (
			<span className={clsx(styles.icon, `${prefix}icon`)} style={{ background: color }}>
				{icon}
			</span>
		)
	}, [icon, color])

	return {
		AvatarComponent,
	}
}
