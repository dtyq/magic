import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "antd"
import { IconCheck, IconClock, IconX, IconLoader } from "@tabler/icons-react"
import { createStyles } from "antd-style"

// Types
interface DraftStatusProps {
	status: "idle" | "saving" | "saved" | "error"
	lastSaveTime?: number
	className?: string
}

// Styles
const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: ${token.magicColorUsages?.text?.[2]};
		transition: all 0.2s ease;
	`,

	status: css`
		display: flex;
		align-items: center;
		gap: 2px;
	`,

	saving: css`
		color: ${token.colorPrimary};
	`,

	saved: css`
		color: ${token.colorSuccess};
	`,

	error: css`
		color: ${token.colorError};
	`,

	time: css`
		opacity: 0.7;
	`,

	icon: css`
		display: flex;
		align-items: center;
	`,
}))

/**
 * DraftStatus - Draft save status indicator
 *
 * @param props - Component props
 * @returns JSX.Element
 */
const DraftStatus = memo(({ status, lastSaveTime, className }: DraftStatusProps) => {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	// Don't render if idle and no save time
	if (status === "idle" && !lastSaveTime) {
		return null
	}

	// Format last save time
	const formatSaveTime = (timestamp: number) => {
		const now = Date.now()
		const diff = now - timestamp

		if (diff < 60000) {
			// Less than 1 minute
			return t("messageEditor.draft.time.justNow")
		} else if (diff < 3600000) {
			// Less than 1 hour
			const minutes = Math.floor(diff / 60000)
			return t("messageEditor.draft.time.minutesAgo", { minutes })
		} else if (diff < 86400000) {
			// Less than 1 day
			const hours = Math.floor(diff / 3600000)
			return t("messageEditor.draft.time.hoursAgo", { hours })
		} else if (diff < 604800000) {
			// Less than 1 week
			const days = Math.floor(diff / 86400000)
			return t("messageEditor.draft.time.daysAgo", { days })
		} else if (diff < 2628000000) {
			// Less than 1 month
			const weeks = Math.floor(diff / 604800000)
			return t("messageEditor.draft.time.weeksAgo", { weeks })
		} else if (diff < 31536000000) {
			// Less than 1 year
			const months = Math.floor(diff / 2628000000)
			return t("messageEditor.draft.time.monthsAgo", { months })
		} else {
			const years = Math.floor(diff / 31536000000)
			return t("messageEditor.draft.time.yearsAgo", { years })
		}
	}

	// Get status config
	const getStatusConfig = () => {
		switch (status) {
			case "saving":
				return {
					icon: <IconLoader size={12} className={styles.icon} />,
					text: t("messageEditor.draft.status.saving"),
					className: styles.saving,
					tooltip: t("messageEditor.draft.tooltip.autoSave"),
				}
			case "saved":
				return {
					icon: <IconCheck size={12} className={styles.icon} />,
					text: t("messageEditor.draft.status.saved"),
					className: styles.saved,
					tooltip: lastSaveTime
						? t("messageEditor.draft.tooltip.lastSaved", {
								time: formatSaveTime(lastSaveTime),
							})
						: t("messageEditor.draft.tooltip.autoSave"),
				}
			case "error":
				return {
					icon: <IconX size={12} className={styles.icon} />,
					text: t("messageEditor.draft.status.error"),
					className: styles.error,
					tooltip: t("messageEditor.draft.tooltip.saveError"),
				}
			default:
				return {
					icon: <IconClock size={12} className={styles.icon} />,
					text: t("messageEditor.draft.status.idle"),
					className: "",
					tooltip: lastSaveTime
						? t("messageEditor.draft.tooltip.lastSaved", {
								time: formatSaveTime(lastSaveTime),
							})
						: t("messageEditor.draft.tooltip.autoSave"),
				}
		}
	}

	const config = getStatusConfig()

	return (
		<Tooltip title={config.tooltip} placement="top">
			<div className={cx(styles.container, className)}>
				{config.icon}
				{config.text && <span>{config.text}</span>}
				{status === "idle" && lastSaveTime && (
					<span className={styles.time}>{formatSaveTime(lastSaveTime)}</span>
				)}
			</div>
		</Tooltip>
	)
})

DraftStatus.displayName = "DraftStatus"

export default DraftStatus
