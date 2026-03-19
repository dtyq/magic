import i18n from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"

/**
 * Summary process stages with corresponding message keys
 */
export enum SummaryStage {
	Starting = "starting",
	StoppingRecording = "stoppingRecording",
	UploadingChunks = "uploadingChunks",
	ProcessingProject = "processingProject",
	MigratingImages = "migratingImages",
	GeneratingSummary = "generatingSummary",
	Completing = "completing",
}

/**
 * Message key for different summary stages
 */
const SUMMARY_MESSAGE_KEY = "recording-summary-process"

/**
 * Service for managing messages during the recording summary process
 * Provides real-time feedback to users about the current stage
 */
export class SummaryMessageService {
	private currentStage: SummaryStage | null = null
	private messageVisible = false

	/**
	 * Show message for a specific stage
	 */
	showStageMessage(stage: SummaryStage) {
		this.currentStage = stage
		this.messageVisible = true

		const content = this.getMessageContent(stage)

		magicToast.loading({
			key: SUMMARY_MESSAGE_KEY,
			content,
			duration: 0,
		})
	}

	/**
	 * Update message content for current stage with progress info
	 */
	updateProgress(progressInfo?: string) {
		if (!this.messageVisible || !this.currentStage) return

		const baseContent = this.getMessageContent(this.currentStage)
		const content = progressInfo ? `${baseContent} (${progressInfo})` : baseContent

		magicToast.loading({
			key: SUMMARY_MESSAGE_KEY,
			content,
			duration: 0,
		})
	}

	/**
	 * Show success message and destroy loading message
	 */
	showSuccess(customMessage?: string) {
		this.messageVisible = false
		this.currentStage = null

		magicToast.success({
			key: SUMMARY_MESSAGE_KEY,
			content:
				customMessage ||
				i18n.t("recordingSummary.message.summaryComplete", { ns: "super" }),
		})
	}

	/**
	 * Show error message and destroy loading message
	 */
	showError(error?: Error | string) {
		this.messageVisible = false
		this.currentStage = null

		const errorMessage =
			typeof error === "string"
				? error
				: error?.message ||
				i18n.t("recordingSummary.message.summaryFailed", { ns: "super" })

		magicToast.error({
			key: SUMMARY_MESSAGE_KEY,
			content: errorMessage,
			duration: 3000,
		})
	}

	/**
	 * Destroy current message
	 */
	destroy() {
		this.messageVisible = false
		this.currentStage = null
		magicToast.destroy(SUMMARY_MESSAGE_KEY)
	}

	/**
	 * Get localized message content for a stage
	 */
	private getMessageContent(stage: SummaryStage): string {
		const messageMap: Record<SummaryStage, string> = {
			[SummaryStage.Starting]: i18n.t("recordingSummary.message.starting", {
				ns: "super",
			}),
			[SummaryStage.StoppingRecording]: i18n.t("recordingSummary.message.stoppingRecording", {
				ns: "super",
			}),
			[SummaryStage.UploadingChunks]: i18n.t("recordingSummary.message.uploadingChunks", {
				ns: "super",
			}),
			[SummaryStage.ProcessingProject]: i18n.t("recordingSummary.message.processingProject", {
				ns: "super",
			}),
			[SummaryStage.MigratingImages]: i18n.t("recordingSummary.message.migratingImages", {
				ns: "super",
			}),
			[SummaryStage.GeneratingSummary]: i18n.t("recordingSummary.message.generatingSummary", {
				ns: "super",
			}),
			[SummaryStage.Completing]: i18n.t("recordingSummary.message.completing", {
				ns: "super",
			}),
		}

		return messageMap[stage] || ""
	}

	/**
	 * Check if message is currently visible
	 */
	isMessageVisible(): boolean {
		return this.messageVisible
	}

	/**
	 * Get current stage
	 */
	getCurrentStage(): SummaryStage | null {
		return this.currentStage
	}
}

// Singleton instance for global use
let summaryMessageServiceInstance: SummaryMessageService | null = null

/**
 * Get or create the SummaryMessageService singleton instance
 */
export function getSummaryMessageService(): SummaryMessageService {
	if (!summaryMessageServiceInstance) {
		summaryMessageServiceInstance = new SummaryMessageService()
	}
	return summaryMessageServiceInstance
}

export default getSummaryMessageService
