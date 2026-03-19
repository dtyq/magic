import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { isInDingTalkEnvironment, isMac, isWindows } from "@/utils/devices"
import MagicModal from "@/components/base/MagicModal"
import { useStyles } from "./styles"
import MagicButton from "@/components/base/MagicButton"
import demoVideo from "./assets/scale_tip.mp4?url"
import { useIsMobile } from "@/hooks/useIsMobile"

// Constants moved outside component for performance
let DESIGN_BASELINE_WIDTH = 1440 // Design baseline width for UI scaling

// Helper function to detect if running inside an iframe
const isInIframe = (): boolean => {
	try {
		return window.self !== window.top
	} catch (e) {
		// If accessing window.top is denied, we're likely in an iframe
		return true
	}
}

function LowResolutionScaleTip() {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const [isModalVisible, setIsModalVisible] = useState(false)
	const isMobileResponsive = useIsMobile()

	const userClose = useRef(false)
	const lastDevicePixelRatio = useRef(window.devicePixelRatio)

	// Detection logic - recalculates window dimensions on every call
	const checkShouldShowModal = useCallback(() => {
		// Don't show modal if running inside an iframe
		if (isInIframe()) return false
		// don't show if user has closed the modal
		if (userClose.current) return false
		// don't show on mobile responsive
		if (isMobileResponsive) return false
		// Only check for windows devices
		if (!isWindows) return false
		// don't show in dingtalk environment
		if (isInDingTalkEnvironment) return false

		lastDevicePixelRatio.current = window.devicePixelRatio

		// if the window is scaled enough, don't show the modal
		const isScaledEnough =
			window.innerWidth > window.outerWidth && window.innerWidth > DESIGN_BASELINE_WIDTH

		if (isScaledEnough) return false

		return window.screen.width < DESIGN_BASELINE_WIDTH
	}, [isMobileResponsive])

	// Check and update modal visibility based on current conditions
	const checkResolution = useCallback(() => {
		const shouldShow = checkShouldShowModal()
		if (shouldShow && !isModalVisible && !userClose.current) {
			setIsModalVisible(true)
		} else if (!shouldShow && isModalVisible && !userClose.current) {
			// Auto-hide modal when conditions no longer met (e.g., user zoomed in/out)
			setIsModalVisible(false)
		}
	}, [checkShouldShowModal, isModalVisible])

	// Setup global debug function and event listeners
	useEffect(() => {
		// Add global function for testing/debugging purposes
		const globalWindow = window as Window & {
			setMinimumScaleRatio?: (width: number) => void
		}
		globalWindow.setMinimumScaleRatio = (width: number) => {
			DESIGN_BASELINE_WIDTH = width
		}

		// Initial check
		checkResolution()

		// Add resize listener
		window.addEventListener("resize", checkResolution)

		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", checkResolution)
		}

		// Also listen for orientationchange and zoom events as fallback
		window.addEventListener("orientationchange", checkResolution)

		// Cleanup function
		return () => {
			window.removeEventListener("resize", checkResolution)
			window.removeEventListener("orientationchange", checkResolution)

			if (window.visualViewport) {
				window.visualViewport.removeEventListener("resize", checkResolution)
			}

			delete globalWindow.setMinimumScaleRatio
		}
	}, [checkResolution])

	// Handle shouldShowModal changes
	useEffect(() => {
		if (checkShouldShowModal() && !isModalVisible && !userClose.current) {
			setIsModalVisible(true)
		} else if (!checkShouldShowModal() && isModalVisible && !userClose.current) {
			// Auto-hide modal when conditions no longer met (e.g., window resized larger)
			setIsModalVisible(false)
		}
	}, [checkShouldShowModal, isModalVisible])

	// Additional check for zoom changes when modal is visible
	useEffect(() => {
		if (!isModalVisible) return

		const checkZoomChange = () => {
			const currentDevicePixelRatio = window.devicePixelRatio
			if (Math.abs(currentDevicePixelRatio - lastDevicePixelRatio.current) > 0.01) {
				// Device pixel ratio changed, trigger resolution check
				checkResolution()
			}
		}

		// Check for zoom changes every 500ms when modal is visible
		const intervalId = setInterval(checkZoomChange, 500)

		return () => {
			clearInterval(intervalId)
		}
	}, [isModalVisible, checkResolution])

	const handleModalClose = useCallback(() => {
		setIsModalVisible(false)
		userClose.current = true
	}, [])

	const KeyButton = ({ children }: { children: React.ReactNode }) => (
		<div className={styles.keyButton}>{children}</div>
	)

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
		>
			<div className={styles.content}>
				{/* Title Section */}
				<div className={styles.titleSection}>
					<h1 className={styles.title}>{t("lowResolutionTip.title")}</h1>
					<p className={styles.subtitle}>{t("lowResolutionTip.subtitle")}</p>
				</div>

				{/* Demo Section */}
				<div className={styles.demoSection}>
					<video className={styles.demoArea} src={demoVideo} autoPlay muted loop />
				</div>

				{/* Shortcut Section */}
				<div className={styles.shortcutSection}>
					<span className={styles.shortcutText}>
						{t("lowResolutionTip.shortcutHint")}
					</span>

					<div className={styles.keyGroup}>
						<KeyButton>{isMac ? "⌘" : "Ctrl"}</KeyButton>
						<KeyButton>-</KeyButton>
					</div>

					<span className={styles.shortcutText}>{t("lowResolutionTip.adjustHint")}</span>
				</div>

				<MagicButton
					type="primary"
					className={styles.closeButton}
					onClick={handleModalClose}
				>
					{t("lowResolutionTip.closeButton")}
				</MagicButton>
			</div>
		</MagicModal>
	)
}

export default LowResolutionScaleTip
