import { toast } from "sonner"
import {
	GenerationStatus,
	type GenerateVideoRequest,
	type VideoModelItem,
} from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import { getContentState, updateContent } from "../../document/elementContent"
import {
	ElementTypeEnum,
	type VideoElement as VideoElementData,
	type VideoElementContent,
} from "../../document/types"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { VideoElement } from "../../elements/video/VideoElement"
import { generateElementId } from "../../shared/ids"
import {
	collectConnectionCreateObstacleRects,
	resolveConnectionCreateGapForElement,
} from "../../shared/placement/connectionCreatePlacement"
import { resolveConnectedPlacement } from "../../shared/placement/placementEngine"
import { getCanvasResourceReferenceIdentity } from "../../shared/path/canvasResourcePath"
import { resolveGenerationErrorMessage } from "../polling/generationPollingUtils"
import {
	isDraftVideoContent,
	isVideoDraftFinalRequestForSource,
	VIDEO_DRAFT_FINAL_RESOLUTION,
	resolveVideoDraftFinalElementSize,
} from "./videoDraftFinalRequest"

export type VideoDraftFinalStatus = "idle" | "processing" | "completed" | "error" | "cancelled"

export interface VideoDraftFinalState {
	status: VideoDraftFinalStatus
	resultElementId?: string
	resultConnectionId?: string
	errorMessage?: string
	activeJobCount: number
}

interface VideoDraftFinalJob {
	key: string
	sourceElementId: string
	sourceContentId: string
	sourceIdentity: string
	resultElementId: string
	resultConnectionId: string
	submissionSettled: boolean
	generateFailed: boolean
	cancelled: boolean
	finalized: boolean
}

interface StartVideoDraftFinalOptions {
	sourceElementId: string
	sourceContentId: string
	request: GenerateVideoRequest
}

type VideoDraftFinalListener = (state: VideoDraftFinalState) => void

function sourceKey(elementId: string, contentId: string): string {
	return `${elementId}:${contentId}`
}

export class VideoDraftFinalManager {
	private readonly canvas: Canvas
	/** 以结果元素为任务主键，同一样片允许同时存在多个正片任务。 */
	private readonly jobs = new Map<string, VideoDraftFinalJob>()
	private readonly snapshots = new Map<string, Omit<VideoDraftFinalState, "activeJobCount">>()
	private readonly listeners = new Map<string, Set<VideoDraftFinalListener>>()
	private destroyed = false
	private readonly elementUpdatedUnsubscribe: () => void
	private readonly elementDeletedUnsubscribe: () => void
	private readonly videoGenerateFailedUnsubscribe: () => void
	private readonly connectionChangedUnsubscribe: () => void
	private readonly canvasClearUnsubscribe: () => void

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.elementUpdatedUnsubscribe = this.canvas.eventEmitter.on(
			"element:updated",
			({ data }) => this.handleElementUpdated(data.elementId),
		)
		this.elementDeletedUnsubscribe = this.canvas.eventEmitter.on(
			"element:deleted",
			({ data }) => this.handleElementDeleted(data.elementId),
		)
		this.videoGenerateFailedUnsubscribe = this.canvas.eventEmitter.on(
			"element:video:generate-submit-failed",
			({ data }) => this.handleVideoGenerateFailed(data.elementId),
		)
		this.connectionChangedUnsubscribe = this.canvas.eventEmitter.on("connection:change", () => {
			const connectionIds = new Set(
				this.canvas.connectionManager.getConnections().map((connection) => connection.id),
			)
			for (const job of Array.from(this.jobs.values())) {
				if (job.cancelled || job.finalized || connectionIds.has(job.resultConnectionId))
					continue
				this.cancelJob(job)
			}
			this.notifyAll()
		})
		this.canvasClearUnsubscribe = this.canvas.eventEmitter.on("canvas:clear", () => {
			for (const job of Array.from(this.jobs.values())) this.cancelJob(job)
			this.notifyAll()
		})
	}

	public subscribe(
		sourceElementId: string,
		sourceContentId: string,
		listener: VideoDraftFinalListener,
	): () => void {
		const key = sourceKey(sourceElementId, sourceContentId)
		const listeners = this.listeners.get(key) ?? new Set<VideoDraftFinalListener>()
		listeners.add(listener)
		this.listeners.set(key, listeners)
		listener(this.getState(sourceElementId, sourceContentId))
		return () => {
			listeners.delete(listener)
			if (listeners.size === 0) this.listeners.delete(key)
		}
	}

	public getState(sourceElementId: string, sourceContentId: string): VideoDraftFinalState {
		const key = sourceKey(sourceElementId, sourceContentId)
		const activeJobs = Array.from(this.jobs.values()).filter(
			(job) => !job.cancelled && !job.finalized && job.key === key,
		)
		const activeJob = activeJobs[activeJobs.length - 1]
		const snapshot = activeJob
			? {
					status: "processing" as const,
					resultElementId: activeJob.resultElementId,
					resultConnectionId: activeJob.resultConnectionId,
				}
			: (this.snapshots.get(key) ?? { status: "idle" as const })
		return {
			...snapshot,
			activeJobCount: activeJobs.length,
		}
	}

	public async start(options: StartVideoDraftFinalOptions): Promise<boolean> {
		if (this.destroyed) return false
		const key = sourceKey(options.sourceElementId, options.sourceContentId)
		const sourceElement = this.canvas.elementManager.getElementData(options.sourceElementId)
		const sourceContent = this.getSourceContent(
			options.sourceElementId,
			options.sourceContentId,
		)
		if (
			!sourceElement ||
			sourceElement.type !== ElementTypeEnum.Video ||
			!sourceContent ||
			getContentState(sourceContent) !== "completed" ||
			!isDraftVideoContent(sourceContent) ||
			!isVideoDraftFinalRequestForSource(
				options.request,
				sourceContent,
				this.canvas.magicConfigManager.config?.methods?.resolveResourceReference,
			)
		) {
			return false
		}

		const identity = this.getSourceIdentity(sourceContent)
		if (!identity) return false

		const resultElementId = generateElementId()
		const resultSize = await this.resolveResultSize(sourceContent, sourceElement)
		const currentSourceElement = this.canvas.elementManager.getElementData(sourceElement.id)
		const currentSourceContent = this.getSourceContent(
			sourceElement.id,
			sourceContent.contentId,
		)
		if (
			this.destroyed ||
			!currentSourceElement ||
			currentSourceElement.type !== ElementTypeEnum.Video ||
			!currentSourceContent ||
			this.getSourceIdentity(currentSourceContent) !== identity
		) {
			return false
		}
		try {
			if (!this.createPlaceholder(currentSourceElement, resultElementId, resultSize)) {
				return this.fail(
					key,
					this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
				)
			}
		} catch {
			return this.fail(
				key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
		}
		let connection: ReturnType<typeof this.canvas.connectionManager.connectRuntimeElements>
		try {
			connection = this.canvas.connectionManager.connectRuntimeElements({
				sourceElementId: sourceElement.id,
				targetElementId: resultElementId,
			})
		} catch {
			this.cleanupResult(resultElementId)
			return this.fail(
				key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
		}
		if (connection.status !== "created") {
			this.cleanupResult(resultElementId)
			return this.fail(
				key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
		}

		const job: VideoDraftFinalJob = {
			key,
			sourceElementId: sourceElement.id,
			sourceContentId: sourceContent.contentId,
			sourceIdentity: identity,
			resultElementId,
			resultConnectionId: connection.connectionId,
			submissionSettled: false,
			generateFailed: false,
			cancelled: false,
			finalized: false,
		}
		this.jobs.set(resultElementId, job)
		this.updateSnapshot(key, {
			status: "processing",
			resultElementId,
			resultConnectionId: connection.connectionId,
			errorMessage: undefined,
		})

		const resultInstance = this.canvas.elementManager.getElementInstance(resultElementId)
		if (!(resultInstance instanceof VideoElement)) {
			this.cleanupJob(job)
			return this.fail(
				key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
		}

		try {
			const submitted = await resultInstance.generateVideo(options.request, {
				failurePolicy: "remove-placeholder",
				keepTemporaryUntilComplete: true,
			})
			job.submissionSettled = true
			if (!this.isCurrentJob(job)) {
				// remove-placeholder 会在 generateVideo 返回前删除目标并触发取消收尾；
				// 已收到明确提交失败事件时仍应对外呈现 error，而不是 cancelled。
				if (job.generateFailed) {
					return this.fail(
						key,
						this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
					)
				}
				return false
			}
			if (!submitted || job.generateFailed) {
				this.cleanupJob(job)
				return this.fail(
					key,
					this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
				)
			}
			if (!this.isCurrentJob(job)) return false
			return true
		} catch {
			job.submissionSettled = true
			if (!this.isCurrentJob(job)) return false
			this.cleanupJob(job)
			return this.fail(
				key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
		}
	}

	public cancel(sourceElementId: string, sourceContentId: string): void {
		const key = sourceKey(sourceElementId, sourceContentId)
		for (const job of Array.from(this.jobs.values())) {
			if (job.key === key) this.cancelJob(job)
		}
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		for (const job of Array.from(this.jobs.values())) this.cancelJob(job)
		this.jobs.clear()
		this.elementUpdatedUnsubscribe()
		this.elementDeletedUnsubscribe()
		this.videoGenerateFailedUnsubscribe()
		this.connectionChangedUnsubscribe()
		this.canvasClearUnsubscribe()
		this.listeners.clear()
		this.snapshots.clear()
	}

	private getSourceContent(
		sourceElementId: string,
		sourceContentId: string,
	): VideoElementContent | undefined {
		const source = this.canvas.elementManager.getElementData(sourceElementId)
		if (!source || source.type !== ElementTypeEnum.Video) return undefined
		return source.contents.find((content) => content.contentId === sourceContentId)
	}

	private isCurrentJob(job: VideoDraftFinalJob): boolean {
		return this.jobs.get(job.resultElementId) === job && !job.cancelled && !job.finalized
	}

	private getSourceIdentity(content: VideoElementContent): string {
		const videoId = content.generateVideoRequest?.video_id?.trim()
		if (videoId) return `video:${videoId}`
		const uriIdentity = getCanvasResourceReferenceIdentity(
			content.src,
			this.canvas.magicConfigManager.config?.methods?.resolveResourceReference,
		)
		return uriIdentity ? `uri:${uriIdentity}` : ""
	}

	private async resolveResultSize(
		content: VideoElementContent,
		source: VideoElementData,
	): Promise<{
		width: number
		height: number
	}> {
		const getVideoModelList = this.canvas.magicConfigManager.config?.methods?.getVideoModelList
		let model: VideoModelItem | undefined
		if (getVideoModelList) {
			try {
				const models = await getVideoModelList()
				model = models.find(
					(candidate) => candidate.model_id === content.generateVideoRequest?.model_id,
				)
			} catch {
				// Older hosts may not expose model metadata; the ratio-based fallback below keeps the node usable.
			}
		}
		const configuredSize = resolveVideoDraftFinalElementSize(model, content)
		if (configuredSize) return configuredSize

		const sourceWidth = source.width ?? 16
		const sourceHeight = source.height ?? 9
		const sourceAspectRatio = sourceWidth / Math.max(1, sourceHeight)
		return sourceAspectRatio >= 1
			? { width: 1920, height: Math.max(1, Math.round(1920 / sourceAspectRatio)) }
			: { width: Math.max(1, Math.round(1920 * sourceAspectRatio)), height: 1920 }
	}

	private createPlaceholder(
		source: VideoElementData,
		resultElementId: string,
		resultSize: { width: number; height: number },
	): boolean {
		const width = Math.max(1, resultSize.width)
		const height = Math.max(1, resultSize.height)
		const originRect = this.canvas.geometryCacheManager.getElementBounds(source.id) ?? {
			x: source.x ?? 0,
			y: source.y ?? 0,
			width,
			height,
		}
		const position = resolveConnectedPlacement(
			this.canvas,
			{
				originSide: "right",
				source: "handle",
				canvasX: originRect.x + originRect.width,
				canvasY: originRect.y + originRect.height / 2,
			},
			{ width, height },
			{
				output: "top-left",
				originElementId: source.id,
				originRect,
				gap: resolveConnectionCreateGapForElement(source, "right"),
				obstacleRects: collectConnectionCreateObstacleRects(this.canvas, {
					excludeElementIds: [source.id],
				}),
			},
		)
		const result = ElementFactory.createElementData(
			ElementTypeEnum.Video,
			resultElementId,
			position.x,
			position.y,
			width,
			height,
			this.canvas.elementManager.getNextZIndexInLevel(),
		)
		if (result.type !== ElementTypeEnum.Video) return false
		const sourceName = source.name?.trim()
		result.name = sourceName
			? `${sourceName}(${VIDEO_DRAFT_FINAL_RESOLUTION})`
			: `${this.translate("video.finalResultName", "正片视频")}(${VIDEO_DRAFT_FINAL_RESOLUTION})`
		result.contents = [
			{
				contentId:
					result.activeContentId ??
					result.mainContentId ??
					`${resultElementId}-content-1`,
				status: GenerationStatus.Processing,
			},
		]
		this.canvas.elementManager.createTemporaryElement(
			result,
			{ silent: true },
			"generation-result",
		)
		return true
	}

	private handleElementUpdated(elementId: string): void {
		for (const job of Array.from(this.jobs.values())) {
			if (job.cancelled || job.finalized) continue
			if (job.sourceElementId === elementId) {
				const sourceContent = this.getSourceContent(
					job.sourceElementId,
					job.sourceContentId,
				)
				if (
					!sourceContent ||
					this.getSourceIdentity(sourceContent) !== job.sourceIdentity
				) {
					this.cancelJob(job)
				}
				continue
			}
			if (job.resultElementId !== elementId) continue
			const result = this.canvas.elementManager.getElementData(elementId)
			if (!result || result.type !== ElementTypeEnum.Video) {
				this.cancelJob(job)
				continue
			}
			const content = result.contents.find(
				(candidate) => candidate.contentId === result.activeContentId,
			)
			if (!content) {
				this.cancelJob(job)
				continue
			}
			if (content.status === GenerationStatus.Failed) {
				const message = resolveGenerationErrorMessage(
					content.errorMessage,
					this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
				)
				this.cleanupJob(job)
				void this.fail(job.key, message)
				continue
			}
			if (content.status === GenerationStatus.Completed && content.src) {
				this.promoteResult(job, result)
			}
		}
		this.notifyAll()
	}

	private handleElementDeleted(elementId: string): void {
		for (const job of Array.from(this.jobs.values())) {
			if (job.cancelled || job.finalized) continue
			if (job.sourceElementId === elementId || job.resultElementId === elementId) {
				this.cancelJob(job)
			}
		}
		this.notifyAll()
	}

	private handleVideoGenerateFailed(elementId: string): void {
		const job = Array.from(this.jobs.values()).find(
			(candidate) =>
				candidate.resultElementId === elementId &&
				!candidate.cancelled &&
				!candidate.finalized,
		)
		if (!job) return
		job.generateFailed = true
		// generateVideo 会在同步提交失败时先发事件、再保存恢复草稿并返回 false；
		// 等提交 Promise 收口后再删除元素，确保 element:deleted 能清掉该草稿。
		if (!job.submissionSettled) return
		this.cleanupJob(job)
		void this.fail(
			job.key,
			this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
		)
	}

	private promoteResult(job: VideoDraftFinalJob, result: VideoElementData): void {
		job.finalized = true
		const next = updateContent(result, result.activeContentId ?? undefined, {
			status: GenerationStatus.Completed,
		})
		let promoted = false
		try {
			promoted = this.canvas.historyManager.runTransaction(
				() => {
					this.canvas.elementManager.convertToPermament(
						job.resultElementId,
						{ contents: next.contents },
						{ silent: false },
					)
					return this.canvas.connectionManager.promoteRuntimeConnection(
						job.resultConnectionId,
					)
				},
				(value) => value,
			)
		} catch {
			promoted = false
		}
		if (!promoted) {
			job.finalized = false
			this.cleanupJob(job)
			void this.fail(
				job.key,
				this.translate("videoEditor.generateFinalFailed", "正片生成失败，请重试"),
			)
			return
		}

		this.jobs.delete(job.resultElementId)
		this.updateSnapshot(job.key, {
			status: "completed",
			resultElementId: job.resultElementId,
			resultConnectionId: job.resultConnectionId,
			errorMessage: undefined,
		})
	}

	private cancelJob(job: VideoDraftFinalJob): void {
		if (job.cancelled || job.finalized) return
		this.cleanupJob(job)
		this.updateSnapshot(job.key, {
			status: "cancelled",
			resultElementId: undefined,
			resultConnectionId: undefined,
			errorMessage: undefined,
		})
	}

	private cleanupJob(job: VideoDraftFinalJob): void {
		job.cancelled = true
		if (this.jobs.get(job.resultElementId) === job) this.jobs.delete(job.resultElementId)
		this.cleanupResult(job.resultElementId, job.resultConnectionId)
	}

	private cleanupResult(resultElementId: string, connectionId?: string): void {
		if (connectionId) {
			this.canvas.connectionManager.removeConnections([connectionId], { emitChange: false })
		}
		if (this.canvas.elementManager.hasElement(resultElementId)) {
			this.canvas.elementManager.delete(resultElementId)
		}
	}

	private async fail(key: string, message: string): Promise<boolean> {
		this.updateSnapshot(key, {
			status: "error",
			resultElementId: undefined,
			resultConnectionId: undefined,
			errorMessage: message,
		})
		toast.error(message)
		return false
	}

	private updateSnapshot(
		key: string,
		updates: Partial<Omit<VideoDraftFinalState, "activeJobCount">>,
	): void {
		const next = { ...(this.snapshots.get(key) ?? { status: "idle" as const }), ...updates }
		this.snapshots.set(key, next)
		this.notifyKey(key)
	}

	private notifyKey(key: string): void {
		const [sourceElementId, ...contentParts] = key.split(":")
		const sourceContentId = contentParts.join(":")
		if (!sourceElementId || !sourceContentId) return
		const state = this.getState(sourceElementId, sourceContentId)
		this.listeners.get(key)?.forEach((listener) => listener({ ...state }))
	}

	private notifyAll(): void {
		for (const key of this.listeners.keys()) this.notifyKey(key)
	}

	private translate(key: string, fallback: string): string {
		return this.canvas.t?.(key, fallback) || fallback
	}
}
