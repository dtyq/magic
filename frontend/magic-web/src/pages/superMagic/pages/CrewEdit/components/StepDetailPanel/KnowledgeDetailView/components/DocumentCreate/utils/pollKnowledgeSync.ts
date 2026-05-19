import { KnowledgeApi } from "@/apis"
import type { KnowledgeSyncProgress } from "@/types/source-binding"
import { KnowledgeSyncStatus } from "@/types/source-binding"

/**
 * 轮询配置
 */
const POLL_CONFIG = {
	/** 轮询间隔(毫秒) */
	interval: 3000,
	/** 最大轮询次数 */
	maxAttempts: 60,
}

/**
 * 轮询结果
 */
export interface PollResult {
	/** 是否成功 */
	success: boolean
	/** 错误信息 */
	error?: string
	/** 同步进度数据 */
	data?: KnowledgeSyncProgress
}

/**
 * 轮询知识库同步状态
 *
 * @param knowledgeBaseCode 知识库代码
 * @param onProgress 进度回调
 * @returns 轮询结果
 */
export async function pollKnowledgeBaseStatus(
	knowledgeBaseCode: string,
	onProgress: (progress: KnowledgeSyncProgress) => void,
): Promise<PollResult> {
	let attempts = 0

	while (attempts < POLL_CONFIG.maxAttempts) {
		attempts++

		try {
			// 获取知识库详情
			const detail = await KnowledgeApi.getCrewKnowledgeDetail(knowledgeBaseCode)

			if (!detail) {
				return {
					success: false,
					error: "cannotGetDetail",
				}
			}

			// 构建进度信息
			const progress: KnowledgeSyncProgress = {
				sync_status: detail.sync_status,
				sync_status_message: detail.sync_status_message,
				expected_count: detail.expected_count || 0,
				completed_count: detail.completed_count || 0,
				document_count: detail.document_count || 0,
			}

			// 调用进度回调
			onProgress(progress)

			// 检查同步状态
			if (progress.sync_status === KnowledgeSyncStatus.SYNCED) {
				// 同步成功
				return {
					success: true,
					data: progress,
				}
			}

			if (
				progress.sync_status === KnowledgeSyncStatus.SYNC_FAILED ||
				progress.sync_status === KnowledgeSyncStatus.DELETE_FAILED
			) {
				// 同步失败或删除失败
				return {
					success: false,
					error: progress.sync_status_message || "syncFailed",
					data: progress,
				}
			}

			// 同步中、等待同步或重建中,继续轮询
			if (
				progress.sync_status === KnowledgeSyncStatus.SYNCING ||
				progress.sync_status === KnowledgeSyncStatus.PENDING ||
				progress.sync_status === KnowledgeSyncStatus.REBUILDING
			) {
				// 等待下次轮询
				await new Promise((resolve) => setTimeout(resolve, POLL_CONFIG.interval))
				continue
			}

			// 已删除状态
			if (progress.sync_status === KnowledgeSyncStatus.DELETED) {
				return {
					success: false,
					error: "knowledgeDeleted",
					data: progress,
				}
			}

			// 未知状态
			return {
				success: false,
				error: `unknownSyncStatus:${progress.sync_status}`,
			}
		} catch (error) {
			console.error(`轮询知识库状态失败 (第 ${attempts} 次尝试):`, error)

			// 如果是最后一次尝试,返回错误
			if (attempts >= POLL_CONFIG.maxAttempts) {
				return {
					success: false,
					error: error instanceof Error ? error.message : "pollError",
				}
			}

			// 等待后重试
			await new Promise((resolve) => setTimeout(resolve, POLL_CONFIG.interval))
		}
	}

	// 轮询超时
	return {
		success: false,
		error: `pollTimeout:${POLL_CONFIG.maxAttempts}:${(POLL_CONFIG.maxAttempts * POLL_CONFIG.interval) / 1000}`,
	}
}

/**
 * 取消轮询(预留接口,当前版本暂未实现)
 */
export function cancelPoll() {
	// TODO: 实现取消轮询逻辑
	console.warn("cancelPoll 未实现")
}
