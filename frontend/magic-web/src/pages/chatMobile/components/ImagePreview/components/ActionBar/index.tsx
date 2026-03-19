import { memo } from "react"
import { IconBadgeHd, IconDownload, IconMessagePin, IconShare } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useStyles } from "../../styles"
import { ImagePreviewInfo } from "@/types/chat/preview"
import MagicIcon from "@/components/base/MagicIcon"

interface ActionBarProps {
	info?: ImagePreviewInfo
	loading?: boolean
	onDownload?: () => void
	onHighDefinition: () => void
	navigateToMessage: () => void
	onShare?: () => void
}

function ActionBar({
	info,
	loading,
	onDownload,
	onHighDefinition,
	navigateToMessage,
	onShare,
}: ActionBarProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const hdText = (() => {
		if (loading) {
			return t("chat.imagePreview.converting")
		}
		if (info?.oldFileId) {
			return t("chat.imagePreview.hightImageConverted")
		}
		return t("chat.imagePreview.highDefinitionImage")
	})()

	return (
		<div className={styles.actionBarContainer}>
			<div className={styles.actionBar}>
				{/* High definition button */}
				{info?.useHDImage && (
					<button
						className={styles.actionButton}
						onClick={onHighDefinition}
						disabled={loading || !!info?.oldFileId}
						type="button"
					>
						<MagicIcon
							component={IconBadgeHd}
							size={20}
							className={styles.actionIcon}
							color="currentColor"
						/>
						<span className={styles.actionText}>{hdText}</span>
					</button>
				)}

				{/* Navigate to message button */}
				{info?.messageId && (
					<button
						className={styles.actionButton}
						onClick={navigateToMessage}
						type="button"
					>
						<MagicIcon
							component={IconMessagePin}
							size={20}
							className={styles.actionIcon}
							color="currentColor"
						/>
						<span className={styles.actionText}>
							{t("chat.imagePreview.navigateToMessage")}
						</span>
					</button>
				)}

				{/* Forward button */}
				{onShare && (
					<button className={styles.actionButton} onClick={onShare} type="button">
						<MagicIcon
							component={IconShare}
							size={20}
							className={styles.actionIcon}
							color="currentColor"
						/>
						<span className={styles.actionText}>{t("chat.imagePreview.forward")}</span>
					</button>
				)}

				{/* Download button */}
				{onDownload && (
					<button className={styles.actionButton} onClick={onDownload} type="button">
						<MagicIcon
							component={IconDownload}
							size={20}
							className={styles.actionIcon}
							color="currentColor"
						/>
						<span className={styles.actionText}>{t("chat.imagePreview.download")}</span>
					</button>
				)}
			</div>
		</div>
	)
}

export default memo(ActionBar)
