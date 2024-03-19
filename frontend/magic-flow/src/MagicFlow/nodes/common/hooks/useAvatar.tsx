import { prefix } from "@/MagicFlow/constants"
import styles from "@/MagicFlow/nodes/BaseNode/index.module.less"
import { nodeManager } from "@/MagicFlow/register/node"
import { MagicFlow } from "@/MagicFlow/types/flow"
import clsx from "clsx"
import _ from "lodash"
import React, { useMemo } from "react"

type UseAvatarProps = {
	icon: React.ReactNode | null
	color: string
	currentNode: MagicFlow.Node
}

export default function useAvatar({ icon, color, currentNode }: UseAvatarProps) {
	const AvatarComponent = useMemo(() => {
		const avatar =
			_.get(currentNode, nodeManager.avatarPath, "") || (_.isString(icon) ? icon : "")
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
		return (
			<span className={clsx(styles.icon, `${prefix}icon`)} style={{ background: color }}>
				{icon}
			</span>
		)
	}, [icon, color, currentNode])

	return {
		AvatarComponent,
	}
}
