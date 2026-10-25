import { afterEach, describe, expect, it, vi } from "vitest"
import type { ImageModelItem } from "../../../../public/magic-types"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import {
	canCreateStoryboardFromConnection,
	createStoryboardFromConnection,
	resolveStoryboardConnectionGenerationConfig,
} from "../storyboardConnectionCreation"

function createImageModel(): ImageModelItem {
	return {
		id: "model-1",
		group_id: "group-1",
		model_id: "gpt-image-2",
		model_name: "GPT Image 2",
		provider_model_id: "gpt-image-2",
		model_description: "",
		model_icon: "",
		model_status: "normal",
		sort: 1,
		image_size_config: {
			default_scale: "1K",
			sizes: [{ label: "9:16", value: "1080x1920", scale: "1K" }],
			image_settings: [
				{
					key: "image_generation_config.quality",
					label: "Quality",
					description: "",
					component: "single_select",
					variant: "segmented",
					default: "high",
					options: [{ label: "High", value: "high" }],
				},
			],
		},
	}
}

function createCanvasMock(options?: {
	originType?: LayerElement["type"]
	originChildren?: LayerElement[]
	originSrc?: string
	connectionStatus?: "created" | "invalid"
	storedConfig?: Record<string, unknown>
}) {
	let shouldRecordResult: boolean | undefined
	const originType = options?.originType ?? ElementTypeEnum.Image
	const originElement = {
		id: "image-1",
		type: originType,
		contents: [
			{
				contentId: "image-1-content",
				...(originType === ElementTypeEnum.Image
					? { src: options?.originSrc ?? "/image-1.png" }
					: {}),
			},
		],
		activeContentId: "image-1-content",
		mainContentId: "image-1-content",
		...(originType === ElementTypeEnum.Frame || originType === ElementTypeEnum.Group
			? { children: options?.originChildren ?? [] }
			: {}),
	} as LayerElement
	const elements = new Map<string, LayerElement>([[originElement.id, originElement]])
	const create = vi.fn((element: LayerElement) => elements.set(element.id, element))
	const remove = vi.fn((elementId: string) => elements.delete(elementId))
	const connectElements = vi.fn(() =>
		options?.connectionStatus === "invalid"
			? ({ status: "invalid", reason: "missing-element" } as const)
			: ({ status: "created", connectionId: "connection-1" } as const),
	)
	const select = vi.fn()
	const moveElementToViewport = vi.fn()
	const runTransaction = vi.fn(
		(callback: () => string | null, shouldRecord?: (result: string | null) => boolean) => {
			const result = callback()
			shouldRecordResult = shouldRecord?.(result)
			return result
		},
	)
	const canvas = {
		historyManager: { runTransaction },
		elementManager: {
			getAllElements: vi.fn(() => [originElement]),
			getElementData: vi.fn((elementId: string) => elements.get(elementId)),
			getNextZIndexInLevel: vi.fn(() => 7),
			create,
			delete: remove,
			hasElement: vi.fn((elementId: string) => elements.has(elementId)),
			isElementVisibleInDataTree: vi.fn(
				(elementId: string) => elements.get(elementId)?.visible !== false,
			),
			canParticipateInDocumentRelations: vi.fn(() => true),
			getNodeAdapter: vi.fn(() => ({
				getElementsBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
			})),
		},
		getEffectiveContent: vi.fn((elementId: string) => {
			const element = elements.get(elementId)
			if (!element || !("contents" in element) || !Array.isArray(element.contents))
				return undefined
			return (
				element.contents.find((content) => content.contentId === element.activeContentId) ??
				element.contents[0]
			)
		}),
		permissionManager: { canConnect: vi.fn(() => true) },
		connectionManager: { connectElements },
		selectionManager: { select },
		viewportController: {
			isElementInViewport: vi.fn(() => false),
			moveElementToViewport,
		},
		magicConfigManager: {
			config: {
				methods: {
					getRootStorage: vi.fn(() => ({
						defaultGenerateImageConfig: options?.storedConfig,
					})),
				},
			},
		},
	} as unknown as Canvas

	return {
		canvas,
		originElement,
		create,
		remove,
		connectElements,
		select,
		moveElementToViewport,
		runTransaction,
		getShouldRecordResult: () => shouldRecordResult,
	}
}

describe("storyboard connection creation", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("is available from the right handle of an image or usable container", () => {
		const { canvas } = createCanvasMock()

		expect(
			canCreateStoryboardFromConnection(canvas, {
				kind: "element",
				elementId: "image-1",
				side: "right",
			}),
		).toBe(true)
		expect(
			canCreateStoryboardFromConnection(canvas, {
				kind: "element",
				elementId: "image-1",
				side: "left",
			}),
		).toBe(false)
		expect(
			canCreateStoryboardFromConnection(createCanvasMock({ originType: "video" }).canvas, {
				kind: "element",
				elementId: "image-1",
				side: "right",
			}),
		).toBe(false)
		expect(
			canCreateStoryboardFromConnection(
				createCanvasMock({
					originType: ElementTypeEnum.Frame,
					originChildren: [
						{
							id: "frame-image",
							type: ElementTypeEnum.Image,
							visible: true,
							contents: [
								{ contentId: "frame-image-content", src: "/frame-image.png" },
							],
							activeContentId: "frame-image-content",
							mainContentId: "frame-image-content",
						} as LayerElement,
					],
				}).canvas,
				{ kind: "element", elementId: "image-1", side: "right" },
			),
		).toBe(true)
		expect(
			canCreateStoryboardFromConnection(
				createCanvasMock({ originType: ElementTypeEnum.Frame }).canvas,
				{ kind: "element", elementId: "image-1", side: "right" },
			),
		).toBe(false)
		expect(
			canCreateStoryboardFromConnection(
				createCanvasMock({
					originType: ElementTypeEnum.Group,
					originChildren: [
						{
							id: "group-image",
							type: ElementTypeEnum.Image,
							visible: true,
							contents: [
								{ contentId: "group-image-content", src: "/group-image.png" },
							],
							activeContentId: "group-image-content",
							mainContentId: "group-image-content",
						} as LayerElement,
					],
				}).canvas,
				{ kind: "element", elementId: "image-1", side: "right" },
			),
		).toBe(true)
		expect(
			canCreateStoryboardFromConnection(createCanvasMock({ originSrc: "" }).canvas, {
				kind: "element",
				elementId: "image-1",
				side: "right",
			}),
		).toBe(false)
		expect(
			canCreateStoryboardFromConnection(
				createCanvasMock({
					originType: ElementTypeEnum.Frame,
					originChildren: [
						{
							id: "hidden-image",
							type: ElementTypeEnum.Image,
							visible: false,
							contents: [{ contentId: "hidden-image-content", src: "/hidden.png" }],
							activeContentId: "hidden-image-content",
							mainContentId: "hidden-image-content",
						} as LayerElement,
					],
				}).canvas,
				{ kind: "element", elementId: "image-1", side: "right" },
			),
		).toBe(false)
	})

	it("uses the stored image generation config without sharing nested state", () => {
		const storedConfig = {
			model_id: "stored-model",
			size: "1024x1024",
			resolution: "2K",
			image_generation_config: { quality: "medium" },
		}
		const { canvas } = createCanvasMock({ storedConfig })

		const result = resolveStoryboardConnectionGenerationConfig(canvas, [createImageModel()])

		expect(result).toEqual(storedConfig)
		expect(result).not.toBe(storedConfig)
		expect(result?.image_generation_config).not.toBe(storedConfig.image_generation_config)
	})

	it("falls back to the first image model defaults", () => {
		const { canvas } = createCanvasMock()

		expect(resolveStoryboardConnectionGenerationConfig(canvas, [createImageModel()])).toEqual({
			model_id: "gpt-image-2",
			size: "1080x1920",
			resolution: "1K",
			image_generation_config: { quality: "high" },
		})
	})

	it("creates, connects, selects and focuses the storyboard in one transaction", () => {
		vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})
		const {
			canvas,
			create,
			connectElements,
			select,
			moveElementToViewport,
			runTransaction,
			getShouldRecordResult,
		} = createCanvasMock()

		const elementId = createStoryboardFromConnection(canvas, {
			origin: { kind: "element", elementId: "image-1", side: "right" },
			x: 1200,
			y: 300,
			imageModelList: [createImageModel()],
		})

		expect(elementId).toMatch(/^element-/)
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: elementId,
				type: ElementTypeEnum.Storyboard,
				x: 1200,
				y: 300,
				zIndex: 7,
				contents: [
					expect.objectContaining({
						shots: [
							expect.objectContaining({ id: expect.any(String), description: "" }),
						],
					}),
				],
			}),
		)
		expect(connectElements).toHaveBeenCalledWith({
			sourceElementId: "image-1",
			targetElementId: elementId,
		})
		expect(select).toHaveBeenCalledWith(elementId)
		expect(moveElementToViewport).toHaveBeenCalledWith([elementId], {
			animated: true,
			padding: { top: 50, right: 50, bottom: 50, left: 100 },
		})
		expect(runTransaction).toHaveBeenCalledTimes(1)
		expect(getShouldRecordResult()).toBe(true)
	})

	it("rolls back the new element and skips history when the connection is rejected", () => {
		const { canvas, remove, select, runTransaction, getShouldRecordResult } = createCanvasMock({
			connectionStatus: "invalid",
		})

		const result = createStoryboardFromConnection(canvas, {
			origin: { kind: "element", elementId: "image-1", side: "right" },
			x: 1200,
			y: 300,
			imageModelList: [createImageModel()],
		})

		expect(result).toBeNull()
		expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^element-/))
		expect(select).not.toHaveBeenCalled()
		expect(runTransaction).toHaveBeenCalledTimes(1)
		expect(getShouldRecordResult()).toBe(false)
	})

	it("revalidates downstream image availability before creating", () => {
		const { canvas, originElement, create, connectElements, runTransaction } =
			createCanvasMock()
		expect(
			canCreateStoryboardFromConnection(canvas, {
				kind: "element",
				elementId: originElement.id,
				side: "right",
			}),
		).toBe(true)
		const content = originElement.contents[0]
		if (content && "src" in content) content.src = ""

		const result = createStoryboardFromConnection(canvas, {
			origin: { kind: "element", elementId: originElement.id, side: "right" },
			x: 1200,
			y: 300,
			imageModelList: [createImageModel()],
		})

		expect(result).toBeNull()
		expect(runTransaction).not.toHaveBeenCalled()
		expect(create).not.toHaveBeenCalled()
		expect(connectElements).not.toHaveBeenCalled()
	})
})
