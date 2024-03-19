import { useTranslation } from "react-i18next"
import { IconInfoCircle } from "@tabler/icons-react"
import MagicButton from "@/opensource/components/base/MagicButton"
import showOnlineFeedbackModal from "@/opensource/components/business/OnlineFeedbackModal"
import { useStyles } from "./styles"
import type { RecordErrorModalProps } from "./types"
import MagicModal from "@/opensource/components/base/MagicModal"

function RecordErrorModal({ open = false, onClose, response }: RecordErrorModalProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	const handleFeedback = () => {
		showOnlineFeedbackModal({
			defaultValue: `${t("recordingSummary.recordErrorModal.feedbackErrorMessage")}
---
${Object.entries(response ?? {})
	.map(([key, value]) => `${key}: ${value}`)
	.join("\n")}
---
`,
		})
	}

	const handleClose = () => {
		onClose?.()
	}

	return (
		<MagicModal
			open={open}
			onCancel={handleClose}
			footer={null}
			className={styles.modal}
			width={400}
			centered
			maskClosable={false}
			closable={true}
		>
			<div className={styles.container}>
				{/* Header with icon and text */}
				<div className={styles.header}>
					<div className={styles.iconWrapper}>
						<IconInfoCircle size={24} />
					</div>
					<div className={styles.textContent}>
						<h3 className={styles.title}>
							{t("recordingSummary.recordErrorModal.title")}
						</h3>
						<p className={styles.description}>
							{t("recordingSummary.recordErrorModal.description")}
						</p>
					</div>
				</div>

				{/* Footer with action buttons */}
				<div className={styles.footer}>
					<button className={styles.feedbackButton} onClick={handleFeedback}>
						<span>{t("recordingSummary.recordErrorModal.feedback")}</span>
					</button>
					<MagicButton
						type="primary"
						className={styles.closeButton}
						onClick={handleClose}
					>
						{t("recordingSummary.recordErrorModal.close")}
					</MagicButton>
				</div>
			</div>
		</MagicModal>
	)
}

export default RecordErrorModal
