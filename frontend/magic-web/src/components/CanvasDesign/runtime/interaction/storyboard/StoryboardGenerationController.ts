import { toast } from "sonner"
import type { GenerateImageRequest, ImageModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type FrameElement,
	type ImageElement as ImageElementData,
	type StoryboardElement,
	type StoryboardElementContent,
	type StoryboardGenerationConfig,
	type StoryboardShot,
} from "../../document/types"
import { createContentId, getActiveContent, updateContent } from "../../document/elementContent"
import { BASE_ELEMENT_DATA_DEFAULTS } from "../../elements/core/BaseElement"
import { ImageElement } from "../../elements/image/ImageElement"
import { IMAGE_CONFIG } from "../../elements/image/ImageElement.config"
import { buildReferenceImageOptions } from "../../resources/image/imageCropUtils"
import {
	resolveStoryboardReferenceImages,
	type StoryboardReferenceImage,
} from "./storyboardReferenceImages"
import {
	createContentFrameData,
	getVerticalFrameContentHeight,
	getVerticalFrameContentOffset,
	resolveFrameContentLayout,
} from "../frame/frameCreation"
import {
	buildDefaultImageGenerationConfig,
	getDefaultResolutionForModel,
	getImageGenerationSettings,
	normalizeImageSizeValue,
	resolveImageSizeOptionFromRequest,
} from "../../shared/imageGenerationConfig"
import { generateElementId } from "../../shared/ids"
import { resolveConnectionCreateGapForElement } from "../../shared/placement/connectionCreateGap"
import { resolveConnectedPlacement } from "../../shared/placement/placementEngine"

const STORYBOARD_OUTPUT_FRAME_NAME = "分镜图片组合"

interface OutputLayout {
	width: number
	heights: number[]
}

interface EnsureOutputsResult {
	imageElementIds: string[]
	frameId?: string
}

interface StoryboardGenerationContext {
	model: ImageModelItem | undefined
	modelId: string
	references: StoryboardReferenceImage[]
}

/**
 * 分镜批量生成控制器。
 *
 * Frame 只承担视觉容器职责，镜头与输出图片的映射保存在 shot 上；
 * 这样解除 Frame 后仍能复用已有图片，删除 Frame 后也能按缺失映射重建。
 */
export class StoryboardGenerationController {
	private readonly activeShotIds = new Map<string, Set<string>>()

	constructor(
		private readonly canvas: Canvas,
		private readonly loadImageModels?: () => Promise<ImageModelItem[]>,
	) {}

	public async generateAll(elementId: string): Promise<void> {
		const storyboard = this.getStoryboard(elementId)
		if (!storyboard) return
		const storyboardContent = getActiveContent<StoryboardElementContent>(storyboard)
		if (!storyboardContent) return

		const shots = storyboardContent.shots ?? []
		const shotIndexes = shots.map((_shot, index) => index)
		if (shots.length === 0 || this.hasAnyActiveShot(elementId, shots)) {
			if (shots.length === 0) {
				toast.error(
					this.canvas.t?.("storyboard.empty", "暂无可生成的分镜") ?? "暂无可生成的分镜",
				)
			}
			return
		}

		this.markShotsActive(elementId, shots)
		try {
			const context = await this.resolveGenerationContext(
				elementId,
				storyboardContent,
				shots,
				shotIndexes,
			)
			if (!context) return
			await this.submitShots(storyboard, storyboardContent, shots, shotIndexes, context)
		} finally {
			this.unmarkShotsActive(elementId, shots)
		}
	}

	public async generateShot(elementId: string, shotId: string): Promise<void> {
		const storyboard = this.getStoryboard(elementId)
		if (!storyboard) return
		const storyboardContent = getActiveContent<StoryboardElementContent>(storyboard)
		const shots = storyboardContent?.shots ?? []
		const shotIndex = shots.findIndex((shot) => shot.id === shotId)
		if (!storyboardContent || shotIndex < 0 || this.isShotGenerating(elementId, shotId)) return

		const shot = shots[shotIndex]
		this.markShotsActive(elementId, [shot])
		try {
			const context = await this.resolveGenerationContext(
				elementId,
				storyboardContent,
				shots,
				[shotIndex],
			)
			if (!context) return
			await this.submitShots(storyboard, storyboardContent, shots, [shotIndex], context)
		} finally {
			this.unmarkShotsActive(elementId, [shot])
		}
	}

	public isShotGenerating(elementId: string, shotId: string): boolean {
		return this.activeShotIds.get(elementId)?.has(shotId) ?? false
	}

	public isAnyGenerating(elementId: string): boolean {
		return (this.activeShotIds.get(elementId)?.size ?? 0) > 0
	}

	public destroy(): void {
		this.activeShotIds.clear()
	}

	private async resolveGenerationContext(
		elementId: string,
		storyboardContent: StoryboardElementContent,
		shots: StoryboardShot[],
		shotIndexes: number[],
	): Promise<StoryboardGenerationContext | null> {
		const emptyShotIndex = shotIndexes.find((index) => !shots[index]?.description.trim())
		if (emptyShotIndex !== undefined) {
			const message =
				this.canvas.t?.(
					"storyboard.emptyDescription",
					"请先填写分镜 {{index}} 的画面描述",
				) ?? "请先填写分镜 {{index}} 的画面描述"
			toast.error(message.replace("{{index}}", String(emptyShotIndex + 1)))
			return null
		}

		const models = await this.getImageModels()
		const model = this.resolveModel(storyboardContent.generationConfig, models)
		const modelId = model?.model_id
		if (!modelId) {
			toast.error(
				this.canvas.t?.("storyboard.modelUnavailable", "当前没有可用的图片模型") ??
					"当前没有可用的图片模型",
			)
			return null
		}

		const references = this.collectReferenceImages(elementId)
		const maxReferences = model?.image_size_config?.max_reference_images
		if (maxReferences !== undefined && references.length > maxReferences) {
			const message =
				this.canvas.t?.(
					"storyboard.referenceLimit",
					"当前模型最多支持 {{count}} 张参考图，请减少左侧连接图片",
				) ?? "当前模型最多支持 {{count}} 张参考图，请减少左侧连接图片"
			toast.error(message.replace("{{count}}", String(maxReferences)))
			return null
		}

		return { model, modelId, references }
	}

	private async submitShots(
		storyboard: StoryboardElement,
		storyboardContent: StoryboardElementContent,
		shots: StoryboardShot[],
		shotIndexes: number[],
		context: StoryboardGenerationContext,
	): Promise<void> {
		await this.canvas.historyManager.runAsyncTransaction(async () => {
			const outputs = this.ensureOutputStructure(
				storyboard,
				storyboardContent,
				shots,
				shotIndexes,
				{ deferHistory: true },
			)
			const requests = shotIndexes.map((index) =>
				this.buildRequest(
					shots[index],
					storyboardContent.generationConfig,
					context.modelId,
					context.model,
					context.references,
				),
			)

			await Promise.allSettled(
				outputs.imageElementIds.map(async (imageElementId, index) => {
					const imageElement =
						this.canvas.elementManager.getElementInstance(imageElementId)
					if (!(imageElement instanceof ImageElement)) return false
					return imageElement.submitGeneration(requests[index])
				}),
			)

			this.canvas.contentLayer.batchDraw()
		})
	}

	private getStoryboard(elementId: string): StoryboardElement | undefined {
		const element = this.canvas.elementManager.getElementData(elementId)
		return element?.type === ElementTypeEnum.Storyboard ? element : undefined
	}

	private async getImageModels(): Promise<ImageModelItem[]> {
		if (this.loadImageModels) return this.loadImageModels()
		const getImageModelList = this.canvas.magicConfigManager.config?.methods?.getImageModelList
		if (!getImageModelList) return []
		try {
			return (await getImageModelList()).filter(
				(model) => model.model_status === "normal" && Boolean(model.model_id),
			)
		} catch {
			return []
		}
	}

	private resolveModel(
		config: StoryboardGenerationConfig | undefined,
		models: ImageModelItem[],
	): ImageModelItem | undefined {
		return models.find((model) => model.model_id === config?.model_id) ?? models[0]
	}

	private collectReferenceImages(targetElementId: string): StoryboardReferenceImage[] {
		return resolveStoryboardReferenceImages(this.canvas, targetElementId)
	}

	private buildRequest(
		shot: StoryboardShot,
		config: StoryboardGenerationConfig | undefined,
		modelId: string,
		model: ImageModelItem | undefined,
		references: StoryboardReferenceImage[],
	): GenerateImageRequest {
		const configuredSize = normalizeImageSizeValue(config?.size)
		const defaultResolution = getDefaultResolutionForModel(model, config?.resolution)
		const sizeSelection = resolveImageSizeOptionFromRequest({
			sizes: model?.image_size_config?.sizes ?? [],
			request: config ? { ...config, size: configuredSize } : undefined,
			preferredResolution: defaultResolution,
			currentLabel: config?.image_generation_config?.aspect_ratio,
		})
		const imageGenerationConfig = {
			...buildDefaultImageGenerationConfig(getImageGenerationSettings(model)),
			...(config?.image_generation_config ?? {}),
		}
		if (sizeSelection?.size.label && !imageGenerationConfig.aspect_ratio) {
			imageGenerationConfig.aspect_ratio = sizeSelection.size.label
		}
		const hasImageGenerationConfig = Object.keys(imageGenerationConfig).length > 0
		const referenceImageOptions = references.flatMap(
			(reference) =>
				buildReferenceImageOptions({ filePath: reference.path, crop: reference.crop }) ??
				[],
		)
		return {
			model_id: modelId,
			prompt: shot.description.trim(),
			...(configuredSize || sizeSelection?.size.value
				? { size: configuredSize ?? sizeSelection?.size.value }
				: {}),
			...(config?.resolution || sizeSelection?.resolution || defaultResolution
				? {
						resolution:
							config?.resolution ?? sizeSelection?.resolution ?? defaultResolution,
					}
				: {}),
			...(hasImageGenerationConfig ? { image_generation_config: imageGenerationConfig } : {}),
			...(references.length > 0
				? {
						reference_images: references.map((reference) => reference.path),
						...(referenceImageOptions.length > 0
							? { reference_image_options: referenceImageOptions }
							: {}),
					}
				: {}),
		}
	}

	private ensureOutputStructure(
		storyboard: StoryboardElement,
		storyboardContent: StoryboardElementContent,
		shots: StoryboardShot[],
		requestedShotIndexes = shots.map((_shot, index) => index),
		options: { deferHistory?: boolean } = {},
	): EnsureOutputsResult {
		const requestedShotIndexSet = new Set(requestedShotIndexes)
		const resolvedImageIds = shots.map((shot) =>
			shot.outputImageElementId &&
			this.canvas.elementManager.getElementData(shot.outputImageElementId)?.type ===
				ElementTypeEnum.Image
				? shot.outputImageElementId
				: undefined,
		)
		const existingOutputIds = resolvedImageIds.filter((id): id is string => Boolean(id))
		const existingFrame = this.findOutputFrame(existingOutputIds)
		const layout = this.resolveOutputLayout(storyboardContent.generationConfig, shots.length)
		const frameLayout = this.resolveFrameLayout(layout.width, layout.heights)
		const frameOrigin = this.resolveOutputFrameOrigin(storyboard, frameLayout)
		const missingIndexes = resolvedImageIds.flatMap((id, index) =>
			!id && requestedShotIndexSet.has(index) ? [index] : [],
		)
		const needsConnectionMutation = existingOutputIds.some(
			(imageId) =>
				!this.canvas.connectionManager
					.getDownstreamConnections(storyboard.id)
					.some((connection) => connection.targetElementId === imageId),
		)
		const needsMutation = missingIndexes.length > 0 || needsConnectionMutation
		const history = this.canvas.historyManager
		const shouldRecordStructureHistory = needsMutation && !options.deferHistory
		if (shouldRecordStructureHistory) history?.disable()

		try {
			if (!existingFrame && existingOutputIds.length === 0) {
				const requestedHeights = requestedShotIndexes.map(
					(index) =>
						layout.heights[index] ?? layout.heights[0] ?? IMAGE_CONFIG.DEFAULT_HEIGHT,
				)
				const requestedFrameLayout = this.resolveFrameLayout(layout.width, requestedHeights)
				const requestedFrameOrigin = this.resolveOutputFrameOrigin(
					storyboard,
					requestedFrameLayout,
				)
				const imageChildren = requestedShotIndexes.map((shotIndex) =>
					this.createImageData(
						generateElementId(),
						storyboard.x ?? 0,
						storyboard.y ?? 0,
						layout.width,
						layout.heights[shotIndex] ?? IMAGE_CONFIG.DEFAULT_HEIGHT,
						shotIndex,
					),
				)
				imageChildren.forEach((child, childIndex) => {
					resolvedImageIds[requestedShotIndexes[childIndex]] = child.id
				})
				const frameId = generateElementId()
				const frameChildren = imageChildren.map((child, index) => ({
					...child,
					x: requestedFrameLayout.padding,
					y:
						requestedFrameLayout.padding +
						getVerticalFrameContentOffset(requestedHeights, index),
					zIndex: imageChildren.length - index,
				}))
				const { frameData } = createContentFrameData({
					id: frameId,
					x: requestedFrameOrigin.x,
					y: requestedFrameOrigin.y,
					width: layout.width,
					height: getVerticalFrameContentHeight(requestedHeights),
					zIndex: this.canvas.elementManager.getNextZIndexInLevel(),
					name: STORYBOARD_OUTPUT_FRAME_NAME,
					children: frameChildren,
					padding: requestedFrameLayout.padding,
				})
				this.canvas.elementManager.create(frameData, { silent: true })
				const imageElementIds = requestedShotIndexes.flatMap((index) =>
					resolvedImageIds[index] ? [resolvedImageIds[index] as string] : [],
				)
				this.ensureConnections(
					storyboard.id,
					resolvedImageIds.filter((id): id is string => Boolean(id)),
				)
				this.commitShotOutputIds(storyboard, storyboardContent, shots, resolvedImageIds)
				return { imageElementIds, frameId }
			}

			const missingImageData = missingIndexes.map((shotIndex) => {
				const targetFrameOrigin = existingFrame
					? {
							x: existingFrame.x ?? 0,
							y: existingFrame.y ?? 0,
						}
					: {
							x: frameOrigin.x,
							y: frameOrigin.y,
						}
				const data = this.createImageData(
					generateElementId(),
					targetFrameOrigin.x + frameLayout.padding,
					targetFrameOrigin.y +
						frameLayout.padding +
						getVerticalFrameContentOffset(layout.heights, shotIndex),
					layout.width,
					layout.heights[shotIndex],
					shotIndex,
				)
				resolvedImageIds[shotIndex] = data.id
				return data
			})
			missingImageData.forEach((data) =>
				this.canvas.elementManager.create(data, { silent: true }),
			)
			const imageElementIds = resolvedImageIds.filter((id): id is string => Boolean(id))
			if (existingFrame && missingImageData.length > 0) {
				missingImageData.forEach((data) => {
					this.canvas.elementManager.reparentElements({
						targetParentId: existingFrame.id,
						elements: [
							{
								elementId: data.id,
								positionInContent: { x: data.x ?? 0, y: data.y ?? 0 },
							},
						],
						silent: true,
					})
				})

				this.layoutFrameChildren(existingFrame.id, resolvedImageIds, layout, shots.length)
			}
			this.ensureConnections(storyboard.id, imageElementIds)
			this.commitShotOutputIds(storyboard, storyboardContent, shots, resolvedImageIds)
			return {
				imageElementIds: requestedShotIndexes.flatMap((index) =>
					resolvedImageIds[index] ? [resolvedImageIds[index] as string] : [],
				),
				frameId: existingFrame?.id,
			}
		} finally {
			if (shouldRecordStructureHistory) {
				history?.enable()
				history?.recordHistoryImmediate()
			}
		}
	}

	private createImageData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		index: number,
	): ImageElementData {
		// Content ID 使用统一的 content-<uuid> 命名；类型语义由 Element/Content 结构表达。
		const contentId = createContentId()
		return {
			...BASE_ELEMENT_DATA_DEFAULTS,
			id,
			type: ElementTypeEnum.Image,
			x,
			y,
			width,
			height,
			zIndex: this.canvas.elementManager.getNextZIndexInLevel() + index,
			contents: [{ contentId }],
			activeContentId: contentId,
			mainContentId: contentId,
		}
	}

	private resolveOutputFrameOrigin(
		storyboard: StoryboardElement,
		frameLayout: { width: number; height: number },
	): { x: number; y: number } {
		const originRect = this.canvas.geometryCacheManager?.getElementBounds(storyboard.id) ?? {
			x: storyboard.x ?? 0,
			y: storyboard.y ?? 0,
			width: storyboard.width ?? 0,
			height: storyboard.height ?? 0,
		}
		return resolveConnectedPlacement(
			this.canvas,
			{
				originSide: "right",
				source: "handle",
				canvasX: originRect.x + originRect.width,
				canvasY: originRect.y + originRect.height / 2,
			},
			frameLayout,
			{
				output: "top-left",
				originElementId: storyboard.id,
				originRect,
				gap: resolveConnectionCreateGapForElement(storyboard, "right"),
			},
		)
	}

	private ensureConnections(storyboardId: string, imageIds: string[]): void {
		imageIds.forEach((imageId) => {
			if (this.canvas.connectionManager.hasConnection(storyboardId, imageId)) return
			this.canvas.connectionManager.connectElements({
				sourceElementId: storyboardId,
				targetElementId: imageId,
			})
		})
	}

	private layoutFrameChildren(
		frameId: string,
		imageIds: Array<string | undefined>,
		layout: OutputLayout,
		shotCount: number,
	): void {
		const frameLayout = this.resolveFrameLayout(layout.width, layout.heights)
		imageIds.forEach((imageId, index) => {
			if (!imageId) return
			if (this.canvas.elementManager.findParentIdForElement(imageId) !== frameId) return
			const image = this.canvas.elementManager.getElementData(imageId)
			if (image?.type !== ElementTypeEnum.Image) return
			this.canvas.elementManager.update(
				imageId,
				{
					x: frameLayout.padding,
					y: frameLayout.padding + getVerticalFrameContentOffset(layout.heights, index),
					width: layout.width,
					height: layout.heights[index],
					zIndex: shotCount - index,
				},
				{ silent: true },
			)
		})
		this.canvas.elementManager.update(
			frameId,
			{
				width: frameLayout.width,
				height: frameLayout.height,
			},
			{ silent: true },
		)
	}

	private commitShotOutputIds(
		storyboard: StoryboardElement,
		storyboardContent: StoryboardElementContent,
		shots: StoryboardShot[],
		imageIds: Array<string | undefined>,
	): void {
		const nextShots = shots.map((shot, index) => ({
			...shot,
			outputImageElementId: imageIds[index],
		}))
		if (JSON.stringify(storyboardContent.shots ?? []) === JSON.stringify(nextShots)) return
		const nextStoryboard = updateContent(storyboard, storyboardContent.contentId, {
			shots: nextShots,
		})
		this.canvas.elementManager.update(
			storyboard.id,
			{ contents: nextStoryboard.contents },
			{ silent: false },
		)
	}

	private hasAnyActiveShot(elementId: string, shots: StoryboardShot[]): boolean {
		return shots.some((shot) => this.isShotGenerating(elementId, shot.id))
	}

	private markShotsActive(elementId: string, shots: StoryboardShot[]): void {
		const activeShotIds = this.activeShotIds.get(elementId) ?? new Set<string>()
		shots.forEach((shot) => activeShotIds.add(shot.id))
		this.activeShotIds.set(elementId, activeShotIds)
	}

	private unmarkShotsActive(elementId: string, shots: StoryboardShot[]): void {
		const activeShotIds = this.activeShotIds.get(elementId)
		if (!activeShotIds) return
		shots.forEach((shot) => activeShotIds.delete(shot.id))
		if (activeShotIds.size === 0) this.activeShotIds.delete(elementId)
	}

	private findOutputFrame(imageIds: string[]): FrameElement | undefined {
		for (const imageId of imageIds) {
			const parentId = this.canvas.elementManager.findParentIdForElement(imageId)
			const parent = parentId
				? this.canvas.elementManager.getElementData(parentId)
				: undefined
			if (parent?.type === ElementTypeEnum.Frame) return parent
		}
		return undefined
	}

	private resolveOutputLayout(
		config: StoryboardGenerationConfig | undefined,
		count: number,
	): OutputLayout {
		const match = normalizeImageSizeValue(config?.size)?.match(/^(\d+)x(\d+)$/i)
		const ratio = match ? Number(match[2]) / Number(match[1]) : 1
		const width = IMAGE_CONFIG.DEFAULT_WIDTH
		return {
			width,
			heights: Array.from({ length: count }, () => Math.max(1, Math.round(width * ratio))),
		}
	}

	private resolveFrameLayout(width: number, heights: number[]) {
		return resolveFrameContentLayout({
			width,
			height: getVerticalFrameContentHeight(heights),
		})
	}
}
