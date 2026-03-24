import { memo } from "react"
import { Button } from "antd"
import { IconSparkles } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import { useStyles } from "./styles"

export interface WarningCardProps {
	onConfirm?: () => void
	onCancel?: () => void
	onTopUp?: () => void
	title?: string
	tips?: React.ReactNode
	confirmText?: string
	cancelText?: string
	confirmDisabled?: boolean
	cancelDisabled?: boolean
	confirmLoading?: boolean
	cancelLoading?: boolean
}

/**
 * 提醒卡片组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const WarningCard = memo(
	({
		title,
		onConfirm,
		onCancel,
		tips,
		confirmText,
		cancelText,
		confirmDisabled,
		cancelDisabled,
		confirmLoading,
		cancelLoading,
	}: WarningCardProps) => {
		const { t } = useTranslation("super")
		const { styles } = useStyles()

		return (
			<div className={styles.container}>
				<div className={styles.header}>
					<div className={styles.iconWrapper}>
						<MagicIcon component={IconSparkles} size={14} stroke={2} color="#fff" />
					</div>
					<span className={styles.title}>{title || t("warningCard.defaultTitle")}</span>
				</div>

				<div className={styles.content}>{tips}</div>

				<div className={styles.buttonGroup}>
					<Button
						type="default"
						size="small"
						className={styles.secondaryButton}
						onClick={onCancel}
						disabled={cancelDisabled}
						loading={cancelLoading}
					>
						{cancelText || t("ui.cancel")}
					</Button>

					{onConfirm && (
						<Button
							type="primary"
							size="small"
							className={styles.primaryButton}
							onClick={onConfirm}
							disabled={confirmDisabled}
							loading={confirmLoading}
						>
							{confirmText || t("ui.confirm")}
						</Button>
					)}
				</div>
			</div>
		)
	},
)

WarningCard.displayName = "WarningCard"

export default WarningCard
