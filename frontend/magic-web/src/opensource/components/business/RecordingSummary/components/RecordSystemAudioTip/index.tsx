import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useStyles } from "./styles"
import MagicButton from "@/opensource/components/base/MagicButton"
import demoVideo from "./assets/tip.mp4?url"

interface RecordSystemAudioTipProps {
	open?: boolean
	onClose?: () => void
	onDontShowAgain?: () => void
}

function RecordSystemAudioTip({
	open: controlledOpen,
	onClose,
	onDontShowAgain,
}: RecordSystemAudioTipProps = {}) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const [internalOpen, setInternalOpen] = useState(false)

	const isControlled = controlledOpen !== undefined
	const isModalVisible = isControlled ? controlledOpen : internalOpen

	const handleModalClose = useCallback(() => {
		if (isControlled) {
			onClose?.()
		} else {
			setInternalOpen(false)
		}
	}, [isControlled, onClose])

	const handleDontShowAgain = useCallback(() => {
		if (isControlled) {
			onDontShowAgain?.()
		} else {
			setInternalOpen(false)
		}
	}, [isControlled, onDontShowAgain])

	return (
		<MagicModal
			open={isModalVisible}
			onCancel={handleModalClose}
			onOk={handleModalClose}
			footer={null}
			width={490}
			className={styles.modalContainer}
			centered
			closeIcon={null}
			zIndex={1051}
		>
			<div className={styles.content}>
				{/* Title Section */}
				<div className={styles.titleSection}>
					<h1 className={styles.title}>{t("recordSystemAudioTip.title")}</h1>
					<p className={styles.subtitle}>{t("recordSystemAudioTip.subtitle")}</p>
				</div>

				{/* Demo Section */}
				<div className={styles.demoSection}>
					<div className={styles.demoArea}>
						<video className={styles.demoImage} src={demoVideo} autoPlay muted loop />
					</div>
				</div>

				{/* Steps Section */}
				<ol className={styles.stepsList}>
					<li className={styles.stepItem}>
						{t("recordSystemAudioTip.step1")}
						<span className={styles.stepHighlight}>
							{t("recordSystemAudioTip.step1Highlight")}
						</span>
					</li>
					<li className={styles.stepItem}>
						{t("recordSystemAudioTip.step2")}
						<span className={styles.stepHighlight}>
							{t("recordSystemAudioTip.step2Highlight")}
						</span>
						{t("recordSystemAudioTip.step2Suffix")}
					</li>
				</ol>

				{/* Don't Show Again Button */}
				<MagicButton
					type="default"
					className={styles.dontShowAgainButton}
					onClick={handleDontShowAgain}
				>
					{t("recordSystemAudioTip.dontShowAgain")}
				</MagicButton>
			</div>
		</MagicModal>
	)
}

export default RecordSystemAudioTip

// Utility method exports
export { showRecordSystemAudioTip } from "./utils"
