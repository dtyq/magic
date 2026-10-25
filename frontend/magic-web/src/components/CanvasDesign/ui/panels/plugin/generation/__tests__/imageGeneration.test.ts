import { describe, expect, it, vi } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../../public/__tests__/testResourceReferenceResolver"

const { start, generateImages, ImageBatchPollingManagerMock } = vi.hoisted(() => {
	const start = vi.fn()
	const generateImages = vi.fn()
	const ImageBatchPollingManagerMock = vi.fn().mockImplementation(() => ({
		start,
	}))

	return {
		start,
		generateImages,
		ImageBatchPollingManagerMock,
	}
})

vi.mock("../../../../../runtime/shared/placement/elementUtils", () => ({
	withHistoryManagerAsync: async (_historyManager: unknown, callback: () => Promise<unknown>) =>
		callback(),
	// 固定视口与中心点，保证落点算法在单测里输出稳定坐标。
	getCanvasCenter: () => ({ x: 1500, y: 1000 }),
	getResolvedMediaPlacementConfig: () => ({
		spacing: 200,
		maxPerRow: 6,
		maxSearchRings: 4,
	}),
	getViewportCanvasRect: () => ({
		x: 0,
		y: 0,
		width: 3200,
		height: 2200,
	}),
}))

vi.mock("../../../../../runtime/resources/polling/ImageBatchPollingManager", () => ({
	ImageBatchPollingManager: ImageBatchPollingManagerMock,
}))

import { generatePluginImages } from "../imageGeneration"
import type { Canvas } from "../../../../../runtime/core/Canvas"
import { GenerationRuntimeManager } from "../../../../../runtime/generation/GenerationRuntimeManager"
import { GenerationAttemptCoordinator } from "../../../../../runtime/generation/GenerationAttemptCoordinator"
import type { ImageElementContent } from "../../../../../runtime/document/types"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

function imageFixture(
	id: string,
	content: Partial<ImageElementContent> = {},
	element: Record<string, unknown> = {},
) {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "image",
		x: 0,
		y: 0,
		width: 1024,
		height: 1024,
		visible: true,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId, ...content }],
		...element,
	}
}

function createCanvas({
	maxOutputImages = 4,
	modelId = "model-a",
}: {
	maxOutputImages?: number
	modelId?: string
} = {}) {
	const createImageElementsNearViewport = vi.fn((count: number) =>
		Array.from({ length: count }, (_, index) => `element-${index + 1}`),
	)
	// 新落点链路会先算 positions，再按左上角坐标批量创建占位图。
	const createImageElementsAtPositions = vi.fn((positions: Array<{ x: number; y: number }>) =>
		positions.map((_, index) => `element-${index + 1}`),
	)
	const resolveImageElementSize = vi.fn((width?: number, height?: number) => ({
		width: width ?? 1024,
		height: height ?? 1024,
	}))
	const commitGenerationTargets = vi.fn()
	const deleteElement = vi.fn()
	const batchDelete = vi.fn((elementIds: string[]) => {
		elementIds.forEach((elementId) => {
			deleteElement(elementId)
			generationRuntimeManager.clearElement(elementId)
		})
	})
	const emit = vi.fn()
	const select = vi.fn()
	const focusOnElements = vi.fn()
	const imageBatchPollingRegistry = {
		track: vi.fn(),
		untrack: vi.fn(),
		destroy: vi.fn(),
	}
	const generationRuntimeManager = new GenerationRuntimeManager()
	const beginAttempt = vi.spyOn(generationRuntimeManager, "beginAttempt")
	const canvas = {
		can: vi.fn(() => true),
		historyManager: null,
		magicConfigManager: {
			config: {
				methods: {
					generateImage: vi.fn(),
					generateImages,
					getImageGenerationResults: vi.fn(),
					resolveResourceReference: resolveDesignAResourceReference,
					getImageModelList: vi.fn().mockResolvedValue([
						{
							model_id: modelId,
							model_name: "Model A",
							model_icon: "",
							model_description: "",
							image_size_config: {
								max_output_images: maxOutputImages,
								max_reference_images: 3,
								sizes: [{ label: "1:1", value: "1024x1024", scale: "1K" }],
							},
						},
					]),
				},
			},
		},
		toolManager: {
			getImageGeneratorTool: () => ({
				createImageElementsNearViewport,
				createImageElementsAtPositions,
				resolveImageElementSize,
			}),
		},
		elementManager: {
			getAllElements: vi.fn(() => []),
			getElementData: vi.fn((elementId: string) =>
				elementId.startsWith("element-") ? imageFixture(elementId) : undefined,
			),
			hasElement: vi.fn(() => true),
			getTemporaryElementMetadata: vi.fn((elementId: string) =>
				elementId.startsWith("element-")
					? {
							kind: "generation-result",
							historyPolicy: "exclude",
							clipboardPolicy: "exclude",
						}
					: null,
			),
			commitGenerationTargets,
			delete: deleteElement,
			batchDelete,
		},
		generationRuntimeManager,
		permissionManager: {
			can: vi.fn(() => true),
			isVisible: vi.fn((element) => element.visible !== false),
		},
		selectionManager: {
			select,
			getSelectedIds: vi.fn(() => []),
		},
		viewportController: {
			focusOnElements,
		},
		eventEmitter: {
			emit,
		},
		imageBatchPollingRegistry,
	} as unknown as Canvas
	canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)

	return Object.assign(canvas, {
		__spies: {
			createImageElementsNearViewport,
			createImageElementsAtPositions,
			resolveImageElementSize,
			beginAttempt,
			commitGenerationTargets,
			deleteElement,
			batchDelete,
			select,
			focusOnElements,
			emit,
			imageBatchPollingRegistry,
		},
	})
}

describe("imageGeneration", () => {
	it("requires document write in addition to generation capability", async () => {
		const canvas = createCanvas()
		canvas.permissionManager.can = vi.fn(
			(capability: string) => capability !== "document.write",
		)

		await expect(
			generatePluginImages(canvas as never, {
				model_id: "model-a",
				prompt: "Generate",
			}),
		).rejects.toThrow("Canvas does not allow document generation.")
		expect(generateImages).not.toHaveBeenCalled()
		expect(canvas.__spies.createImageElementsAtPositions).not.toHaveBeenCalled()
	})

	it("creates one batch task, then fills placeholders from multi-image results", async () => {
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()

		generateImages.mockResolvedValue({
			project_id: "project-1",
			image_id: "batch-1",
			model_id: "model-a",
			prompt: "Generate",
			size: "1024x1024",
			resolution: "1K",
			file_dir: "/images/",
			generate_num: 3,
			status: "processing",
			error_message: null,
			images: [],
		})

		const result = await generatePluginImages(canvas as never, {
			model_id: "model-a",
			prompt: "Generate",
			size: "1024x1024",
			count: 3,
			select: true,
		})

		expect(canvas.__spies.resolveImageElementSize).toHaveBeenCalledWith(1024, 1024)
		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
			]),
			1024,
			1024,
			{ temporary: true },
		)
		expect(generateImages).toHaveBeenCalledTimes(1)
		expect(generateImages).toHaveBeenCalledWith(
			expect.objectContaining({
				model_id: "model-a",
				prompt: "Generate",
				size: "1024x1024",
				generate_num: 3,
			}),
		)
		const batchImageId = generateImages.mock.calls[0]?.[0]?.image_id
		expect(ImageBatchPollingManagerMock).toHaveBeenCalledWith({
			canvas,
			imageId: batchImageId,
			elementIds: ["element-1", "element-2", "element-3"],
			contentIds: ["element-1-content-1", "element-2-content-1", "element-3-content-1"],
			registry: canvas.imageBatchPollingRegistry,
		})
		expect(start).toHaveBeenCalledWith()
		expect(canvas.__spies.select).toHaveBeenCalledWith("element-3")
		expect(result).toEqual({ elementIds: ["element-1", "element-2", "element-3"] })
		expect(start).toHaveBeenCalledTimes(1)
		expect(canvas.__spies.beginAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: "image-batch",
				failurePolicy: "remove-placeholder",
				targets: expect.arrayContaining([
					expect.objectContaining({
						elementId: "element-1",
						contentId: "element-1-content-1",
						generateImageRequest: expect.objectContaining({
							image_id: batchImageId,
							model_id: "model-a",
							prompt: "Generate",
							size: "1024x1024",
						}),
						imageGenerationTaskMeta: expect.objectContaining({
							image_id: batchImageId,
							output_index: 1,
							output_count: 3,
						}),
					}),
				]),
			}),
		)
		expect(batchImageId).toBeTruthy()
		expect(canvas.__spies.commitGenerationTargets).toHaveBeenCalledTimes(1)
		expect(canvas.__spies.commitGenerationTargets).toHaveBeenCalledWith([
			{
				elementId: "element-1",
				contentId: "element-1-content-1",
				persistedPatch: expect.objectContaining({
					contents: [
						expect.objectContaining({
							status: "processing",
							generateImageRequest: expect.objectContaining({
								model_id: "model-a",
								prompt: "Generate",
							}),
							imageGenerationTaskMeta: expect.objectContaining({
								image_id: batchImageId,
								output_index: 1,
							}),
						}),
					],
				}),
			},
			expect.objectContaining({ elementId: "element-2" }),
			expect.objectContaining({ elementId: "element-3" }),
		])
	})

	it("deletes all temporary placeholders when batch submission fails", async () => {
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		generateImages.mockRejectedValue(new Error("submit failed"))

		await expect(
			generatePluginImages(canvas as never, {
				model_id: "model-a",
				prompt: "Generate",
				size: "1024x1024",
				count: 3,
			}),
		).rejects.toThrow("submit failed")

		expect(canvas.__spies.deleteElement).toHaveBeenCalledTimes(3)
		expect(canvas.__spies.deleteElement).toHaveBeenCalledWith("element-1")
		expect(canvas.__spies.deleteElement).toHaveBeenCalledWith("element-2")
		expect(canvas.__spies.deleteElement).toHaveBeenCalledWith("element-3")
		expect(canvas.__spies.commitGenerationTargets).not.toHaveBeenCalled()
		expect(ImageBatchPollingManagerMock).not.toHaveBeenCalled()
	})

	it("does not delete a placeholder already owned by a newer attempt", async () => {
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		let rejectSubmission: ((reason?: unknown) => void) | undefined
		generateImages.mockImplementation(
			() =>
				new Promise((_, reject) => {
					rejectSubmission = reject
				}),
		)

		const generationPromise = generatePluginImages(canvas as never, {
			model_id: "model-a",
			prompt: "Generate",
			size: "1024x1024",
			count: 3,
		})
		await vi.waitFor(() => {
			expect(canvas.__spies.beginAttempt).toHaveBeenCalled()
		})
		// The runtime manager rejects concurrent attempts for the same Content;
		// clear the older ownership before installing the newer attempt used by
		// this cleanup-ownership scenario.
		canvas.generationRuntimeManager.clearElement("element-1")
		canvas.generationRuntimeManager.beginAttempt({
			attemptId: "newer-attempt",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "element-1", contentId: "element-1-content-1" }],
		})
		rejectSubmission?.(new Error("submit failed"))

		await expect(generationPromise).rejects.toThrow("submit failed")
		expect(canvas.__spies.deleteElement).not.toHaveBeenCalledWith("element-1")
		expect(canvas.__spies.deleteElement).toHaveBeenCalledWith("element-2")
		expect(canvas.__spies.deleteElement).toHaveBeenCalledWith("element-3")
		expect(canvas.generationRuntimeManager.getTargetState("element-1")?.attemptId).toBe(
			"newer-attempt",
		)
	})

	it("places plugin results to the right of the matched reference image", async () => {
		// 来源映射命中时，生成结果应优先贴在来源图右侧。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"source-image",
				{ src: "./images/source.png" },
				{
					x: 100,
					y: 120,
					width: 400,
					height: 300,
				},
			),
		])
		canvas.elementManager.getElementData.mockImplementation((elementId: string) =>
			elementId === "source-image"
				? canvas.elementManager.getAllElements()[0]
				: elementId.startsWith("element-")
					? imageFixture(elementId)
					: undefined,
		)
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(
			canvas as never,
			{
				model_id: "model-a",
				prompt: "Generate",
				size: "1024x1024",
				count: 1,
				reference_images: ["./images/source.png"],
			},
			{
				sourceElementByAssetKey: new Map([["./images/source.png", "source-image"]]),
			},
		)

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 700, y: 120 }],
			1024,
			1024,
			{ temporary: true },
		)
		expect(canvas.__spies.select).toHaveBeenCalledWith("element-1")
	})

	it("falls back to the selected source image when reference keys are not mapped", async () => {
		// 插件没有传回可匹配 key 时，当前选中的非生成图片作为来源图兜底。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"source-image",
				{ src: "./images/source.png" },
				{
					x: 100,
					y: 120,
					width: 400,
					height: 300,
				},
			),
		])
		canvas.elementManager.getElementData.mockImplementation((elementId: string) =>
			elementId === "source-image"
				? canvas.elementManager.getAllElements()[0]
				: elementId.startsWith("element-")
					? imageFixture(elementId)
					: undefined,
		)
		canvas.selectionManager.getSelectedIds.mockReturnValue(["source-image"])
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(canvas as never, {
			model_id: "model-a",
			prompt: "Generate",
			size: "1024x1024",
			count: 1,
			reference_image_options: [{ path: "./images/unmapped-source.png" }],
		})

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 700, y: 120 }],
			1024,
			1024,
			{ temporary: true },
		)
	})

	it("continues the existing grid before falling back to source-right placement", async () => {
		// 有同组历史输出时，先续接历史网格；没有历史输出时才回到来源图右侧。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		const previousRequest = {
			model_id: "model-a",
			prompt: "Old internal prompt template",
			size: "1000x1000",
			aspect_ratio: "9:16",
			reference_images: ["./images/source.png"],
		}
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"source-image",
				{ src: "./images/source.png" },
				{
					x: 100,
					y: 120,
					width: 400,
					height: 300,
				},
			),
			imageFixture(
				"generated-output",
				{ generateImageRequest: previousRequest },
				{
					x: 700,
					y: 1344,
					width: 1152,
					height: 2048,
				},
			),
		])
		canvas.elementManager.getElementData.mockImplementation((elementId: string) =>
			elementId === "source-image"
				? canvas.elementManager.getAllElements()[0]
				: elementId.startsWith("element-")
					? imageFixture(elementId)
					: undefined,
		)
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(
			canvas as never,
			{
				model_id: "model-b",
				prompt: "Generate",
				size: "1080x1920",
				aspect_ratio: "9:16",
				count: 1,
				reference_images: ["./images/source.png"],
			},
			{
				sourceElementByAssetKey: new Map([["./images/source.png", "source-image"]]),
			},
		)

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 2052, y: 1344 }],
			1080,
			1920,
			{ temporary: true },
		)
		expect(generateImages).toHaveBeenCalledWith(
			expect.objectContaining({
				aspect_ratio: "9:16",
			}),
		)
	})

	it("continues the existing grid before falling back to source-right placement", async () => {
		// 有同组历史输出时，先续接历史网格；没有历史输出时才回到来源图右侧。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		const previousRequest = {
			model_id: "model-a",
			prompt: "Old internal prompt template",
			size: "1000x1000",
			aspect_ratio: "9:16",
			reference_images: ["./images/source.png"],
		}
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"source-image",
				{ src: "./images/source.png" },
				{
					x: 100,
					y: 120,
					width: 400,
					height: 300,
				},
			),
			imageFixture(
				"generated-output",
				{ generateImageRequest: previousRequest },
				{
					x: 700,
					y: 1344,
					width: 1152,
					height: 2048,
				},
			),
		])
		canvas.elementManager.getElementData.mockImplementation((elementId: string) =>
			elementId === "source-image"
				? canvas.elementManager.getAllElements()[0]
				: elementId.startsWith("element-")
					? imageFixture(elementId)
					: undefined,
		)
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(
			canvas as never,
			{
				model_id: "model-b",
				prompt: "Generate",
				size: "1080x1920",
				aspect_ratio: "9:16",
				count: 1,
				reference_images: ["./images/source.png"],
			},
			{
				sourceElementByAssetKey: new Map([["./images/source.png", "source-image"]]),
			},
		)

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 2052, y: 1344 }],
			1080,
			1920,
			{ temporary: true },
		)
		expect(generateImages).toHaveBeenCalledWith(
			expect.objectContaining({
				aspect_ratio: "9:16",
			}),
		)
	})

	it("does not use a selected generated image as the source fallback", async () => {
		// 选中的生成产物不能作为下一次来源，否则结果会一代一代偏移。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"generated-output",
				{
					src: "./images/generated.png",
					generateImageRequest: { model_id: "model-a", prompt: "previous" },
				},
				{ x: 100, y: 120, width: 400, height: 300 },
			),
		])
		canvas.elementManager.getElementData.mockImplementation((elementId: string) =>
			elementId === "generated-output"
				? canvas.elementManager.getAllElements()[0]
				: elementId.startsWith("element-")
					? imageFixture(elementId)
					: undefined,
		)
		canvas.selectionManager.getSelectedIds.mockReturnValue(["generated-output"])
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(canvas as never, {
			model_id: "model-a",
			prompt: "Generate",
			size: "1024x1024",
			count: 1,
			reference_image_options: [{ path: "./images/unmapped-source.png" }],
		})

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 988, y: 488 }],
			1024,
			1024,
			{ temporary: true },
		)
	})

	it("continues the existing generated grid when the reference image is not on canvas", async () => {
		// 外部引用图不在画布上时，同配置再次生成要接在已有输出网格之后；prompt/model 不参与排布分组。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		const previousRequest = {
			model_id: "model-a",
			prompt: "Old prompt",
			size: "1024x1024",
			reference_image_options: [{ path: "./images/external-source.png" }],
		}
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"generated-output-1",
				{ generateImageRequest: previousRequest },
				{
					x: 100,
					y: 120,
				},
			),
			imageFixture(
				"generated-output-2",
				{ generateImageRequest: previousRequest },
				{
					x: 1324,
					y: 120,
				},
			),
		])
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(canvas as never, {
			model_id: "model-b",
			prompt: "Generate",
			size: "1024x1024",
			count: 1,
			reference_image_options: [{ path: "/画布A/images/external-source.png" }],
		})

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 2548, y: 120 }],
			1024,
			1024,
			{ temporary: true },
		)
	})

	it("continues the previous grid when only aspect ratio changes", async () => {
		// 只改 aspect ratio 时，也应接着上一批生成结果续排，保持同一组。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		const previousRequest = {
			model_id: "model-a",
			prompt: "Old prompt",
			size: "1024x1024",
			aspect_ratio: "1:1",
			reference_image_options: [{ path: "./images/external-source.png" }],
		}
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"generated-output-1",
				{ generateImageRequest: previousRequest },
				{
					x: 100,
					y: 120,
				},
			),
			imageFixture(
				"generated-output-2",
				{ generateImageRequest: previousRequest },
				{
					x: 1324,
					y: 120,
				},
			),
		])
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(canvas as never, {
			model_id: "model-b",
			prompt: "Generate",
			size: "1024x1024",
			aspect_ratio: "9:16",
			count: 1,
			reference_image_options: [{ path: "/画布A/images/external-source.png" }],
		})

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 2548, y: 120 }],
			1024,
			1024,
			{ temporary: true },
		)
	})

	it("continues the previous grid when only aspect ratio changes", async () => {
		// 只改 aspect ratio 时，也应接着上一批生成结果续排，保持同一组。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		const previousRequest = {
			model_id: "model-a",
			prompt: "Old prompt",
			size: "1024x1024",
			aspect_ratio: "1:1",
			reference_image_options: [{ path: "./images/external-source.png" }],
		}
		canvas.elementManager.getAllElements.mockReturnValue([
			imageFixture(
				"generated-output-1",
				{ generateImageRequest: previousRequest },
				{
					x: 100,
					y: 120,
				},
			),
			imageFixture(
				"generated-output-2",
				{ generateImageRequest: previousRequest },
				{
					x: 1324,
					y: 120,
				},
			),
		])
		generateImages.mockResolvedValue({ image_id: "batch-1" })

		await generatePluginImages(canvas as never, {
			model_id: "model-b",
			prompt: "Generate",
			size: "1024x1024",
			aspect_ratio: "9:16",
			count: 1,
			reference_image_options: [{ path: "/画布A/images/external-source.png" }],
		})

		expect(canvas.__spies.createImageElementsAtPositions).toHaveBeenCalledWith(
			[{ x: 2548, y: 120 }],
			1024,
			1024,
			{ temporary: true },
		)
	})

	it("selects the last generated element even when plugin disables selection", async () => {
		// 插件生成结果始终选中最后一张；select=false 不再阻止宿主选中新结果。
		const canvas = createCanvas({ maxOutputImages: 4 })
		generateImages.mockReset()
		start.mockReset()
		ImageBatchPollingManagerMock.mockClear()
		generateImages.mockResolvedValue({ image_id: "batch-1" })
		const originalRequestAnimationFrame = globalThis.requestAnimationFrame
		globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0)
			return 1
		}) as typeof requestAnimationFrame

		try {
			await generatePluginImages(canvas as never, {
				model_id: "model-a",
				prompt: "Generate",
				size: "1024x1024",
				count: 2,
				select: false,
			})
		} finally {
			globalThis.requestAnimationFrame = originalRequestAnimationFrame
		}

		expect(canvas.__spies.select).toHaveBeenCalledWith("element-2")
		expect(canvas.__spies.focusOnElements).toHaveBeenCalledWith(["element-1", "element-2"], {
			animated: true,
			panOnly: true,
			selectElement: ["element-2"],
			ensureFullyVisible: true,
		})
	})
})
