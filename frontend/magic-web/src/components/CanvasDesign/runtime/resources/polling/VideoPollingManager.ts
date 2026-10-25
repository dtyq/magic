import type { Canvas } from "../../core/Canvas"
import type { VideoElement as VideoElementData, VideoElementContent } from "../../document/types"
import {
	getActiveContent,
	getContentById,
	getContents,
	updateContent,
} from "../../document/elementContent"
import {
	finalizeMediaSourceReplacement,
	mergeMediaSourceReplacementFields,
} from "../../document/mediaSourceReplacement"
import type {
	GetVideoGenerationResultParams,
	VideoGenerationResultResponse,
} from "../../../public/magic-types"
import { VIDEO_CONFIG } from "../../elements/video/VideoElement.config"
import { resolveCanvasGeneratedResourceStoragePath } from "../../shared/path/canvasResourcePath"
import {
	extractSmartNameFromFileName,
	getGenerationResultStatusPatch,
	isGenerationTaskNotFoundError,
	shouldContinueGenerationPolling,
} from "./generationPollingUtils"

/** 视频轮询管理器构造参数。 */
export interface VideoPollingManagerConfig {
	/** 画布上的视频元素 id。 */
	elementId: string
	canvas: Canvas
	/** 读取最新元素数据（含 generateVideoRequest.video_id）。 */
	getElementData: () => VideoElementData
	/** 构造时可指定一个需要轮询的 Content。 */
	contentId?: string
	/** 轮询同步出现临时异常时通知视图层自行处理展示态。 */
	onPollingIssue?: (contentId?: string) => void
}

/**
 * 视频生成提交后，按 Content 独立轮询，直到状态脱离 Pending/Processing。
 *
 * 一个元素可以同时拥有多个后台生成 Content；每个请求都必须通过自己的
 * contentId 读取和写回，切换 active Content 不会中断其他版本的轮询。
 */
export class VideoPollingManager {
	private config: VideoPollingManagerConfig
	private isPolling = false
	private pollingContentIds = new Set<string | undefined>()
	private pollingTimers = new Map<string, ReturnType<typeof setTimeout>>()
	private inFlightKeys = new Set<string>()
	private unsubscribeElementUpdated?: () => void

	constructor(config: VideoPollingManagerConfig) {
		this.config = config
		this.pollingContentIds.add(config.contentId)

		const eventEmitter = config.canvas.eventEmitter as typeof config.canvas.eventEmitter & {
			on?: (
				event: "element:updated",
				listener: (event: { data: { elementId: string } }) => void,
			) => () => void
		}
		if (typeof eventEmitter.on === "function") {
			this.unsubscribeElementUpdated = eventEmitter.on("element:updated", (event) => {
				if (event.data?.elementId !== this.config.elementId) return
				this.syncWithElementData()
			})
		}
	}

	/** 追加新 Content 后，将轮询绑定到本次提交的 Content。 */
	public setContentId(contentId?: string): void {
		this.config.contentId = contentId
		this.pollingContentIds.add(contentId)
	}

	/** 开始指定 Content 的轮询；未传入时使用构造或最近一次设置的 Content。 */
	public start(contentId = this.config.contentId): void {
		this.pollingContentIds.add(contentId)
		this.syncPendingTargets()
		if (this.pollingContentIds.size === 0) return
		this.isPolling = true
		for (const targetContentId of this.pollingContentIds) {
			void this.poll(targetContentId)
		}
	}

	/** 停止全部轮询并清除定时器。 */
	public stop(): void {
		this.isPolling = false
		for (const timer of this.pollingTimers.values()) clearTimeout(timer)
		this.pollingTimers.clear()
		this.inFlightKeys.clear()
		this.pollingContentIds.clear()
	}

	/** 等价于 stop，供元素销毁时调用。 */
	public destroy(): void {
		this.stop()
		this.unsubscribeElementUpdated?.()
		this.unsubscribeElementUpdated = undefined
	}

	private async poll(contentId?: string): Promise<void> {
		const key = this.getContentKey(contentId)
		if (
			!this.isPolling ||
			!this.pollingContentIds.has(contentId) ||
			this.inFlightKeys.has(key)
		) {
			return
		}
		if (!this.shouldPollCurrentElement(contentId)) {
			this.removeTarget(contentId)
			return
		}

		const videoId = this.getPollingVideoId(contentId)
		if (!videoId) {
			this.removeTarget(contentId)
			return
		}

		this.inFlightKeys.add(key)
		try {
			const result = await this.fetchGenerationResult(videoId, contentId)
			if (!result || !this.isCurrentTarget(contentId)) return

			const didApplyPatch = this.applyResultPatch(result, contentId)
			if (!didApplyPatch) return

			this.finishPoll(result.status, contentId)
		} finally {
			this.inFlightKeys.delete(key)
			this.syncWithElementData()
		}
	}

	private getPollingVideoId(contentId?: string): string | undefined {
		return this.getPollingContent(contentId)?.generateVideoRequest?.video_id
	}

	private getPollingContent(contentId?: string): VideoElementContent | undefined {
		const element = this.config.getElementData()
		return contentId
			? getContentById(element, contentId)
			: getActiveContent<VideoElementContent>(element)
	}

	private shouldPollCurrentElement(contentId?: string): boolean {
		const content = this.getPollingContent(contentId)
		if (!content?.generateVideoRequest?.video_id || content.src) return false
		return !content.status || shouldContinueGenerationPolling(content.status)
	}

	private syncPendingTargets(): void {
		const element = this.config.getElementData()
		for (const content of getContents(element)) {
			if (
				content.generateVideoRequest?.video_id &&
				!content.src &&
				(!content.status || shouldContinueGenerationPolling(content.status))
			) {
				this.pollingContentIds.add(content.contentId)
			}
		}

		for (const contentId of [...this.pollingContentIds]) {
			if (!this.shouldPollCurrentElement(contentId)) this.removeTarget(contentId)
		}
	}

	private syncWithElementData(): void {
		if (!this.isPolling) return
		this.syncPendingTargets()
		for (const contentId of this.pollingContentIds) {
			const key = this.getContentKey(contentId)
			if (this.inFlightKeys.has(key) || this.pollingTimers.has(key)) continue
			void this.poll(contentId)
		}
	}

	private async fetchGenerationResult(
		videoId: string,
		contentId?: string,
	): Promise<VideoGenerationResultResponse | undefined> {
		const getVideoGenerationResult =
			this.config.canvas.magicConfigManager.config?.methods?.getVideoGenerationResult
		if (!getVideoGenerationResult) {
			this.removeTarget(contentId)
			return undefined
		}

		try {
			const params: GetVideoGenerationResultParams = { video_id: videoId }
			return await getVideoGenerationResult(params)
		} catch (error) {
			if (isGenerationTaskNotFoundError(error, videoId)) {
				this.recoverMissingTask(videoId, contentId)
				return undefined
			}
			this.handleRecoverablePollingIssue(contentId)
			return undefined
		}
	}

	private recoverMissingTask(videoId: string, contentId?: string): void {
		const elementData = this.config.getElementData()
		const content = this.getPollingContent(contentId)
		if (content?.generateVideoRequest?.video_id !== videoId) return

		const next = updateContent(elementData, contentId, {
			generateVideoRequest: undefined,
			videoGenerationResultMeta: undefined,
			status: undefined,
			errorMessage: undefined,
		})
		this.config.canvas.elementManager.update(this.config.elementId, next, {
			silent: false,
			historyPolicy: "exclude",
		})
		this.config.canvas.eventEmitter.emit({
			type: "element:video:generate-submit-failed",
			data: { elementId: this.config.elementId },
		})
		this.removeTarget(contentId)
	}

	private buildResultPatch(
		result: VideoGenerationResultResponse,
	): Partial<VideoElementContent> & { name?: string } {
		const storagePath =
			result.file_dir && result.file_name
				? resolveCanvasGeneratedResourceStoragePath(
						this.config.canvas,
						result.file_dir,
						result.file_name,
					)
				: undefined
		const updateData: Partial<VideoElementContent> & { name?: string } = {
			...getGenerationResultStatusPatch(
				result.status,
				result.error_message,
				Boolean(storagePath),
			),
			videoGenerationResultMeta: {
				billing: result.billing ?? null,
				generation_info: result.generation_info ?? null,
				runtime: result.runtime ?? null,
			},
		}

		if (storagePath && result.file_name) {
			updateData.src = storagePath
			updateData.name = extractSmartNameFromFileName(result.file_name)
		}

		return updateData
	}

	private applyResultPatch(result: VideoGenerationResultResponse, contentId?: string): boolean {
		if (!this.config.canvas.elementManager.hasElement(this.config.elementId)) {
			this.removeTarget(contentId)
			return false
		}

		try {
			const updateData = this.buildResultPatch(result)
			const elementData = this.config.getElementData()
			const { name, ...contentPatch } = updateData
			const currentContent = getContentById(elementData, contentId)
			const normalizedPatch = currentContent
				? mergeMediaSourceReplacementFields(currentContent, contentPatch)
				: contentPatch
			const next = updateContent(elementData, contentId, normalizedPatch)
			this.config.canvas.elementManager.update(
				this.config.elementId,
				name ? { ...next, name } : next,
				{ silent: false, historyPolicy: "exclude" },
			)
			if (currentContent && typeof normalizedPatch.src === "string") {
				finalizeMediaSourceReplacement(this.config.canvas, {
					previousSrc: currentContent.src,
					nextSrc: normalizedPatch.src,
					previousComplianceCheckId:
						"complianceCheckId" in currentContent
							? currentContent.complianceCheckId
							: undefined,
					previousAssetId:
						"assetId" in currentContent ? currentContent.assetId : undefined,
				})
			}
			return true
		} catch {
			this.handleRecoverablePollingIssue(contentId)
			return false
		}
	}

	private finishPoll(status: VideoGenerationResultResponse["status"], contentId?: string): void {
		if (shouldContinueGenerationPolling(status)) {
			this.scheduleNextPoll(contentId)
			return
		}
		this.removeTarget(contentId)
	}

	private handleRecoverablePollingIssue(contentId?: string): void {
		if (!this.isPolling || !this.isCurrentTarget(contentId)) return
		this.config.onPollingIssue?.(contentId)
		this.scheduleNextPoll(contentId)
	}

	private scheduleNextPoll(contentId?: string): void {
		if (!this.isPolling || !this.isCurrentTarget(contentId)) return
		const key = this.getContentKey(contentId)
		const previousTimer = this.pollingTimers.get(key)
		if (previousTimer) clearTimeout(previousTimer)
		const timer = setTimeout(() => {
			this.pollingTimers.delete(key)
			void this.poll(contentId)
		}, VIDEO_CONFIG.POLLING_INTERVAL)
		this.pollingTimers.set(key, timer)
	}

	private removeTarget(contentId?: string): void {
		this.pollingContentIds.delete(contentId)
		const key = this.getContentKey(contentId)
		const timer = this.pollingTimers.get(key)
		if (timer) clearTimeout(timer)
		this.pollingTimers.delete(key)
		if (this.pollingContentIds.size === 0) this.isPolling = false
	}

	private isCurrentTarget(contentId?: string): boolean {
		return this.isPolling && this.pollingContentIds.has(contentId)
	}

	private getContentKey(contentId?: string): string {
		return `content:${contentId ?? "active"}`
	}
}
