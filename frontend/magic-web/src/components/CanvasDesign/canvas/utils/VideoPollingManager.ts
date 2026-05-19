import type { Canvas } from "../Canvas"
import type { VideoElement as VideoElementData } from "../types"
import type {
	GetVideoGenerationResultParams,
	VideoGenerationResultResponse,
} from "../../types.magic"
import { VIDEO_CONFIG } from "../element/elements/VideoElement.config"
import { joinUploadStoragePath } from "./pathUtils"
import {
	extractSmartNameFromFileName,
	shouldContinueGenerationPolling,
} from "./generationPollingUtils"

/** VideoPollingManager 构造参数 */
export interface VideoPollingManagerConfig {
	/** 画布上的视频元素 id */
	elementId: string
	canvas: Canvas
	/** 读取最新元素数据（含 generateVideoRequest.video_id） */
	getElementData: () => VideoElementData
	/** 轮询同步出现临时异常时通知视图层自行处理展示态 */
	onPollingIssue?: () => void
}

/**
 * 视频生成提交后，按间隔调用 getVideoGenerationResult，直到状态脱离 Pending/Processing
 */
export class VideoPollingManager {
	private config: VideoPollingManagerConfig
	private isPolling = false
	private pollingTimer?: ReturnType<typeof setTimeout>

	constructor(config: VideoPollingManagerConfig) {
		this.config = config
	}

	/** 开始轮询（若已在轮询则忽略） */
	public start(): void {
		if (this.isPolling || !this.shouldPollCurrentElement()) return
		this.isPolling = true
		this.poll()
	}

	/** 停止轮询并清除定时器 */
	public stop(): void {
		this.isPolling = false
		if (this.pollingTimer) {
			clearTimeout(this.pollingTimer)
			this.pollingTimer = undefined
		}
	}

	/** 等价于 stop，供元素销毁时调用 */
	public destroy(): void {
		this.stop()
	}

	private async poll(): Promise<void> {
		if (!this.isPolling) return
		if (!this.shouldPollCurrentElement()) {
			this.stop()
			return
		}

		const videoId = this.getPollingVideoId()
		if (!videoId) {
			this.stop()
			return
		}

		const result = await this.fetchGenerationResult(videoId)
		if (!result) {
			return
		}

		const didApplyPatch = this.applyResultPatch(result)
		if (!didApplyPatch) {
			return
		}

		this.finishPoll(result.status)
	}

	private getPollingVideoId(): string | undefined {
		return this.config.getElementData().generateVideoRequest?.video_id
	}

	private shouldPollCurrentElement(): boolean {
		const elementData = this.config.getElementData()
		if (!elementData.generateVideoRequest?.video_id) {
			return false
		}

		if (elementData.src) {
			return false
		}

		if (elementData.status && !shouldContinueGenerationPolling(elementData.status)) {
			return false
		}

		return true
	}

	private async fetchGenerationResult(
		videoId: string,
	): Promise<VideoGenerationResultResponse | undefined> {
		const getVideoGenerationResult =
			this.config.canvas.magicConfigManager.config?.methods?.getVideoGenerationResult
		if (!getVideoGenerationResult) {
			this.stop()
			return undefined
		}

		try {
			const params: GetVideoGenerationResultParams = {
				video_id: videoId,
			}
			return await getVideoGenerationResult(params)
		} catch {
			this.handleRecoverablePollingIssue()
			return undefined
		}
	}

	private buildResultPatch(result: VideoGenerationResultResponse): Partial<VideoElementData> {
		const updateData: Partial<VideoElementData> = {
			status: result.status,
			errorMessage: result.error_message ?? undefined,
		}

		if (result.file_dir && result.file_name) {
			updateData.src = joinUploadStoragePath(result.file_dir, result.file_name)
			updateData.name = extractSmartNameFromFileName(result.file_name)
		}

		return updateData
	}

	private applyResultPatch(result: VideoGenerationResultResponse): boolean {
		if (!this.config.canvas.elementManager.hasElement(this.config.elementId)) {
			this.stop()
			return false
		}

		try {
			const updateData = this.buildResultPatch(result)
			this.config.canvas.elementManager.update(this.config.elementId, updateData, {
				silent: false,
			})
			return true
		} catch {
			this.handleRecoverablePollingIssue()
			return false
		}
	}

	private finishPoll(status: VideoGenerationResultResponse["status"]): void {
		if (shouldContinueGenerationPolling(status)) {
			this.scheduleNextPoll()
			return
		}

		this.stop()
	}

	private handleRecoverablePollingIssue(): void {
		if (!this.isPolling) {
			return
		}

		this.config.onPollingIssue?.()
		this.scheduleNextPoll()
	}

	private scheduleNextPoll(): void {
		if (!this.isPolling) {
			return
		}

		if (this.pollingTimer) {
			clearTimeout(this.pollingTimer)
		}

		this.pollingTimer = setTimeout(() => {
			this.poll()
		}, VIDEO_CONFIG.POLLING_INTERVAL)
	}
}
