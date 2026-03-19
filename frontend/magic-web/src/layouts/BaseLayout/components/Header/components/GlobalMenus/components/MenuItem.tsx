import type { CSSProperties } from "react"

import { useStyles } from "../styles"
import MagicBadge from "@/components/base/MagicBadge"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"

interface MenuItemProps {
	icon: string
	label: string
	color?: string
	maskColor?: string
	badge?: "dot" | number | false
	onClick?: () => void
}

function MenuItem({ icon, label, color, maskColor, badge = false, onClick }: MenuItemProps) {
	const { styles } = useStyles()

	const iconElement = (
		<div
			className={styles.menuIcon}
			style={{ color, "--mask-color": maskColor } as CSSProperties}
		>
			<LucideLazyIcon icon={icon} size="32" color={color} />
		</div>
	)

	const badgedIcon = badge ? (
		<MagicBadge count={typeof badge === "number" ? badge : undefined} dot={badge === "dot"}>
			{iconElement}
		</MagicBadge>
	) : (
		iconElement
	)

	return (
		<div className={styles.menuItem} onClick={onClick}>
			{badgedIcon}
			<span className={styles.menuLabel}>{label}</span>
		</div>
	)
}

export default MenuItem
