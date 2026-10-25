import { toast } from "sonner"
import type { VideoModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import { getMainContent } from "../../document/elementContent"
import { ElementTypeEnum, type VideoElementContent } from "../../document/types"
import { VideoElement } from "../../elements/video/VideoElement"
import { extractVideoTailFrame } from "../../resources/video/VideoFrameExtractor"
import { getCanvasResourceFileName } from "../../shared/path/canvasResourcePath"
import { buildMediaEditSourceFingerprint } from "../../interaction/media-edit-recovery/MediaEditRecoveryManager"
import {
	persistVideoEditorDraft,
	type VideoEditorDraftSnapshot,
} from "../media-edit-recovery/videoEditorDraftPersistence"
import {
	collectConnectionCreateObstacleRects,
	resolveConnectionCreateGapForElement,
} from "../../shared/placement/connectionCreatePlacement"
import { resolveConnectedPlacement } from "../../shared/placement/placementEngine"
import {
	resolveVideoContinuationModel,
	type ResolvedVideoContinuationModel,
} from "./videoContinuationModel"

const MAX_PREPARATION_CONCURRENCY = 2

interface ContinuationSource {
	elementId: string
	mainContentId: string | null
	mainPath: string
	fileName: string
}

interface PreparedContinuation {
	source: ContinuationSource
	uploadedPath: string
}

interface CreatedContinuationNode {
	sourceId: string
	elementId: string
}

export interface VideoContinuationRequest {
	sourceVideoIds: string[]
	videoModelList: VideoModelItem[]
}

export interface VideoContinuationResult {
	createdElementIds: string[]
	failedSourceIds: string[]
	skippedSourceIds: string[]
}

function uniqueIds(ids: readonly string[]): string[] {
	return Array.from(new Set(ids))
}

function withoutExtension(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, "") || "video"
}

function runWithConcurrency<T, TResult>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
	const results = new Array<TResult>(items.length)
	let nextIndex = 0

	const runWorker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++
			if (index >= items.length) return
			results[index] = await worker(items[index])
		}
	}

	return Promise.all(
		Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, runWorker),
	).then(() => results)
}

/**
 * 负责“尾帧资源准备 + 空视频节点创建”的异步边界。
 * 资源阶段不触碰文档，只有准备完成后才进入一个同步历史事务。
 */
export class VideoContinuationManager {
	private readonly pendingSourceIds = new Set<string>()
	private readonly abortControllers = new Set<AbortController>()
	private readonly unsubscribeEvents: Array<() => void>
	private destroyed = false

	constructor(private readonly canvas: Canvas) {
		this.unsubscribeEvents = [
			canvas.eventEmitter.on("canvas:clear", () => this.cancelAll()),
			canvas.eventEmitter.on("document:loaded", () => this.cancelAll()),
			canvas.eventEmitter.on("document:restored", () => this.cancelAll()),
		]
	}

	public async continueVideos(
		request: VideoContinuationRequest,
	): Promise<VideoContinuationResult> {
		if (this.destroyed) return this.emptyResult()
		const model = resolveVideoContinuationModel(this.canvas, request.videoModelList)
		if (!model) return this.emptyResult()

		const candidates = this.collectSources(request.sourceVideoIds)
		const sources = candidates.filter((source) => {
			if (this.pendingSourceIds.has(source.elementId)) return false
			this.pendingSourceIds.add(source.elementId)
			return true
		})
		if (sources.length === 0) return this.emptyResult()

		const controller = new AbortController()
		this.abortControllers.add(controller)
		const isBatch = sources.length > 1
		const loadingToastId = toast.loading(
			this.translate("videoContinuation.processing", "正在创建续写视频，请稍后"),
		)
		let toastFinalized = false

		try {
			const preparedResults = await runWithConcurrency(
				sources,
				MAX_PREPARATION_CONCURRENCY,
				(source) => this.prepareSource(source, controller.signal),
			)
			if (this.destroyed || controller.signal.aborted) {
				toast.dismiss(loadingToastId)
				toastFinalized = true
				return this.emptyResult()
			}

			const prepared = preparedResults.filter(
				(result): result is PreparedContinuation => result !== null,
			)
			const failedSourceIds = preparedResults
				.map((result, index) => (result ? null : sources[index].elementId))
				.filter((id): id is string => id !== null)
			const skippedSourceIds: string[] = []
			const createdElementIds =
				prepared.length > 0
					? this.createPreparedVideos(prepared, model, skippedSourceIds)
					: []

			const failedCount = failedSourceIds.length + skippedSourceIds.length
			if (createdElementIds.length > 0) {
				this.selectAndFocus(createdElementIds)
				if (failedCount > 0) {
					toast.warning(
						this.translate(
							"videoContinuation.partialSuccess",
							"已创建 {{created}} 个，{{failed}} 个失败",
						)
							.replace("{{created}}", String(createdElementIds.length))
							.replace("{{failed}}", String(failedCount)),
						{ id: loadingToastId },
					)
					toastFinalized = true
				} else {
					toast.success(
						this.translate(
							isBatch
								? "videoContinuation.batchSuccess"
								: "videoContinuation.success",
							isBatch ? "批量续写完成" : "续写视频已创建",
						),
						{ id: loadingToastId },
					)
					toastFinalized = true
				}
			} else {
				toast.error(this.translate("videoContinuation.failed", "续写视频失败，请重试"), {
					id: loadingToastId,
				})
				toastFinalized = true
			}

			return { createdElementIds, failedSourceIds, skippedSourceIds }
		} finally {
			if (!toastFinalized) toast.dismiss(loadingToastId)
			this.abortControllers.delete(controller)
			sources.forEach((source) => this.pendingSourceIds.delete(source.elementId))
		}
	}

	public destroy(): void {
		this.destroyed = true
		this.cancelAll()
		this.unsubscribeEvents.forEach((unsubscribe) => unsubscribe())
	}

	private cancelAll(): void {
		this.abortControllers.forEach((controller) => controller.abort())
		this.abortControllers.clear()
		this.pendingSourceIds.clear()
	}

	private collectSources(elementIds: readonly string[]): ContinuationSource[] {
		const sources: ContinuationSource[] = []
		for (const elementId of uniqueIds(elementIds)) {
			const element = this.canvas.elementManager.getElementData(elementId)
			if (!element || element.type !== ElementTypeEnum.Video) continue
			const mainContent = getMainContent<VideoElementContent>(element)
			if (
				!mainContent ||
				typeof mainContent.src !== "string" ||
				!mainContent.src ||
				(mainContent.status !== undefined && mainContent.status !== "completed")
			) {
				continue
			}
			sources.push({
				elementId,
				mainContentId: mainContent.contentId ?? null,
				mainPath: mainContent.src,
				fileName: getCanvasResourceFileName(mainContent.src) || elementId,
			})
		}
		return sources
	}

	private async prepareSource(
		source: ContinuationSource,
		signal: AbortSignal,
	): Promise<PreparedContinuation | null> {
		try {
			if (signal.aborted) return null
			const ossSrc = await this.canvas.videoResourceManager.ensureFreshOssSrc(
				source.mainPath,
				{
					priority: "critical",
					signal,
				},
			)
			if (!ossSrc || signal.aborted) return null

			const frame = await extractVideoTailFrame(ossSrc, { signal })
			if (!frame || signal.aborted) return null

			const file = new File(
				[frame.blob],
				`${withoutExtension(source.fileName)}-tail-frame.jpg`,
				{ type: "image/jpeg" },
			)
			const [uploadResult] = await this.canvas.canvasFileUploadManager.uploadDirect([file])
			if (!uploadResult?.path || signal.aborted) return null
			return { source, uploadedPath: uploadResult.path }
		} catch {
			return null
		}
	}

	private createPreparedVideos(
		prepared: PreparedContinuation[],
		model: ResolvedVideoContinuationModel,
		skippedSourceIds: string[],
	): string[] {
		const videoTool = this.canvas.toolManager.getVideoGeneratorTool()
		const size = videoTool.getVideoElementSizeForModelList([model.model])
		const createdElementIds = this.canvas.historyManager.runTransaction(
			() => {
				const createdNodes: CreatedContinuationNode[] = []
				const obstacles = collectConnectionCreateObstacleRects(this.canvas)
				const markSkipped = (sourceId: string) => {
					if (!skippedSourceIds.includes(sourceId)) skippedSourceIds.push(sourceId)
				}
				const rollbackCreatedNodes = () => {
					createdNodes.forEach((node) => {
						if (this.canvas.elementManager.hasElement(node.elementId)) {
							this.canvas.elementManager.delete(node.elementId)
						}
						markSkipped(node.sourceId)
					})
				}
				for (const item of prepared) {
					if (!this.canvas.elementManager.hasElement(item.source.elementId)) {
						markSkipped(item.source.elementId)
						continue
					}
					const sourceData = this.canvas.elementManager.getElementData(
						item.source.elementId,
					)
					const sourceRect = this.canvas.geometryCacheManager.getElementBounds(
						item.source.elementId,
					)
					if (!sourceData || !sourceRect) {
						markSkipped(item.source.elementId)
						continue
					}

					let createdElementId: string | null = null
					try {
						const point = resolveConnectedPlacement(
							this.canvas,
							{
								originSide: "right",
								source: "handle",
								canvasX: sourceRect.x + sourceRect.width,
								canvasY: sourceRect.y + sourceRect.height / 2,
							},
							size,
							{
								output: "center",
								originElementId: item.source.elementId,
								originRect: sourceRect,
								gap: resolveConnectionCreateGapForElement(sourceData, "right"),
								obstacleRects: obstacles,
							},
						)
						createdElementId = videoTool.createVideoAtCanvasPoint(
							point.x,
							point.y,
							[model.model],
							{ select: false, ensureInViewport: false, completeTask: false },
						)
						const instance =
							this.canvas.elementManager.getElementInstance(createdElementId)
						if (!(instance instanceof VideoElement)) {
							this.canvas.elementManager.delete(createdElementId)
							markSkipped(item.source.elementId)
							continue
						}
						const createdData =
							this.canvas.elementManager.getElementData?.(createdElementId)
						if (createdData?.type !== ElementTypeEnum.Video) {
							this.canvas.elementManager.delete(createdElementId)
							markSkipped(item.source.elementId)
							continue
						}
						const activeContent = getMainContent<VideoElementContent>(createdData)
						if (!activeContent) {
							this.canvas.elementManager.delete(createdElementId)
							markSkipped(item.source.elementId)
							continue
						}
						const frameFileName = `${withoutExtension(item.source.fileName)}-tail-frame.jpg`
						const editorDraftSnapshot = {
							request: {
								model_id: model.model.model_id,
								input_mode: model.inputMode,
								task: model.task,
								inputs: {
									frames: [{ role: "start", uri: item.uploadedPath }],
								},
							},
							modeDrafts: {
								[model.inputMode]: {
									activeInputTab: "frame",
									frameImageInfos: [
										{
											path: item.uploadedPath,
											src: item.uploadedPath,
											fileName: frameFileName,
										},
									],
									linkedFrameBindings: [],
									referenceAssetInfos: [],
								},
							},
						} satisfies VideoEditorDraftSnapshot
						persistVideoEditorDraft({
							canvas: this.canvas,
							elementId: createdElementId,
							contentId: activeContent.contentId,
							snapshot: editorDraftSnapshot,
							includeInHistory: true,
						})
						this.canvas.mediaEditRecoveryManager?.saveDraft(
							{
								elementId: createdElementId,
								contentId: activeContent.contentId,
								intent: "generate",
							},
							buildMediaEditSourceFingerprint(
								activeContent.contentId,
								activeContent.src,
							),
							{
								request: editorDraftSnapshot.request,
								modeDrafts: editorDraftSnapshot.modeDrafts,
							},
						)
						createdNodes.push({
							sourceId: item.source.elementId,
							elementId: createdElementId,
						})
						obstacles.push({
							x: point.x - size.width / 2,
							y: point.y - size.height / 2,
							width: size.width,
							height: size.height,
						})
					} catch {
						if (
							createdElementId &&
							this.canvas.elementManager.hasElement(createdElementId)
						) {
							this.canvas.elementManager.delete(createdElementId)
						}
						markSkipped(item.source.elementId)
					}
				}

				if (createdNodes.length === 0) return []

				try {
					const connection = this.canvas.connectionManager.connectElementsBatch({
						edges: createdNodes.map((node) => ({
							sourceElementId: node.sourceId,
							targetElementId: node.elementId,
						})),
					})
					if (connection.status !== "created") {
						rollbackCreatedNodes()
						return []
					}
				} catch {
					rollbackCreatedNodes()
					return []
				}

				return createdNodes.map((node) => node.elementId)
			},
			(ids) => ids.length > 0,
		)
		return createdElementIds
	}

	private selectAndFocus(elementIds: string[]): void {
		this.canvas.toolManager.switchToSelection()
		if (elementIds.length === 1) this.canvas.selectionManager.select(elementIds[0])
		else this.canvas.selectionManager.selectMultiple(elementIds)
		requestAnimationFrame(() => {
			if (!elementIds.every((elementId) => this.canvas.elementManager.hasElement(elementId)))
				return
			if (this.canvas.viewportController.isElementInViewport(elementIds)) return
			this.canvas.viewportController.moveElementToViewport(elementIds, {
				animated: true,
				padding: { top: 50, right: 50, bottom: 50, left: 100 },
			})
		})
	}

	private translate(key: string, fallback: string): string {
		return this.canvas.t?.(key, fallback) || fallback
	}

	private emptyResult(): VideoContinuationResult {
		return { createdElementIds: [], failedSourceIds: [], skippedSourceIds: [] }
	}
}
