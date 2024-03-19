import { logger as Logger } from "@/opensource/utils/log"
import { preloadRecordSummaryFloatPanel } from "./recordSummary/utils/preloadService"

const logger = Logger.createLogger("initRecordSummaryService")

export interface InitRecordSummaryParams {
	userId?: string
	organizationCode?: string
}

/**
 * Lazy init & restore recording summary by platform (app/web).
 * Only loads heavy services when recoverable data exists.
 */
export async function tryRestorePreviousRecordSummarySession({
	userId,
}: InitRecordSummaryParams): Promise<void> {
	const { hasRecoverableRecordingSession } =
		await import("./recordSummary/recordingRecoveryChecker")
	const shouldRestore = hasRecoverableRecordingSession(userId)
	if (!shouldRestore) {
		logger.log("录音摘要服务无可恢复会话，跳过懒加载")
		return
	}

	logger.log("懒加载录音摘要服务，用于恢复录音会话")
	try {
		const { initializeService } = await import("./recordSummary/serviceInstance")

		// 预加载浮动面板
		preloadRecordSummaryFloatPanel()

		const recordSummaryService = initializeService()
		await recordSummaryService.tryRestorePreviousSession()
	} catch (error) {
		logger.error("恢复录音会话失败", error)
	}
}
