import { memo } from "react"
import { IconX } from "@tabler/icons-react"
import type { SettingHeaderProps } from "../types"
import { useStyles } from "../styles"

function SettingHeader({ title, subtitle, icon, background, onClose }: SettingHeaderProps) {
	const { styles } = useStyles()

	return (
		<div className={styles.header}>
			<div className={styles.headerLeft}>
				{icon && (
					<div className={styles.headerIcon} style={{ background }}>
						{icon}
					</div>
				)}
				<div className={styles.headerText}>
					<div className={styles.headerTitle}>{title}</div>
					{subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
				</div>
			</div>
			{onClose && (
				<div className={styles.closeButton} onClick={onClose}>
					<IconX size={24} />
				</div>
			)}
		</div>
	)
}

export default memo(SettingHeader)
