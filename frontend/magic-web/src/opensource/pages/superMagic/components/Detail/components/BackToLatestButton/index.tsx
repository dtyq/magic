import { memo } from "react"
import { IconChevronsDown } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"

interface BackToLatestButtonProps {
	visible: boolean
	onClick: () => void
}

function BackToLatestButton({ visible, onClick }: BackToLatestButtonProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	if (!visible) return null

	return (
		<div className={styles.container} onClick={onClick}>
			<div className={styles.button}>
				<div className={styles.iconContainer}>
					<IconChevronsDown size={14} stroke={1.5} />
					<span className={styles.text}>{t("detail.backToLatest")}</span>
				</div>
			</div>
		</div>
	)
}

export default memo(BackToLatestButton)
