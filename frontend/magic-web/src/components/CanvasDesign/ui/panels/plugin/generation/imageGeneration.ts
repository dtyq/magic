import {
	getCanvasCenter,
	getResolvedMediaPlacementConfig,
	getViewportCanvasRect,
	withHistoryManagerAsync,
} from "../../../../runtime/shared/placement/elementUtils"
import type { Canvas } from "../../../../runtime/core/Canvas"
import { ImageBatchPollingManager } from "../../../../runtime/resources/polling/ImageBatchPollingManager"
import { createBatchImageTaskMeta } from "../../../../runtime/resources/image/imageGenerationTaskMeta"
import { generateUUID } from "../../../../runtime/shared/ids"
import type {
	GenerateImageRequest,
	GenerateImagesRequest,
	ImageModelItem,
} from "../../../../public/magic-types"
import type { PluginGenerateAndPlaceParams } from "../runtime-protocol/v1/index"
import {
	collectObstacleRects,
	layerElementToObstacleRect,
} from "../../../../runtime/shared/placement/findNonOverlappingPlacement"
import { findGeneratedMediaGridPositions } from "../../../../runtime/shared/placement/placementEngine"
import {
	ElementTypeEnum,
	type ImageElement,
	type LayerElement,
} from "../../../../runtime/document/types"
import {
	getActiveImageContent,
	isImageElementContent,
	updateImageContent,
} from "../../../../runtime/document/elementContent"
import {
	areCanvasHostResourceReferencesSame,
	getCanvasHostResourceReferenceIdentity,
} from "../../../../runtime/shared/path/canvasResourcePath"
import type { Rect } from "../../../../runtime/shared/ids"
import {
	resolvePluginSourceElementId,
	type PluginSourceElementMap,
} from "../window/pluginSourceElements"

const DEFAULT_MAX_OUTPUT_IMAGES = 4
const PLUGIN_GENERATED_GRID_MAX_COLUMNS = 6

export async function getPluginImageModels(canvas: Canvas) {
	const getImageModelList = canvas.magicConfigManager.config?.methods?.getImageModelList
	if (!getImageModelList) {
		throw new Error("getImageModelList method not available.")
	}
	const models = await getImageModelList()
	return models.map(sanitizePluginImageModel)
}

/**
 * 生成插件图片，并在宿主侧统一创建占位元素、绑定批量轮询任务与处理落点。
 *
 * @param canvas - 画布实例
 * @param params - 插件生成和放置参数
 * @param options - 插件生成和放置选项
 * 	sourceElementByAssetKey - 插件参考图(path/id/url/src) -> 画布元素id映射
 * @returns 插件生成和放置结果
 */
export async function generatePluginImages(
	canvas: Canvas,
	params: PluginGenerateAndPlaceParams,
	options: {
		sourceElementByAssetKey?: PluginSourceElementMap
	} = {},
) {
	if (
		!canvas.permissionManager.can("sideEffect.generate") ||
		!canvas.permissionManager.can("document.write")
	) {
		throw new Error("Canvas does not allow document generation.")
	}
	const methods = canvas.magicConfigManager.config?.methods
	if (!methods?.generateImages || !methods?.getImageGenerationResults) {
		throw new Error("generateImages or getImageGenerationResults method not available.")
	}
	const generateImages = methods.generateImages
	if (!params.model_id || !params.prompt) {
		throw new Error("model_id and prompt are required.")
	}

	const maxOutputImages = await getPluginMaxOutputImages(canvas, params.model_id)
	const count = resolvePluginGenerateCount(params, maxOutputImages)
	const [sizeWidth, sizeHeight] = params.size?.split("x").map(Number) ?? []
	const width = params.width ?? (Number.isFinite(sizeWidth) ? sizeWidth : undefined)
	const height = params.height ?? (Number.isFinite(sizeHeight) ? sizeHeight : undefined)
	const batchImageId = generateUUID()
	const request: GenerateImagesRequest = {
		image_id: batchImageId,
		model_id: params.model_id,
		prompt: params.prompt,
		size: params.size,
		aspect_ratio: params.aspect_ratio,
		resolution: params.resolution,
		reference_images: params.reference_images,
		reference_image_options: params.reference_image_options,
		image_generation_config: params.image_generation_config,
		generate_num: count,
	}
	const generateImageRequest: GenerateImageRequest & { generate_num?: number } = { ...request }
	delete generateImageRequest.image_id
	delete generateImageRequest.generate_num

	const elementIds = await withHistoryManagerAsync(canvas.historyManager, async () => {
		const imageGeneratorTool = canvas.toolManager.getImageGeneratorTool()
		const imageSize = imageGeneratorTool.resolveImageElementSize(width, height)
		const mediaPlacementConfig = getResolvedMediaPlacementConfig(canvas)
		const allElements = canvas.elementManager.getAllElements()
		// 只把可见画布元素作为障碍物，隐藏元素不阻塞插件生成结果的落点。
		const obstacles = collectObstacleRects(allElements, (el) => {
			return canvas.permissionManager.isVisible(el)
		})
		// 落点策略由宿主统一处理：插件只传引用图，宿主推断来源元素并把结果放在它附近。
		const sourceElement = resolvePluginSourceElement(
			canvas,
			params,
			options.sourceElementByAssetKey,
		)
		// 来源元素的障碍矩形
		const sourceRect = sourceElement ? layerElementToObstacleRect(sourceElement) : null
		// 同配置历史输出会优先延续同一网格；如果没有历史输出，再回到来源图附近找首个落点。
		const existingGridRects = collectMatchingGeneratedGridRects(
			canvas,
			allElements,
			generateImageRequest,
		)
		const positions = findGeneratedMediaGridPositions(obstacles, {
			count,
			elementWidth: imageSize.width,
			elementHeight: imageSize.height,
			viewportRect: getViewportCanvasRect(canvas),
			sourceRect,
			existingGridRects,
			anchor: getCanvasCenter(canvas),
			spacing: mediaPlacementConfig.spacing,
			maxColumns: PLUGIN_GENERATED_GRID_MAX_COLUMNS,
			maxSearchRings: mediaPlacementConfig.maxSearchRings,
		})
		const nextElementIds = canvas.toolManager
			.getImageGeneratorTool()
			.createImageElementsAtPositions(positions, imageSize.width, imageSize.height, {
				temporary: true,
			})
		const targetContentIdByElementId = new Map<string, string>()
		for (const elementId of nextElementIds) {
			const element = canvas.elementManager.getElementData(elementId)
			if (!element || !isImageElementContent(element) || !element.activeContentId) {
				canvas.elementManager.batchDelete(nextElementIds)
				throw new Error(`Image Content target ${elementId} not found`)
			}
			targetContentIdByElementId.set(elementId, element.activeContentId)
		}

		// 提交确认前只写 Canvas RuntimeManager；Element/DSL/历史/剪贴板均不包含任务身份。
		nextElementIds.forEach((elementId) => {
			canvas.eventEmitter.emit({
				type: "element:image:generate-submit-started",
				data: { elementId },
			})
		})

		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-batch",
			phase: "submitting",
			failurePolicy: "remove-placeholder",
			targets: nextElementIds.map((elementId, index) => ({
				elementId,
				contentId: targetContentIdByElementId.get(elementId) as string,
				outputIndex: index + 1,
				generateImageRequest: {
					...generateImageRequest,
					image_id: batchImageId,
				},
				imageGenerationTaskMeta: createBatchImageTaskMeta({
					imageId: batchImageId,
					outputIndex: index + 1,
					outputCount: count,
				}),
			})),
		})

		try {
			await generateImages(request)
		} catch (error) {
			canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			throw error
		}

		const committedElementIds = nextElementIds.filter((elementId) => {
			const contentId = targetContentIdByElementId.get(elementId)
			return (
				canvas.generationRuntimeManager.isCurrent(attemptId, elementId, contentId) &&
				canvas.elementManager.hasElement(elementId)
			)
		})
		if (committedElementIds.length === 0) {
			return []
		}

		// 只有批量提交成功后，才原子写入正式字段并允许剩余目标进入 DSL。
		try {
			const committedContentIds: string[] = []
			const confirmed = canvas.generationAttemptCoordinator.confirmAttempt(
				attemptId,
				committedElementIds.map((elementId) => {
					const outputIndex = nextElementIds.indexOf(elementId) + 1
					const element = canvas.elementManager.getElementData(elementId)
					const contentId = targetContentIdByElementId.get(elementId)
					if (
						!contentId ||
						!element ||
						!isImageElementContent(element) ||
						!element.contents.some((content) => content.contentId === contentId)
					) {
						throw new Error(`Image Content target ${elementId} not found`)
					}
					const nextElement = updateImageContent(element, contentId, {
						status: "processing",
						errorMessage: undefined,
						generateImageRequest,
						imageGenerationTaskMeta: createBatchImageTaskMeta({
							imageId: batchImageId,
							outputIndex,
							outputCount: count,
						}),
					})
					committedContentIds.push(contentId)
					return {
						elementId,
						contentId,
						persistedPatch: {
							contents: nextElement.contents,
						},
					}
				}),
			)
			if (!confirmed) return []
			const batchPollingManager = new ImageBatchPollingManager({
				canvas,
				imageId: batchImageId,
				elementIds: committedElementIds,
				contentIds: committedContentIds,
				registry: canvas.imageBatchPollingRegistry,
			})
			void batchPollingManager.start()
		} catch (error) {
			canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			throw error
		}

		return committedElementIds
	})

	if (elementIds.length > 0) {
		const selectedElementId = elementIds[elementIds.length - 1]
		canvas.selectionManager.select(selectedElementId)
		const scheduleFocus =
			typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout
		scheduleFocus(() => {
			// 聚焦整批结果，避免多图生成时只把最后一张带入视口。
			canvas.viewportController.focusOnElements(elementIds, {
				animated: true,
				panOnly: true,
				// 插件生成完成后始终选中最后一张，保证属性面板和后续操作落在最新结果上。
				selectElement: [selectedElementId],
				ensureFullyVisible: true,
			})
		})
	}

	return { elementIds }
}

/** 展平图层树，确保画框内的图片也能参与来源匹配和已有网格续排。 */
function flattenLayerElements(elements: LayerElement[]): LayerElement[] {
	const result: LayerElement[] = []
	for (const element of elements) {
		result.push(element)
		if ("children" in element && Array.isArray(element.children)) {
			result.push(...flattenLayerElements(element.children))
		}
	}
	return result
}

/** 来源匹配只考虑当前对用户可见的画布元素。 */
function isVisibleCanvasElement(canvas: Canvas, element: LayerElement): boolean {
	return canvas.permissionManager.isVisible(element)
}

function getEffectiveImageContent(canvas: Canvas, element: ImageElement) {
	return (
		(canvas.getEffectiveContent?.(element.id) as
			| ReturnType<typeof getActiveImageContent>
			| undefined) ?? getActiveImageContent(element)
	)
}

/** 获取画布里可作为引用来源的可见图片元素。 */
function getImageElements(canvas: Canvas): ImageElement[] {
	return flattenLayerElements(canvas.elementManager.getAllElements()).filter(
		(element): element is ImageElement =>
			element.type === ElementTypeEnum.Image &&
			Boolean(getEffectiveImageContent(canvas, element).src) &&
			isVisibleCanvasElement(canvas, element),
	)
}

/** 按 id 获取可见图片元素，过滤掉非图片、隐藏元素和无 src 图片。 */
function getImageElementById(canvas: Canvas, elementId: string | undefined): ImageElement | null {
	if (!elementId) return null
	const element = canvas.elementManager.getElementData(elementId)
	if (
		!element ||
		element.type !== ElementTypeEnum.Image ||
		!isVisibleCanvasElement(canvas, element)
	) {
		return null
	}
	const imageElement = element as ImageElement
	if (!getEffectiveImageContent(canvas, imageElement).src) return null
	return imageElement
}

/** 用路径/URL 反查画布图片，覆盖插件只回传 reference 字符串的场景。 */
function resolveImageElementByReference(canvas: Canvas, reference: string): ImageElement | null {
	return (
		getImageElements(canvas).find((element) => {
			const active = getEffectiveImageContent(canvas, element)
			if (!active.src) return false
			return areCanvasHostResourceReferencesSame(canvas, active.src, reference)
		}) ?? null
	)
}

/** 判断图片是否是生成任务产物；这类元素不能作为下一次生成的来源兜底。 */
function isGeneratedImageElement(canvas: Canvas, element: ImageElement): boolean {
	const active = getEffectiveImageContent(canvas, element)
	return Boolean(active.generateImageRequest || active.imageGenerationTaskMeta)
}

/** 当插件没有带来源映射时，用当前选中的非生成图片作为最后兜底来源。 */
function getSelectedSourceImageElement(canvas: Canvas): ImageElement | null {
	const selectedImageId = canvas.selectionManager.getSelectedIds().find((elementId) => {
		const element = getImageElementById(canvas, elementId)
		return element && !isGeneratedImageElement(canvas, element)
	})
	return getImageElementById(canvas, selectedImageId)
}

/** 汇总插件请求里所有可能指向引用图的 key。 */
function getPluginReferenceKeys(params: PluginGenerateAndPlaceParams): string[] {
	const referenceImages = (params.reference_images ?? []).filter(
		(reference): reference is string =>
			typeof reference === "string" && Boolean(reference.trim()),
	)
	const referenceOptionPaths = (params.reference_image_options ?? []).flatMap((option) =>
		typeof option?.path === "string" && option.path.trim() ? [option.path] : [],
	)
	return [...referenceImages, ...referenceOptionPaths]
}

/** 去重并排序后的引用 key 用于生成稳定的落点分组 key。 */
function getNormalizedPluginReferenceKeys(
	canvas: Canvas,
	params: PluginGenerateAndPlaceParams,
): string[] {
	return Array.from(
		new Set(
			getPluginReferenceKeys(params)
				.map((reference) => getCanvasHostResourceReferenceIdentity(canvas, reference))
				.filter(Boolean),
		),
	).sort()
}

/** 稳定序列化请求参数，避免对象 key 顺序变化导致同一请求无法续排。 */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`
	}
	if (value && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStringify(
						(value as Record<string, unknown>)[key],
					)}`,
			)
			.join(",")}}`
	}
	return JSON.stringify(value) ?? "undefined"
}

/** 提取影响历史网格续排的生成配置；prompt/model/aspect_ratio 不参与画布排布分组。 */
function getGenerationPlacementKey(canvas: Canvas, request: PluginGenerateAndPlaceParams): string {
	return stableStringify({
		resolution: request.resolution,
		references: getNormalizedPluginReferenceKeys(canvas, request),
		image_generation_config: request.image_generation_config ?? {},
	})
}

/** 收集同配置已创建的结果矩形，供再次生成接着原网格摆放。 */
function collectMatchingGeneratedGridRects(
	canvas: Canvas,
	elements: LayerElement[],
	request: GenerateImageRequest,
): Rect[] {
	const targetPlacementKey = getGenerationPlacementKey(canvas, request)
	return flattenLayerElements(elements).flatMap((element) => {
		if (element.type !== ElementTypeEnum.Image || !isVisibleCanvasElement(canvas, element)) {
			return []
		}
		const imageElement = element as ImageElement
		const active = getEffectiveImageContent(canvas, imageElement)
		if (!active.generateImageRequest || !isGeneratedImageElement(canvas, imageElement)) {
			return []
		}
		if (getGenerationPlacementKey(canvas, active.generateImageRequest) !== targetPlacementKey) {
			return []
		}
		const rect = layerElementToObstacleRect(imageElement)
		return rect ? [rect] : []
	})
}

/**
 * 解析插件来源元素。
 *
 * @param canvas - 画布实例
 * @param params - 插件生成和放置参数
 * @param sourceElementByAssetKey - 插件来源元素映射
 * @returns 插件来源元素
 */
function resolvePluginSourceElement(
	canvas: Canvas,
	params: PluginGenerateAndPlaceParams,
	sourceElementByAssetKey?: PluginSourceElementMap,
): ImageElement | null {
	const references = getPluginReferenceKeys(params)
	const sourceElementId = resolvePluginSourceElementId(
		sourceElementByAssetKey,
		references,
		canvas.magicConfigManager.config?.methods?.resolveResourceReference,
	)
	const sourceElement = getImageElementById(canvas, sourceElementId)
	if (sourceElement) return sourceElement

	// 插件可能只回传文件路径/URL，先尝试和画布图片 src 做归一化匹配。
	for (const reference of references) {
		const element = resolveImageElementByReference(canvas, reference)
		if (element) return element
	}

	// 最后才用选中项兜底，并排除生成任务图，避免上一次输出成为下一次的锚点。
	return getSelectedSourceImageElement(canvas)
}

async function getPluginMaxOutputImages(canvas: Canvas, modelId: string) {
	const getImageModelList = canvas.magicConfigManager.config?.methods?.getImageModelList
	if (!getImageModelList) {
		return DEFAULT_MAX_OUTPUT_IMAGES
	}
	const models = await getImageModelList()
	const selectedModel = models.find((model) => model.model_id === modelId)
	const maxOutputImages = Number(selectedModel?.image_size_config?.max_output_images)
	if (!Number.isFinite(maxOutputImages) || maxOutputImages <= 0) {
		return DEFAULT_MAX_OUTPUT_IMAGES
	}
	return Math.max(1, Math.floor(maxOutputImages))
}

function resolvePluginGenerateCount(params: PluginGenerateAndPlaceParams, maxOutputImages: number) {
	const preferredCount = params.count ?? 1
	return clampGenerationValue(preferredCount, maxOutputImages)
}

function clampGenerationValue(value: number, maxOutputImages: number) {
	const parsedValue = Number(value)
	if (!Number.isFinite(parsedValue)) {
		return 1
	}
	return Math.max(1, Math.min(Math.floor(parsedValue), maxOutputImages))
}

function sanitizePluginImageModel(model: ImageModelItem) {
	return {
		model_id: model.model_id,
		model_name: model.model_name,
		model_icon: model.model_icon,
		model_description: model.model_description,
		image_size_config: model.image_size_config
			? {
					default_scale: model.image_size_config.default_scale,
					max_reference_images: model.image_size_config.max_reference_images,
					max_output_images: model.image_size_config.max_output_images,
					sizes: (model.image_size_config.sizes ?? []).map((size) => ({
						label: size.label,
						value: size.value,
						scale: size.scale,
					})),
					image_settings: (model.image_size_config.image_settings ?? []).map(
						(setting) => ({
							key: setting.key,
							label: setting.label,
							description: setting.description,
							component: setting.component,
							variant: setting.variant,
							default: setting.default,
							options: (setting.options ?? []).map((option) => ({
								label: option.label,
								value: option.value,
							})),
						}),
					),
				}
			: undefined,
	}
}
