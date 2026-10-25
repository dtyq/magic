import type { ImageModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import type { StoryboardGenerationConfig } from "../../document/types"
import { StoryboardElement } from "../../elements/storyboard/StoryboardElement"
import { generateElementId } from "../../shared/ids"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import { collectSelectionContentSnapshot } from "../selection/selectionContentCollector"
import { createElementFromElementConnection } from "./elementConnectionCreation"

type ElementConnectionOrigin = Extract<ConnectionOrigin, { kind: "element" }>

interface CreateStoryboardElementOptions {
	x: number
	y: number
	imageModelList: ImageModelItem[]
}

interface CreateStoryboardFromConnectionOptions extends CreateStoryboardElementOptions {
	origin: ElementConnectionOrigin
}

function cloneStoredGenerationConfig(
	config: Partial<StoryboardGenerationConfig> | undefined,
): StoryboardGenerationConfig | undefined {
	if (!config) return undefined

	const result: StoryboardGenerationConfig = {}
	if (config.model_id !== undefined) result.model_id = config.model_id
	if (config.size !== undefined) result.size = config.size
	if (config.resolution !== undefined) result.resolution = config.resolution
	if (config.image_generation_config !== undefined) {
		result.image_generation_config = { ...config.image_generation_config }
	}

	return Object.keys(result).length > 0 ? result : undefined
}

function resolveModelDefaultImageGenerationConfig(
	model: ImageModelItem,
): StoryboardGenerationConfig["image_generation_config"] | undefined {
	const result: Record<string, string> = {}
	model.image_size_config?.image_settings?.forEach((setting) => {
		const prefix = "image_generation_config."
		if (!setting.key.startsWith(prefix)) return
		const key = setting.key.slice(prefix.length)
		if (!key) return
		result[key] = setting.default
	})
	return Object.keys(result).length > 0 ? result : undefined
}

export function canCreateStoryboardFromConnection(
	canvas: Canvas | null | undefined,
	origin: ElementConnectionOrigin | null | undefined,
): boolean {
	if (!canvas || !origin || origin.side !== "right") return false

	const snapshot = collectSelectionContentSnapshot(canvas, [origin.elementId])
	return snapshot.allRootsCanConnect && snapshot.imageSequence.length >= 1
}

export function getStoryboardConnectionCreateSize(): { width: number; height: number } {
	const config = StoryboardElement.getDefaultConfig()
	return { width: config.width, height: config.height }
}

export function resolveStoryboardConnectionGenerationConfig(
	canvas: Canvas,
	imageModelList: ImageModelItem[],
): StoryboardGenerationConfig | undefined {
	const storedConfig = cloneStoredGenerationConfig(
		canvas.magicConfigManager.config?.methods?.getRootStorage?.()?.defaultGenerateImageConfig,
	)
	if (storedConfig) return storedConfig

	const model = imageModelList[0]
	if (!model) return undefined
	const size = model.image_size_config?.sizes?.[0]
	return {
		model_id: model.model_id,
		size: size?.value,
		resolution: size?.scale ?? model.image_size_config?.default_scale,
		image_generation_config: resolveModelDefaultImageGenerationConfig(model),
	}
}

export function createStoryboardConnectionElement(
	canvas: Canvas,
	options: CreateStoryboardElementOptions,
): string {
	const elementId = generateElementId()
	const element = StoryboardElement.createElementData({
		id: elementId,
		x: options.x,
		y: options.y,
		zIndex: canvas.elementManager.getNextZIndexInLevel(),
		generationConfig: resolveStoryboardConnectionGenerationConfig(
			canvas,
			options.imageModelList,
		),
	})

	canvas.elementManager.create(element)
	return elementId
}

export function completeStoryboardConnectionCreation(canvas: Canvas, elementId: string): void {
	canvas.selectionManager.select(elementId)
	requestAnimationFrame(() => {
		if (!canvas.elementManager.hasElement(elementId)) return
		if (canvas.viewportController.isElementInViewport([elementId])) return
		canvas.viewportController.moveElementToViewport([elementId], {
			animated: true,
			padding: { top: 50, right: 50, bottom: 50, left: 100 },
		})
	})
}

export function createStoryboardFromConnection(
	canvas: Canvas,
	options: CreateStoryboardFromConnectionOptions,
): string | null {
	if (!canCreateStoryboardFromConnection(canvas, options.origin)) return null

	return createElementFromElementConnection({
		canvas,
		origin: options.origin,
		createElement: () => createStoryboardConnectionElement(canvas, options),
		afterConnect: ({ createdElementId }) => {
			completeStoryboardConnectionCreation(canvas, createdElementId)
		},
	})
}
