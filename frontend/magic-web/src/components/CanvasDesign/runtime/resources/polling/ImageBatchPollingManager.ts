import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type ElementUpdatePatch,
	type ImageElement as ImageElementData,
	type ImageElementContent,
} from "../../document/types"
import type {
	GeneratedImageResultItem,
	GetImageGenerationResultsParams,
	ImageGenerationResultsResponse,
} from "../../../public/magic-types"
import { IMAGE_CONFIG } from "../../elements/image/ImageElement.config"
import type { ImageBatchPollingRegistry } from "./ImageBatchPollingRegistry"
import {
	extractSmartNameFromFileName,
	getGenerationResultStatusPatch,
	isGenerationTaskNotFoundError,
	shouldContinueGenerationPolling,
} from "./generationPollingUtils"
import { resolveCanvasGeneratedResourceStoragePath } from "../../shared/path/canvasResourcePath"
import { isBatchImageGenerationTaskMeta } from "../image/imageGenerationTaskMeta"
import {
	getContentById,
	getImageContents,
	isImageElementContent,
	updateImageContent,
} from "../../document/elementContent"
import { mergeMediaSourceReplacementFields } from "../../document/mediaSourceReplacement"

interface BatchElementUpdate {
	patch: ElementUpdatePatch
	resourcePath?: string
}

interface BuildImageContentUpdateOptions {
	contentId?: string
	extra?: ElementUpdatePatch
}

export interface ImageBatchPollingManagerConfig {
	canvas: Canvas
	imageId: string
	elementIds: string[]
	outputIndexes?: number[]
	/** 每个批量输出提交时捕获的目标 Content。 */
	contentIds?: string[]
	registry: ImageBatchPollingRegistry
}

export class ImageBatchPollingManager {
	private readonly canvas: Canvas
	private readonly imageId: string
	private elementIds: string[]
	private elementOutputIndexes: number[]
	private elementContentIds: Array<string | undefined>
	private outputIndexToElementId = new Map<number, string>()
	private outputIndexToContentId = new Map<number, string | undefined>()
	private readonly registry: ImageBatchPollingRegistry
	private readonly aliveElementIds: Set<string>
	private readonly syncedIndexes = new Set<number>()
	private isPolling = false
	private pollingTimer?: ReturnType<typeof setTimeout>
	private waitResolve?: () => void
	private unsubscribeElementDeleted?: () => void
	private unsubscribeBatchDeleted?: () => void

	constructor(config: ImageBatchPollingManagerConfig) {
		this.canvas = config.canvas
		this.imageId = config.imageId
		this.registry = config.registry
		this.elementIds = []
		this.elementOutputIndexes = []
		this.elementContentIds = []
		this.aliveElementIds = new Set()
		this.syncElementIds(config.elementIds, config.outputIndexes, config.contentIds)
	}

	/**
	 * 启动批量生成结果轮询
	 */
	public async start(): Promise<void> {
		if (this.isPolling) return
		this.isPolling = true
		this.registry.track(this)
		this.handleBindSubscriptions()

		try {
			while (this.isPolling) {
				const result = await this.getImageGenerationResults()
				if (!this.isPolling) return
				if (!result) {
					this.stop()
					return
				}

				this.applyBatchResult(result)
				if (!this.isPolling || !shouldContinueGenerationPolling(result.status)) {
					this.stop()
					return
				}

				await this.wait(IMAGE_CONFIG.POLLING_INTERVAL)
			}
		} catch (error) {
			if (isGenerationTaskNotFoundError(error, this.imageId)) {
				this.deleteMissingTaskElements()
			}
			// getImageGenerationResult 失败，停止轮询
			this.stop()
		} finally {
			this.registry.untrack(this)
			this.cleanupTimer()
			this.cleanupSubscriptions()
		}
	}

	private deleteMissingTaskElements(): void {
		const ownedElementIds = new Set<string>()
		this.elementIds.forEach((elementId, index) => {
			const outputIndex = this.elementOutputIndexes[index]
			const contentId = this.elementContentIds[index]
			if (!this.shouldSyncElement(elementId, outputIndex, contentId)) return

			const element = this.canvas.elementManager.getElementData(elementId)
			if (element?.type !== ElementTypeEnum.Image) return
			if (isImageElementContent(element) && contentId) {
				if (element.contents.length <= 1) {
					ownedElementIds.add(elementId)
					return
				}
				const next = updateImageContent(element, contentId, {
					status: "failed",
					errorMessage: undefined,
					imageGenerationTaskMeta: undefined,
				})
				if (isImageElementContent(next)) {
					this.canvas.elementManager.update(
						elementId,
						{ contents: next.contents },
						{ silent: false, historyPolicy: "exclude" },
					)
					this.canvas.eventEmitter.emit({
						type: "element:image:generate-submit-failed",
						data: { elementId },
					})
				}
				return
			}

			ownedElementIds.add(elementId)
		})
		if (ownedElementIds.size > 0) {
			this.canvas.elementManager.batchDelete([...ownedElementIds])
		}
	}

	/**
	 * 停止批量生成结果轮询
	 */
	public stop(): void {
		this.isPolling = false
		this.registry.untrack(this)
		this.cleanupTimer()
		this.cleanupSubscriptions()
	}

	public destroy(): void {
		this.stop()
	}

	public getImageId(): string {
		return this.imageId
	}

	public syncElementIds(
		elementIds: string[],
		outputIndexes?: number[],
		contentIds?: string[],
	): void {
		this.elementIds = elementIds
		this.elementOutputIndexes = outputIndexes ?? elementIds.map((_, index) => index + 1)
		this.elementContentIds = elementIds.map((elementId, index) => {
			const explicitContentId = contentIds?.[index]
			if (explicitContentId) return explicitContentId
			const element = this.canvas.elementManager.getElementData(elementId)
			return isImageElementContent(element)
				? (element.activeContentId ?? undefined)
				: undefined
		})
		this.outputIndexToElementId = new Map<number, string>()
		this.outputIndexToContentId = new Map<number, string | undefined>()
		this.aliveElementIds.clear()
		elementIds.forEach((elementId, index) => {
			if (!elementId) return
			const outputIndex = this.elementOutputIndexes[index]
			if (!Number.isFinite(outputIndex) || outputIndex < 1) return
			this.aliveElementIds.add(elementId)
			this.outputIndexToElementId.set(outputIndex, elementId)
			this.outputIndexToContentId.set(outputIndex, this.elementContentIds[index])
			this.syncedIndexes.delete(outputIndex)
		})
	}

	/**
	 * 获取图片生成结果
	 */
	private async getImageGenerationResults(): Promise<ImageGenerationResultsResponse | null> {
		const getImageGenerationResults =
			this.canvas.magicConfigManager.config?.methods?.getImageGenerationResults
		if (!getImageGenerationResults) {
			return null
		}

		const params: GetImageGenerationResultsParams = {
			project_id: "",
			image_id: this.imageId,
		}

		return (await getImageGenerationResults(params)) as ImageGenerationResultsResponse
	}

	/**
	 * 应用批量生成结果
	 */
	private applyBatchResult(result: ImageGenerationResultsResponse) {
		for (const image of result.images ?? []) {
			const outputIndex = Number(image.index)
			if (
				!Number.isFinite(outputIndex) ||
				outputIndex < 1 ||
				!this.outputIndexToElementId.has(outputIndex)
			) {
				continue
			}
			if (this.syncedIndexes.has(outputIndex)) continue

			const elementId = this.outputIndexToElementId.get(outputIndex)
			if (!elementId) continue
			const contentId = this.outputIndexToContentId.get(outputIndex)
			if (!this.shouldSyncElement(elementId, outputIndex, contentId)) continue
			const element = this.canvas.elementManager.getElementData(elementId)
			if (element?.type !== ElementTypeEnum.Image) continue
			const updateData = this.buildCompletedElementUpdate(element, result, image, contentId)
			// 更新元素数据
			this.canvas.elementManager.update(elementId, updateData.patch, {
				silent: false,
				historyPolicy: "exclude",
			})
			if (updateData.resourcePath && image.file_url) {
				this.canvas.imageResourceManager.loadResource(updateData.resourcePath, {
					variant: "preview",
					priority: "critical",
				})
			}
			// 发出图片结果更新事件
			this.canvas.eventEmitter.emit({
				type: "element:image:resultUpdated",
				data: { elementId },
			})
			// 添加已同步索引
			this.syncedIndexes.add(outputIndex)
		}

		if (result.status === "failed") {
			this.elementIds.forEach((elementId, index) => {
				const outputIndex = this.elementOutputIndexes[index]
				const contentId = this.elementContentIds[index]
				if (this.syncedIndexes.has(outputIndex)) return
				if (!this.shouldSyncElement(elementId, outputIndex, contentId)) return
				const element = this.canvas.elementManager.getElementData(elementId)
				if (element?.type !== ElementTypeEnum.Image) return
				this.canvas.elementManager.update(
					elementId,
					this.buildImageContentUpdate(
						element,
						{
							status: "failed",
							errorMessage: result.error_message ?? undefined,
							imageGenerationTaskMeta: undefined,
						},
						{ contentId },
					),
					{ silent: false, historyPolicy: "exclude" },
				)
				this.canvas.eventEmitter.emit({
					type: "element:image:generate-submit-failed",
					data: { elementId },
				})
			})
			return
		}

		if (result.status === "completed") {
			const missingResourcePatch = getGenerationResultStatusPatch(
				"completed",
				result.error_message,
				false,
			)
			this.elementIds.forEach((elementId, index) => {
				const outputIndex = this.elementOutputIndexes[index]
				const contentId = this.elementContentIds[index]
				if (this.syncedIndexes.has(outputIndex)) return
				if (!this.shouldSyncElement(elementId, outputIndex, contentId)) return
				const element = this.canvas.elementManager.getElementData(elementId)
				if (element?.type !== ElementTypeEnum.Image) return
				this.canvas.elementManager.update(
					elementId,
					this.buildImageContentUpdate(
						element,
						{
							...missingResourcePatch,
							imageGenerationTaskMeta: undefined,
						},
						{ contentId },
					),
					{ silent: false, historyPolicy: "exclude" },
				)
			})
		}
	}

	/**
	 * 构建完成元素更新数据
	 */
	private buildCompletedElementUpdate(
		element: ImageElementData,
		result: ImageGenerationResultsResponse,
		image: GeneratedImageResultItem,
		contentId?: string,
	): BatchElementUpdate {
		const storagePath =
			result.file_dir && image.file_name
				? resolveCanvasGeneratedResourceStoragePath(
						this.canvas,
						result.file_dir,
						image.file_name,
					)
				: undefined
		if (!storagePath || !image.file_name) {
			return {
				patch: this.buildImageContentUpdate(
					element,
					{
						...getGenerationResultStatusPatch("completed", result.error_message, false),
						imageGenerationTaskMeta: undefined,
					},
					{ contentId },
				),
			}
		}

		this.primeGeneratedImageResource(storagePath, image.file_url, image.file_name)
		return {
			patch: this.buildImageContentUpdate(
				element,
				{
					status: "completed",
					errorMessage: undefined,
					imageGenerationTaskMeta: undefined,
					src: storagePath,
				},
				{
					contentId,
					extra: { name: extractSmartNameFromFileName(image.file_name) },
				},
			),
			resourcePath: storagePath,
		}
	}

	private buildImageContentUpdate(
		element: ImageElementData,
		patch: Partial<ImageElementContent>,
		options?: BuildImageContentUpdateOptions,
	): ElementUpdatePatch {
		const extra = options?.extra
		const contentId = options?.contentId ?? element.activeContentId ?? undefined
		if (!isImageElementContent(element) || !contentId) return extra ?? {}
		const currentContent = getContentById(element, contentId)
		const normalizedPatch = currentContent
			? mergeMediaSourceReplacementFields(currentContent, patch)
			: patch
		const next = updateImageContent(element, contentId, normalizedPatch)
		if (!isImageElementContent(next)) return extra ?? {}
		return { ...extra, contents: next.contents }
	}

	private primeGeneratedImageResource(
		path: string,
		fileUrl: string | null | undefined,
		fileName: string,
	): void {
		if (!fileUrl) return

		this.canvas.imageResourceManager.primeCache(path, {
			src: fileUrl,
			fileName,
		})
	}

	/**
	 * 等待指定时间
	 */
	private wait(ms: number) {
		return new Promise<void>((resolve) => {
			this.waitResolve = () => {
				this.waitResolve = undefined
				resolve()
			}
			this.pollingTimer = setTimeout(() => {
				this.pollingTimer = undefined
				this.waitResolve?.()
			}, ms)
		})
	}

	private shouldSyncElement(elementId: string, outputIndex: number, contentId?: string): boolean {
		if (!this.aliveElementIds.has(elementId)) return false
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (elementData?.type !== ElementTypeEnum.Image) return false

		if (!contentId || !isImageElementContent(elementData)) return false
		const taskMeta = getImageContents(elementData).find(
			(content) => content.contentId === contentId,
		)?.imageGenerationTaskMeta
		return (
			isBatchImageGenerationTaskMeta(taskMeta) &&
			taskMeta.image_id === this.imageId &&
			taskMeta.output_index === outputIndex
		)
	}

	private handleDeletedElementIds(elementIds: string[]) {
		let hasChanges = false
		elementIds.forEach((elementId) => {
			if (this.aliveElementIds.delete(elementId)) {
				hasChanges = true
			}
		})
		if (hasChanges && this.aliveElementIds.size === 0) {
			this.stop()
		}
	}

	private handleBindSubscriptions() {
		this.unsubscribeElementDeleted = this.canvas.eventEmitter.on("element:deleted", (event) => {
			this.handleDeletedElementIds([event.data.elementId])
		})
		this.unsubscribeBatchDeleted = this.canvas.eventEmitter.on(
			"element:batchdeleted",
			(event) => {
				this.handleDeletedElementIds(event.data.elementIds)
			},
		)
	}

	private cleanupTimer() {
		if (this.pollingTimer) {
			clearTimeout(this.pollingTimer)
			this.pollingTimer = undefined
		}
		this.waitResolve?.()
	}

	private cleanupSubscriptions() {
		this.unsubscribeElementDeleted?.()
		this.unsubscribeElementDeleted = undefined
		this.unsubscribeBatchDeleted?.()
		this.unsubscribeBatchDeleted = undefined
	}
}
