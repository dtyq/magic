import { RecordingSummaryStatus } from "@/opensource/apis/modules/superMagic/recordSummary"
import { SuperMagicApi } from "@/opensource/apis"
import { logger as Logger } from "@/opensource/utils/log"
import recordSummaryStore from "@/opensource/stores/recordingSummary"

const logger = Logger.createLogger("RecordingStatusReporter", {
	enableConfig: {
		console: false,
	},
})

interface StatusReportParams {
	task_key: string
	status: RecordingSummaryStatus
	model_id: string
	note?: {
		content: string
		file_extension: string
	}
	asr_stream_content?: string
}

interface RecordingStatusReporterConfig {
	onReportError?: (error: Error) => void
}

/**
 * Recording status reporter service
 * Handles immediate status reporting and periodic updates to the server
 */
class RecordingStatusReporter {
	private periodicReportTimer: NodeJS.Timeout | null = null
	private lastReportedStatus: string | null = null
	private currentSessionId: string | null = null
	private onReportError?: (error: Error) => void
	private isReporting = false

	constructor(config?: RecordingStatusReporterConfig) {
		this.onReportError = config?.onReportError
	}

	/**
	 * Report status immediately
	 * Prevents duplicate reports of the same status
	 */
	async reportStatus(params: StatusReportParams): Promise<void> {
		try {
			// Prevent duplicate reports
			const statusKey = `${params.task_key}_${params.status}`
			if (this.lastReportedStatus === statusKey && this.isReporting) {
				logger.log(`Skipping duplicate status report: ${statusKey}`)
				return
			}

			this.isReporting = true
			this.lastReportedStatus = statusKey

			logger.log(`Reporting status: ${params.status} for task ${params.task_key}`, {
				modelId: params.model_id,
				hasNote: !!params.note,
				asrContentLength: params.asr_stream_content?.length || 0,
			})

			await SuperMagicApi.reportRecordingSummaryStatus({
				task_key: params.task_key,
				status: params.status,
				model_id: params.model_id,
				note: params.note,
				asr_stream_content: params.asr_stream_content,
			})

			logger.log(`Status reported successfully: ${params.status}`)
		} catch (error) {
			logger.error(`Failed to report status: ${params.status}`, error)
			this.onReportError?.(error as Error)
		} finally {
			this.isReporting = false
		}
	}

	/**
	 * Start periodic status reporting
	 * Reports current recording state every interval (default: 30 seconds)
	 */
	startPeriodicReport(sessionId: string, interval: number = 30000): void {
		// Clear existing timer if any
		this.stopPeriodicReport()

		this.currentSessionId = sessionId

		logger.log(
			`Starting periodic status report for session ${sessionId} (interval: ${interval}ms)`,
		)

		this.periodicReportTimer = setInterval(() => {
			this.performPeriodicReport()
		}, interval)
	}

	/**
	 * Stop periodic status reporting
	 */
	stopPeriodicReport(): void {
		if (this.periodicReportTimer) {
			clearInterval(this.periodicReportTimer)
			this.periodicReportTimer = null
			logger.log("Stopped periodic status report")
		}
		this.currentSessionId = null
	}

	/**
	 * Check if periodic reporting is active
	 */
	isPeriodicReportActive(): boolean {
		return this.periodicReportTimer !== null
	}

	/**
	 * Perform periodic status report
	 */
	private async performPeriodicReport(): Promise<void> {
		if (!this.currentSessionId) {
			logger.warn("No active session for periodic report")
			return
		}

		// Only report if recording is active
		if (!recordSummaryStore.isRecording) {
			logger.log("Recording not active, skipping periodic report")
			return
		}

		try {
			const reportData = this.prepareReportData()
			if (!reportData) {
				logger.warn("Failed to prepare report data for periodic report")
				return
			}

			// Use "recording" status for periodic updates
			await this.reportStatus({
				...reportData,
				status: RecordingSummaryStatus.Recording,
			})
		} catch (error) {
			logger.error("Periodic report failed", error)
			this.onReportError?.(error as Error)
		}
	}

	/**
	 * Prepare current report data from store
	 */
	private prepareReportData(): Omit<StatusReportParams, "status"> | null {
		const { businessData, note } = recordSummaryStore

		if (!this.currentSessionId || !businessData.model) {
			return null
		}

		// Get latest ASR content (limited to 10000 characters)
		const asrStreamContent = recordSummaryStore.message.reduce((acc, curr) => {
			const currentText = curr?.text ?? ""
			if (acc.length + currentText.length <= 10000) {
				return acc + currentText
			}
			return acc
		}, "")

		return {
			task_key: this.currentSessionId,
			model_id: businessData.model.model_id,
			note: note,
			asr_stream_content: asrStreamContent,
		}
	}

	/**
	 * Get current reporter status (for debugging)
	 */
	getStatus() {
		return {
			isPeriodicReportActive: this.isPeriodicReportActive(),
			currentSessionId: this.currentSessionId,
			lastReportedStatus: this.lastReportedStatus,
			isReporting: this.isReporting,
		}
	}

	/**
	 * Dispose and cleanup
	 */
	dispose(): void {
		this.stopPeriodicReport()
		this.currentSessionId = null
		this.lastReportedStatus = null
		this.isReporting = false
		logger.log("RecordingStatusReporter disposed")
	}
}

export { RecordingStatusReporter, RecordingSummaryStatus, type StatusReportParams }
