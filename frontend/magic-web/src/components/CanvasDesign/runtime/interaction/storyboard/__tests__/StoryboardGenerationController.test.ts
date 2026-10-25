import { afterEach, describe, expect, it, vi } from "vitest"
import { EventEmitter } from "../../../core/EventEmitter"
import {
	ElementTypeEnum,
	type FrameElement,
	type ImageElement as ImageElementData,
	type StoryboardElement,
} from "../../../document/types"
import { isValidElementData } from "../../../document/validateElement"
import { ImageElement } from "../../../elements/image/ImageElement"
import type { ImageModelItem } from "../../../../public/magic-types"
import { StoryboardGenerationController } from "../StoryboardGenerationController"

function createStoryboard(): StoryboardElement {
	const contentId = "storyboard-content"
	return {
		id: "storyboard-1",
		type: ElementTypeEnum.Storyboard,
		x: 100,
		y: 200,
		width: 960,
		height: 1360,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [
			{
				contentId,
				shots: [
					{ id: "shot-1", description: "wide shot" },
					{ id: "shot-2", description: "close up" },
				],
				generationConfig: {
					model_id: "model-1",
					size: "1024x1024",
					resolution: "1K",
					image_generation_config: { quality: "high" },
				},
			},
		],
	}
}

function getStoryboardContent(storyboard: StoryboardElement) {
	const content = storyboard.contents.find(
		(item) => item.contentId === storyboard.activeContentId,
	)
	if (!content) throw new Error("Expected active storyboard Content")
	return content
}

function createModel(maxReferenceImages = 4): ImageModelItem {
	return {
		id: "model-1",
		group_id: "official",
		model_id: "model-1",
		model_name: "测试模型",
		provider_model_id: "provider-model-1",
		model_description: "",
		model_icon: "",
		model_status: "normal",
		sort: 1,
		image_size_config: {
			default_scale: "1K",
			max_reference_images: maxReferenceImages,
			sizes: [{ label: "1:1", value: "1024x1024", scale: "1K" }],
		},
	} as ImageModelItem
}

function createHarness(options?: {
	storyboard?: StoryboardElement
	model?: ImageModelItem
	inputImage?: ImageElementData
	inputFrame?: FrameElement
	failInitialSubmissionIndex?: number
}) {
	const elements = new Map<string, any>()
	const instances = new Map<string, ImageElement>()
	const parents = new Map<string, string>()
	const submissions: Array<{
		elementId: string
		kind: "initial" | "version"
		request: Record<string, unknown>
	}> = []
	const connections: Array<{
		id: string
		sourceElementId: string
		targetElementId: string
	}> = []
	const eventEmitter = new EventEmitter()
	let zIndex = 10
	let initialSubmissionCount = 0

	const registerImage = (data: ImageElementData) => {
		elements.set(data.id, data)
		const instance = Object.create(ImageElement.prototype) as ImageElement & {
			getData: () => ImageElementData
			hasGenerationHistory: () => boolean
			getLatestContentData: () => any
			submitInitialGeneration: (request: Record<string, unknown>) => Promise<boolean>
			submitContentGeneration: (request: Record<string, unknown>) => Promise<boolean>
			submitGeneration: (request: Record<string, unknown>) => Promise<boolean>
		}
		instance.getData = () => elements.get(data.id) as ImageElementData
		instance.hasGenerationHistory = vi.fn(() => {
			const current = elements.get(data.id) as ImageElementData
			const active = current.contents.find(
				(content) => content.contentId === current.activeContentId,
			)
			return current.contents.length > 1 || Boolean(active?.generateImageRequest)
		})
		instance.getLatestContentData = vi.fn(() => {
			const current = elements.get(data.id) as ImageElementData
			return current.contents.at(-1) ?? { contentId: `${data.id}-content-1` }
		})
		instance.submitInitialGeneration = vi.fn(async (request) => {
			const submissionIndex = initialSubmissionCount++
			if (options?.failInitialSubmissionIndex === submissionIndex) {
				throw new Error("submit failed")
			}
			submissions.push({ elementId: data.id, kind: "initial", request })
			const current = elements.get(data.id) as ImageElementData
			elements.set(data.id, {
				...current,
				contents: current.contents.map((content) =>
					content.contentId === current.activeContentId
						? { ...content, generateImageRequest: request }
						: content,
				),
			})
			return true
		})
		instance.submitContentGeneration = vi.fn(async (request) => {
			submissions.push({ elementId: data.id, kind: "version", request })
			return true
		})
		instance.submitGeneration = vi.fn(async (request) =>
			instance.hasGenerationHistory()
				? instance.submitContentGeneration(request)
				: instance.submitInitialGeneration(request),
		)
		instances.set(data.id, instance)
	}

	const register = (data: any, parentId?: string) => {
		elements.set(data.id, data)
		if (parentId) parents.set(data.id, parentId)
		if (data.type === ElementTypeEnum.Image) registerImage(data)
		if (data.type === ElementTypeEnum.Frame && Array.isArray(data.children)) {
			data.children.forEach((child: any) => register(child, data.id))
		}
	}

	const storyboard = options?.storyboard ?? createStoryboard()
	register(storyboard)
	if (options?.inputImage) {
		registerImage(options.inputImage)
	}
	if (options?.inputFrame) {
		register(options.inputFrame)
	}

	const frameCount = () =>
		Array.from(elements.values()).filter((element) => element.type === ElementTypeEnum.Frame)
			.length

	const canvas = {
		eventEmitter,
		contentLayer: { batchDraw: vi.fn() },
		t: (_key: string, fallback: string) => fallback,
		historyManager: {
			disable: vi.fn(),
			enable: vi.fn(),
			recordHistoryImmediate: vi.fn(),
			runAsyncTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
		},
		magicConfigManager: {
			config: {
				methods: {
					resolveResourceReference: undefined,
					generateImage: vi.fn(),
				},
			},
		},
		generationRuntimeManager: { getTargetState: vi.fn(() => null) },
		elementManager: {
			getElementData: vi.fn((id: string) => elements.get(id)),
			getElementInstance: vi.fn((id: string) => instances.get(id)),
			getAllElementIds: vi.fn(() => Array.from(elements.keys())),
			isElementVisibleInDataTree: vi.fn(() => true),
			hasElement: vi.fn((id: string) => elements.has(id)),
			getNextZIndexInLevel: vi.fn(() => ++zIndex),
			create: vi.fn((data: any) => register(data)),
			update: vi.fn((id: string, patch: Record<string, unknown>) => {
				const current = elements.get(id)
				if (!current) return
				elements.set(id, { ...current, ...patch })
				if (id === storyboard.id) {
					Object.assign(storyboard, patch)
				}
			}),
			reparentElements: vi.fn((options: any) => {
				const frame = elements.get(options.targetParentId)
				const item = options.elements[0]
				if (!frame || !item) return false
				parents.set(item.elementId, frame.id)
				frame.children = [
					...(frame.children ?? []).filter((child: any) => child.id !== item.elementId),
					{ ...elements.get(item.elementId) },
				]
				elements.set(frame.id, frame)
				return true
			}),
			delete: vi.fn((id: string) => {
				elements.delete(id)
				instances.delete(id)
				parents.delete(id)
			}),
			findParentIdForElement: vi.fn((id: string) => parents.get(id)),
		},
		geometryCacheManager: {
			getElementBounds: vi.fn((id: string) => {
				const element = elements.get(id)
				if (!element) return null
				return {
					x: element.x ?? 0,
					y: element.y ?? 0,
					width: element.width ?? 0,
					height: element.height ?? 0,
				}
			}),
		},
		connectionManager: {
			getUpstreamConnections: vi.fn((id: string) => {
				const inputElement = options?.inputImage ?? options?.inputFrame
				return id === storyboard.id && inputElement
					? [
							{
								id: "input-connection",
								sourceElementId: inputElement.id,
								targetElementId: id,
							},
						]
					: []
			}),
			getDownstreamConnections: vi.fn((id: string) =>
				connections.filter((connection) => connection.sourceElementId === id),
			),
			hasConnection: vi.fn((sourceElementId: string, targetElementId: string) =>
				connections.some(
					(connection) =>
						connection.sourceElementId === sourceElementId &&
						connection.targetElementId === targetElementId,
				),
			),
			connectElements: vi.fn(
				({ sourceElementId, targetElementId }: Record<string, string>) => {
					const id = `connection-${connections.length + 1}`
					connections.push({ id, sourceElementId, targetElementId })
					return { status: "created", connectionId: id }
				},
			),
		},
	} as any

	return {
		canvas,
		storyboard,
		elements,
		parents,
		instances,
		submissions,
		connections,
		frameCount,
		model: options?.model ?? createModel(),
	}
}

describe("StoryboardGenerationController", () => {
	afterEach(() => vi.restoreAllMocks())

	it("creates one frame, one removable output connection per shot, and submits concurrently", async () => {
		const harness = createHarness()
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)

		expect(harness.frameCount()).toBe(1)
		const outputFrame = Array.from(harness.elements.values()).find(
			(element) => element.type === ElementTypeEnum.Frame,
		)
		expect(isValidElementData(outputFrame)).toBe(true)
		expect(outputFrame?.name).toBe("分镜图片组合")
		expect(
			outputFrame?.children?.every((child: Record<string, unknown>) =>
				["draggable", "listening", "perfectDrawEnabled"].every(
					(field) => !(field in child),
				),
			),
		).toBe(true)
		expect(outputFrame?.x).toBe(100 + 960 + 1024)
		expect(outputFrame?.y).toBe(200 + 1360 / 2 - (outputFrame?.height ?? 0) / 2)
		expect(harness.submissions).toHaveLength(2)
		expect(harness.submissions.map((item) => item.kind)).toEqual(["initial", "initial"])
		expect(harness.canvas.historyManager.runAsyncTransaction).toHaveBeenCalledOnce()
		expect(harness.connections).toHaveLength(2)
		const outputIds = getStoryboardContent(harness.storyboard).shots?.map(
			(shot) => shot.outputImageElementId,
		)
		expect(outputIds).toEqual(expect.arrayContaining([expect.any(String), expect.any(String)]))
		expect(new Set(outputIds).size).toBe(2)
		controller.destroy()
	})

	it("generates only the requested shot and creates a normal output connection", async () => {
		const harness = createHarness()
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateShot(harness.storyboard.id, "shot-2")

		expect(harness.submissions).toHaveLength(1)
		expect(harness.submissions[0]?.request).toEqual(
			expect.objectContaining({ prompt: "close up", model_id: "model-1" }),
		)
		expect(harness.frameCount()).toBe(1)
		expect(
			getStoryboardContent(harness.storyboard).shots?.[0]?.outputImageElementId,
		).toBeUndefined()
		expect(getStoryboardContent(harness.storyboard).shots?.[1]?.outputImageElementId).toEqual(
			expect.any(String),
		)
		expect(harness.connections).toHaveLength(1)
		controller.destroy()
	})

	it("uses the fallback model id when the configured model is unavailable", async () => {
		const fallbackModel = { ...createModel(), model_id: "model-2", id: "model-2" }
		const harness = createHarness({ model: fallbackModel })
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			fallbackModel,
		])

		await controller.generateShot(harness.storyboard.id, "shot-1")

		expect(harness.submissions[0]?.request).toEqual(
			expect.objectContaining({ model_id: "model-2" }),
		)
		controller.destroy()
	})

	it("blocks the whole batch for an empty shot description", async () => {
		const storyboard = createStoryboard()
		getStoryboardContent(storyboard).shots![1].description = "   "
		const harness = createHarness({ storyboard })
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)

		expect(harness.submissions).toEqual([])
		expect(harness.frameCount()).toBe(0)
		controller.destroy()
	})

	it("blocks the whole batch when references exceed the model limit", async () => {
		const inputImage: ImageElementData = {
			id: "reference-image",
			type: ElementTypeEnum.Image,
			x: 0,
			y: 0,
			width: 512,
			height: 512,
			activeContentId: "reference-content",
			mainContentId: "reference-content",
			contents: [{ contentId: "reference-content", src: "./images/reference.png" }],
		}
		const harness = createHarness({ inputImage, model: createModel(0) })
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)

		expect(harness.submissions).toEqual([])
		expect(harness.frameCount()).toBe(0)
		controller.destroy()
	})

	it("expands a connected Frame into visible image references for every shot", async () => {
		const frameContentId = "reference-frame-content"
		const frame: FrameElement = {
			id: "reference-frame",
			type: ElementTypeEnum.Frame,
			x: 0,
			y: 0,
			width: 1200,
			height: 800,
			activeContentId: frameContentId,
			mainContentId: frameContentId,
			contents: [{ contentId: frameContentId }],
			children: [
				{
					id: "frame-image-a",
					type: ElementTypeEnum.Image,
					zIndex: 1,
					x: 0,
					y: 0,
					width: 512,
					height: 512,
					activeContentId: "frame-image-a-content",
					mainContentId: "frame-image-a-content",
					contents: [
						{
							contentId: "frame-image-a-content",
							src: "./images/frame-a.png",
							crop: { x: 1, y: 2, width: 100, height: 80 },
						},
					],
				},
				{
					id: "frame-image-b",
					type: ElementTypeEnum.Image,
					zIndex: 2,
					x: 520,
					y: 0,
					width: 512,
					height: 512,
					activeContentId: "frame-image-b-content",
					mainContentId: "frame-image-b-content",
					contents: [
						{
							contentId: "frame-image-b-content",
							src: "./images/frame-b.png",
						},
					],
				},
				{
					id: "frame-hidden-image",
					type: ElementTypeEnum.Image,
					zIndex: 3,
					visible: false,
					activeContentId: "frame-hidden-image-content",
					mainContentId: "frame-hidden-image-content",
					contents: [
						{
							contentId: "frame-hidden-image-content",
							src: "./images/hidden.png",
						},
					],
				},
			],
		}
		const harness = createHarness({ inputFrame: frame })
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)

		expect(harness.submissions[0]?.request).toEqual(
			expect.objectContaining({
				reference_images: ["./images/frame-a.png", "./images/frame-b.png"],
				reference_image_options: [
					{
						path: "./images/frame-a.png",
						crop: { x: 1, y: 2, width: 100, height: 80 },
					},
				],
			}),
		)
		expect(harness.submissions[1]?.request).toEqual(
			expect.objectContaining({
				reference_images: ["./images/frame-a.png", "./images/frame-b.png"],
			}),
		)
		controller.destroy()
	})

	it("reuses stable output elements and appends versions on subsequent batches", async () => {
		const harness = createHarness()
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)
		const outputIds = harness.connections.map((connection) => connection.targetElementId)
		const shotOutputIds = getStoryboardContent(harness.storyboard).shots?.map(
			(shot) => shot.outputImageElementId,
		)
		await controller.generateAll(harness.storyboard.id)

		expect(harness.frameCount()).toBe(1)
		expect(harness.connections.map((connection) => connection.targetElementId)).toEqual(
			outputIds,
		)
		expect(
			getStoryboardContent(harness.storyboard).shots?.map(
				(shot) => shot.outputImageElementId,
			),
		).toEqual(shotOutputIds)
		expect(harness.submissions.map((item) => item.kind)).toEqual([
			"initial",
			"initial",
			"version",
			"version",
		])
		controller.destroy()
	})

	it("reparents a missing output back into the existing frame", async () => {
		const harness = createHarness()
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)
		const missingId = getStoryboardContent(harness.storyboard).shots?.[1]?.outputImageElementId
		const existingId = getStoryboardContent(harness.storyboard).shots?.[0]?.outputImageElementId
		const frameId = existingId ? harness.parents.get(existingId) : undefined
		if (!missingId || !existingId || !frameId)
			throw new Error("Expected generated frame outputs")
		harness.elements.delete(missingId)
		harness.instances.delete(missingId)
		harness.parents.delete(missingId)
		const missingConnectionIndex = harness.connections.findIndex(
			(connection) => connection.targetElementId === missingId,
		)
		if (missingConnectionIndex >= 0) harness.connections.splice(missingConnectionIndex, 1)
		const frame = harness.elements.get(frameId)
		frame.children = frame.children?.filter((child: { id: string }) => child.id !== missingId)

		await controller.generateAll(harness.storyboard.id)

		const restoredId = getStoryboardContent(harness.storyboard).shots?.[1]?.outputImageElementId
		expect(restoredId).toBeTruthy()
		expect(restoredId).not.toBe(missingId)
		expect(harness.parents.get(restoredId as string)).toBe(frameId)
		expect(harness.elements.get(frameId).children).toHaveLength(2)
		expect(harness.frameCount()).toBe(1)
		controller.destroy()
	})

	it("shares the associated image Content and crop options across every shot", async () => {
		const inputImage: ImageElementData = {
			id: "reference-image",
			type: ElementTypeEnum.Image,
			x: 0,
			y: 0,
			width: 512,
			height: 512,
			activeContentId: "v2",
			mainContentId: "v2",
			contents: [
				{
					contentId: "v1",
					src: "./images/associated.png",
					crop: { x: 1, y: 2, width: 100, height: 80 },
				},
				{
					contentId: "v2",
					src: "./images/reference.png",
					crop: { x: 10, y: 20, width: 300, height: 200 },
				},
			],
		}
		const harness = createHarness({ inputImage })
		const getAssociatedContentData = vi.fn(() => inputImage.contents[0])
		const inputInstance = harness.instances.get(inputImage.id)
		if (!inputInstance) throw new Error("Expected input image instance")
		inputInstance.getAssociatedContentData = getAssociatedContentData
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)

		expect(harness.submissions[0]?.request).toEqual(
			expect.objectContaining({
				reference_images: ["./images/associated.png"],
				reference_image_options: [
					{
						path: "./images/associated.png",
						crop: { x: 1, y: 2, width: 100, height: 80 },
					},
				],
			}),
		)
		expect(harness.submissions[1]?.request).toEqual(
			expect.objectContaining({
				reference_images: ["./images/associated.png"],
				reference_image_options: [
					{
						path: "./images/associated.png",
						crop: { x: 1, y: 2, width: 100, height: 80 },
					},
				],
			}),
		)
		expect(getAssociatedContentData).toHaveBeenCalled()
		controller.destroy()
	})

	it("keeps the output structure when one submission fails", async () => {
		const storyboard = createStoryboard()
		const harness = createHarness({ storyboard, failInitialSubmissionIndex: 1 })
		const controller = new StoryboardGenerationController(harness.canvas, async () => [
			harness.model,
		])

		await controller.generateAll(harness.storyboard.id)
		expect(harness.frameCount()).toBe(1)
		expect(harness.connections).toHaveLength(2)
		expect(
			getStoryboardContent(harness.storyboard).shots?.every(
				(shot) => shot.outputImageElementId,
			),
		).toBe(true)
		controller.destroy()
	})
})
