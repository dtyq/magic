import { toast } from "sonner"
import type { Canvas } from "../../core/Canvas"
import {
	getActiveContent,
	getDownstreamContent,
	updateContent,
} from "../../document/elementContent"
import {
	ElementTypeEnum,
	type VideoEditElement,
	type VideoEditElementContent,
	type AudioElementContent,
	type VideoElement as VideoElementData,
	type VideoElementContent,
} from "../../document/types"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { VideoElement } from "../../elements/video/VideoElement"
import { collectOrderedVideoEditInputs } from "../../interaction/connection/connectedInputSources"
import { generateElementId } from "../../shared/ids"
import {
	collectConnectionCreateObstacleRects,
	resolveConnectionCreateGapForElement,
} from "../../shared/placement/connectionCreatePlacement"
import { resolveConnectedPlacement } from "../../shared/placement/placementEngine"
import { GenerationStatus } from "../../../public/magic-types"
import type { GenerateVideoRequest } from "../../../public/magic-types"

export type VideoCompositionStatus =
	"idle" | "checking" | "preparing" | "processing" | "completed" | "error" | "cancelled"

export type VideoCompositionPhase = "checking" | "preparing" | "processing"

export interface VideoCompositionIssue {
	code: "missing-editor" | "missing-video" | "composition-failed" | "stale-input"
	elementId?: string
	message: string
}

export interface VideoCompositionSnapshot {
	status: VideoCompositionStatus
	progress: number
	phase?: VideoCompositionPhase
	issues: VideoCompositionIssue[]
	errorMessage?: string
	resultElementId?: string
	resultConnectionId?: string
}

export type VideoCompositionListener = (snapshot: VideoCompositionSnapshot) => void

interface CompositionJob {
	elementId: string
	resultElementId: string
	resultConnectionId: string
	signature: string
	cancelled: boolean
	finalized: boolean
}

const COMPOSITION_PLACEHOLDER_MIN_WIDTH = 320
const COMPOSITION_PLACEHOLDER_MIN_HEIGHT = 180
const COMPOSITION_PLACEHOLDER_SCALE = 0.6

interface VideoDimensions {
	width: number
	height: number
}

function cloneSnapshot(snapshot: VideoCompositionSnapshot): VideoCompositionSnapshot {
	return {
		...snapshot,
		issues: snapshot.issues.map((issue) => ({ ...issue })),
	}
}

function getContentSignature(canvas: Canvas, elementId: string): string | null {
	const element = canvas.elementManager.getElementData(elementId)
	if (!element || element.type !== ElementTypeEnum.VideoEdit) return null
	const content = getActiveContent<VideoEditElementContent>(element)
	if (!content) return null
	const inputs = collectOrderedVideoEditInputs(canvas, elementId)
	const videoSources = inputs.videoElementIds.map((sourceId) => {
		const source = canvas.elementManager.getElementData(sourceId)
		const sourceContent =
			source?.type === ElementTypeEnum.Video
				? getDownstreamContent<VideoElementContent>(source)
				: undefined
		return {
			id: sourceId,
			contentId: sourceContent?.contentId ?? null,
			src: sourceContent?.src ?? null,
		}
	})
	const audioSources = inputs.audioElementIds.map((sourceId) => {
		const source = canvas.elementManager.getElementData(sourceId)
		const sourceContent =
			source?.type === ElementTypeEnum.Audio
				? getDownstreamContent<AudioElementContent>(source)
				: undefined
		return {
			id: sourceId,
			contentId: sourceContent?.contentId ?? null,
			src: sourceContent?.src ?? null,
		}
	})
	return JSON.stringify({
		contentId: content.contentId,
		videoSequence: content.videoSequence ?? [],
		audioSequence: content.audioSequence ?? [],
		videoSources,
		audioSources,
	})
}

export class VideoCompositionManager {
	private readonly canvas: Canvas
	private readonly snapshots = new Map<string, VideoCompositionSnapshot>()
	private readonly listeners = new Map<string, Set<VideoCompositionListener>>()
	private readonly jobs = new Map<string, CompositionJob>()
	private destroyed = false
	private readonly elementUpdatedUnsubscribe: () => void
	private readonly elementDeletedUnsubscribe: () => void
	private readonly canvasClearUnsubscribe: () => void

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.elementUpdatedUnsubscribe = this.canvas.eventEmitter.on(
			"element:updated",
			({ data }) => {
				this.handleElementUpdated(data.elementId)
				this.jobs.forEach((job) => {
					if (job.resultElementId === data.elementId || job.cancelled || job.finalized)
						return
					if (getContentSignature(this.canvas, job.elementId) === job.signature) return
					this.cleanupJob(job)
					this.updateSnapshot(job.elementId, {
						status: "error",
						progress: 0,
						phase: undefined,
						issues: [{ code: "stale-input", message: "输入内容已变化，请重新合并" }],
						errorMessage: "输入内容已变化，请重新合并",
						resultElementId: undefined,
						resultConnectionId: undefined,
					})
				})
			},
		)
		this.elementDeletedUnsubscribe = this.canvas.eventEmitter.on(
			"element:deleted",
			({ data }) => this.handleElementDeleted(data.elementId),
		)
		this.canvasClearUnsubscribe = this.canvas.eventEmitter.on("canvas:clear", () => {
			this.jobs.forEach((job) => this.cancel(job.elementId, false))
		})
	}

	public subscribe(elementId: string, listener: VideoCompositionListener): () => void {
		const listeners = this.listeners.get(elementId) ?? new Set<VideoCompositionListener>()
		listeners.add(listener)
		this.listeners.set(elementId, listeners)
		listener(this.getSnapshot(elementId))
		return () => {
			listeners.delete(listener)
			if (listeners.size === 0) this.listeners.delete(elementId)
		}
	}

	public getSnapshot(elementId: string): VideoCompositionSnapshot {
		return cloneSnapshot(
			this.snapshots.get(elementId) ?? {
				status: "idle",
				progress: 0,
				issues: [],
			},
		)
	}

	public isComposingResult(elementId: string): boolean {
		for (const job of this.jobs.values()) {
			if (job.resultElementId === elementId && !job.cancelled && !job.finalized) return true
		}
		return false
	}

	public async start(elementId: string): Promise<boolean> {
		if (this.destroyed || this.jobs.has(elementId)) return false

		const editor = this.canvas.elementManager.getElementData(elementId)
		const content =
			editor?.type === ElementTypeEnum.VideoEdit
				? getActiveContent<VideoEditElementContent>(editor)
				: undefined
		const inputs = collectOrderedVideoEditInputs(this.canvas, elementId)
		if (!editor || editor.type !== ElementTypeEnum.VideoEdit) {
			return this.fail(elementId, "missing-editor", "找不到视频编辑节点")
		}
		if (!content || inputs.videoElementIds.length === 0) {
			return this.fail(elementId, "missing-video", "请先关联至少一个视频")
		}

		this.updateSnapshot(elementId, {
			status: "checking",
			progress: 0,
			phase: "checking",
			issues: [],
			errorMessage: undefined,
		})

		const resultElementId = generateElementId()
		const result = this.createPlaceholderResult(
			editor,
			resultElementId,
			inputs.videoElementIds[0],
		)
		if (!result) return this.fail(elementId, "composition-failed", "创建合成视频元素失败")

		const connection = this.canvas.connectionManager.connectRuntimeElements({
			sourceElementId: elementId,
			targetElementId: resultElementId,
		})
		if (connection.status !== "created") {
			this.cleanupResult(resultElementId)
			return this.fail(elementId, "composition-failed", "创建合成连接失败")
		}

		const job: CompositionJob = {
			elementId,
			resultElementId,
			resultConnectionId: connection.connectionId,
			signature: getContentSignature(this.canvas, elementId) ?? "",
			cancelled: false,
			finalized: false,
		}
		this.jobs.set(elementId, job)
		this.updateSnapshot(elementId, {
			status: "processing",
			progress: 0.1,
			phase: "processing",
			resultElementId,
			resultConnectionId: connection.connectionId,
		})

		if (getContentSignature(this.canvas, elementId) !== job.signature) {
			this.cleanupJob(job)
			return this.fail(elementId, "stale-input", "输入内容已变化，请重新合并")
		}

		const resultInstance = this.canvas.elementManager.getElementInstance(resultElementId)
		if (!(resultInstance instanceof VideoElement)) {
			this.cleanupJob(job)
			return this.fail(elementId, "composition-failed", "合成视频元素实例不可用")
		}
		try {
			const composition = this.buildCompositionRequest(elementId)
			if (!composition || composition.videos.length === 0) {
				this.cleanupJob(job)
				return this.fail(elementId, "missing-video", "请先关联至少一个有效视频")
			}
			const request: GenerateVideoRequest = {
				generation_type: "canvas_composition",
				composition,
			}
			const submitted = await resultInstance.generateVideo(request, {
				failurePolicy: "remove-placeholder",
				keepTemporaryUntilComplete: true,
			})
			if (!submitted) {
				this.cleanupJob(job)
				return this.fail(elementId, "composition-failed", "提交合并任务失败")
			}
			this.updateSnapshot(elementId, {
				status: "processing",
				progress: 0.2,
				phase: "processing",
			})
			return true
		} catch {
			this.cleanupJob(job)
			return this.fail(elementId, "composition-failed", "提交合并任务失败")
		}
	}

	private buildCompositionRequest(
		elementId: string,
	): NonNullable<GenerateVideoRequest["composition"]> | null {
		const inputs = collectOrderedVideoEditInputs(this.canvas, elementId)
		const videos = inputs.videoElementIds.map((sourceId) => {
			const source = this.canvas.elementManager.getElementData(sourceId)
			const content =
				source?.type === ElementTypeEnum.Video
					? getDownstreamContent<VideoElementContent>(source)
					: undefined
			return content?.src ? { path: content.src } : null
		})
		const audios = inputs.audioElementIds.map((sourceId) => {
			const source = this.canvas.elementManager.getElementData(sourceId)
			const content =
				source?.type === ElementTypeEnum.Audio
					? getDownstreamContent<AudioElementContent>(source)
					: undefined
			return content?.src ? { path: content.src } : null
		})
		if (videos.some((video) => video === null)) return null
		return {
			videos: videos as Array<{ path: string }>,
			...(audios.length > 0
				? { audios: audios.filter((audio): audio is { path: string } => audio !== null) }
				: {}),
		}
	}

	private isCurrentJob(job: CompositionJob): boolean {
		return this.jobs.get(job.elementId) === job && !job.cancelled && !job.finalized
	}

	public cancel(elementId: string, showToast = true): void {
		const job = this.jobs.get(elementId)
		if (!job) return
		job.cancelled = true
		this.cleanupJob(job)
		this.updateSnapshot(elementId, {
			status: "cancelled",
			progress: 0,
			phase: undefined,
			issues: [],
			resultElementId: undefined,
			resultConnectionId: undefined,
		})
		if (showToast) toast.info(this.translate("videoEditNode.mergeCancelled", "已取消合并"))
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.jobs.forEach((job) => {
			job.cancelled = true
			this.cleanupJob(job)
		})
		this.jobs.clear()
		this.elementUpdatedUnsubscribe()
		this.elementDeletedUnsubscribe()
		this.canvasClearUnsubscribe()
		this.listeners.clear()
	}

	private createPlaceholderResult(
		editor: VideoEditElement,
		resultElementId: string,
		firstVideoId?: string,
	): boolean {
		const { width, height } = this.resolvePlaceholderSize(editor, firstVideoId)
		const position = this.resolveResultPlacement(editor, { width, height })
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
		result.name = this.translate("videoEditNode.compositionResultName", "合并视频")
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

	/**
	 * 按后端文件合成服务的尺寸规则计算结果节点占位尺寸。
	 *
	 * enterprise-master 的合成任务未显式传输出规格时，会使用首个视频的
	 * FFprobe 宽高作为输出尺寸。画布侧优先使用同一视频已缓存的真实元数据，
	 * 再回退到视频元素尺寸，最后才使用编辑节点尺寸，确保占位节点至少保持
	 * 与最终视频一致的宽高比。
	 */
	private resolvePlaceholderSize(
		editor: VideoEditElement,
		firstVideoId?: string,
	): VideoDimensions {
		const fallback = {
			width: Math.max(
				COMPOSITION_PLACEHOLDER_MIN_WIDTH,
				Math.round((editor.width ?? 640) * COMPOSITION_PLACEHOLDER_SCALE),
			),
			height: Math.max(
				COMPOSITION_PLACEHOLDER_MIN_HEIGHT,
				Math.round((editor.height ?? 360) * COMPOSITION_PLACEHOLDER_SCALE),
			),
		}
		const source = firstVideoId
			? this.canvas.elementManager.getElementData(firstVideoId)
			: undefined
		if (!source || source.type !== ElementTypeEnum.Video) return fallback

		const sourceContent = getDownstreamContent<VideoElementContent>(source)
		const metadata = sourceContent?.src
			? this.canvas.videoResourceManager?.getCachedMetadata?.(sourceContent.src)
			: null
		const dimensions =
			this.normalizeVideoDimensions(metadata?.videoWidth, metadata?.videoHeight) ??
			this.normalizeVideoDimensions(source.width, source.height)
		if (!dimensions) return fallback

		return this.fitPlaceholderToAspectRatio(dimensions, fallback)
	}

	private normalizeVideoDimensions(width: unknown, height: unknown): VideoDimensions | null {
		if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return null
		if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return null
		return { width, height }
	}

	private fitPlaceholderToAspectRatio(
		dimensions: VideoDimensions,
		bounds: VideoDimensions,
	): VideoDimensions {
		const aspectRatio = dimensions.width / dimensions.height
		const fitScale = Math.min(
			bounds.width / dimensions.width,
			bounds.height / dimensions.height,
		)
		const minimumScale = Math.max(
			COMPOSITION_PLACEHOLDER_MIN_WIDTH / dimensions.width,
			COMPOSITION_PLACEHOLDER_MIN_HEIGHT / dimensions.height,
		)
		const scale = Math.max(fitScale, minimumScale)
		const width = Math.max(
			COMPOSITION_PLACEHOLDER_MIN_WIDTH,
			Math.round(dimensions.width * scale),
		)
		const height = Math.max(COMPOSITION_PLACEHOLDER_MIN_HEIGHT, Math.round(width / aspectRatio))
		return { width, height }
	}

	private resolveResultPlacement(
		editor: VideoEditElement,
		size: { width: number; height: number },
	): { x: number; y: number } {
		const originRect = this.canvas.geometryCacheManager.getElementBounds(editor.id) ?? {
			x: editor.x ?? 0,
			y: editor.y ?? 0,
			width: editor.width ?? 0,
			height: editor.height ?? 0,
		}
		return resolveConnectedPlacement(
			this.canvas,
			{
				originSide: "right",
				source: "handle",
				canvasX: originRect.x + originRect.width,
				canvasY: originRect.y + originRect.height / 2,
			},
			size,
			{
				output: "top-left",
				originElementId: editor.id,
				originRect,
				gap: resolveConnectionCreateGapForElement(editor, "right"),
				obstacleRects: collectConnectionCreateObstacleRects(this.canvas, {
					excludeElementIds: [editor.id],
				}),
			},
		)
	}

	private handleElementUpdated(elementId: string): void {
		const job = Array.from(this.jobs.values()).find(
			(candidate) => candidate.resultElementId === elementId,
		)
		if (!job || job.cancelled || job.finalized) return
		const result = this.canvas.elementManager.getElementData(elementId)
		if (!result || result.type !== ElementTypeEnum.Video) {
			this.cleanupJob(job)
			return
		}
		const content = getActiveContent<VideoElementContent>(result)
		if (!content) return
		if (content.status === GenerationStatus.Failed) {
			this.cleanupJob(job)
			this.updateSnapshot(job.elementId, {
				status: "error",
				progress: 0,
				phase: undefined,
				issues: [
					{ code: "composition-failed", message: content.errorMessage || "视频合并失败" },
				],
				errorMessage: content.errorMessage || "视频合并失败",
				resultElementId: undefined,
				resultConnectionId: undefined,
			})
			toast.error(content.errorMessage || "视频合并失败")
			return
		}
		if (content.status !== GenerationStatus.Completed || !content.src) return
		this.promoteResult(job, result)
	}

	private handleElementDeleted(elementId: string): void {
		const job = Array.from(this.jobs.values()).find(
			(candidate) =>
				candidate.resultElementId === elementId || candidate.elementId === elementId,
		)
		if (job && !job.cancelled && !job.finalized) this.cancel(job.elementId, false)
	}

	private promoteResult(job: CompositionJob, result: VideoElementData): void {
		job.finalized = true
		const resultId = job.resultElementId
		const next = updateContent(result, result.activeContentId ?? undefined, {
			status: GenerationStatus.Completed,
		})
		const promoted = this.canvas.historyManager.runTransaction(
			() => {
				this.canvas.elementManager.convertToPermament(
					resultId,
					{ contents: next.contents },
					{ silent: false },
				)
				return this.canvas.connectionManager.promoteRuntimeConnection(
					job.resultConnectionId,
				)
			},
			(value) => value,
		)
		if (!promoted) {
			this.cleanupJob(job)
			this.fail(job.elementId, "composition-failed", "合并结果转正失败")
			return
		}
		this.jobs.delete(job.elementId)
		this.updateSnapshot(job.elementId, {
			status: "completed",
			progress: 1,
			phase: undefined,
			resultElementId: resultId,
			resultConnectionId: job.resultConnectionId,
		})
	}

	private cleanupJob(job: CompositionJob): void {
		job.cancelled = true
		this.cleanupResult(job.resultElementId, job.resultConnectionId)
		if (this.jobs.get(job.elementId) === job) this.jobs.delete(job.elementId)
	}

	private cleanupResult(resultElementId: string, connectionId?: string): void {
		if (connectionId) {
			this.canvas.connectionManager.removeConnections([connectionId], { emitChange: false })
		}
		if (this.canvas.elementManager.hasElement(resultElementId)) {
			this.canvas.elementManager.delete(resultElementId)
		}
	}

	private async fail(
		elementId: string,
		code: VideoCompositionIssue["code"],
		message: string,
	): Promise<boolean> {
		this.updateSnapshot(elementId, {
			status: "error",
			progress: 0,
			phase: undefined,
			issues: [{ code, message }],
			errorMessage: message,
		})
		toast.error(message)
		return false
	}

	private updateSnapshot(elementId: string, updates: Partial<VideoCompositionSnapshot>): void {
		const next = { ...this.getSnapshot(elementId), ...updates }
		this.snapshots.set(elementId, next)
		this.listeners.get(elementId)?.forEach((listener) => listener(cloneSnapshot(next)))
	}

	private translate(key: string, fallback: string): string {
		return this.canvas.t?.(key, fallback) || fallback
	}
}
