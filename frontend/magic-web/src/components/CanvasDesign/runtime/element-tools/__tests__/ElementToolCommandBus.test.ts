import { describe, expect, it, vi } from "vitest"
import type { CanvasAccessContext, CanvasCapability, CanvasAccessMode } from "../../../public/props"
import { ElementToolTypeEnum } from "../../../public/props"
import { authorizeCanvasTool, type CanvasAuthorizationResult } from "../../core/CanvasAccessPolicy"
import { CanvasElementToolCommandBus } from "../commands/ElementToolCommandBus"

type TestAccessContext = CanvasAccessContext

function createCanvas() {
	const accessContext: TestAccessContext = {
		mode: "edit",
		capabilities: new Set(),
		can: () => true,
	}
	const image: {
		id: string
		type: string
		activeContentId: string
		mainContentId: string
		contents: Array<{ contentId: string; src?: string; revision?: number }>
	} = {
		id: "image-1",
		type: "image",
		activeContentId: "content-a",
		mainContentId: "content-a",
		contents: [{ contentId: "content-a", src: "a.png" }],
	}
	const operations = {
		switchActiveContent: vi.fn(),
		setMainContent: vi.fn(),
		deleteActiveContent: vi.fn(),
	}
	const textElement = {
		id: "text-1",
		type: "text",
		activeContentId: "text-content",
		mainContentId: "text-content",
		contents: [{ contentId: "text-content", content: [] }],
	}
	const textFormattingManager = {
		getToolbarState: vi.fn(() => ({ selectedTextElement: textElement })),
		setFillColor: vi.fn(),
		setFontFamily: vi.fn(),
		setFontSize: vi.fn(),
		setTextAlign: vi.fn(),
		setBold: vi.fn(),
		setItalic: vi.fn(),
		setFontWeight: vi.fn(),
		setUnderline: vi.fn(),
		setStrikethrough: vi.fn(),
		setLineHeight: vi.fn(),
		setLetterSpacing: vi.fn(),
		setListType: vi.fn(),
	}
	const canvas = {
		image,
		textElement,
		elementManager: {
			getElementData: vi.fn<() => unknown>(() => image),
			getElementInstance: vi.fn(() => operations),
			update: vi.fn(),
		},
		generationRuntimeManager: { isCurrent: vi.fn(() => true) },
		userActionRegistry: { canExecute: vi.fn(() => true), execute: vi.fn() },
		textFormattingManager,
		permissionManager: {
			can: (capability: CanvasCapability) => accessContext.can(capability),
			getContext: () => accessContext,
			authorizeTool: (definition: Parameters<typeof authorizeCanvasTool>[1]) =>
				authorizeCanvasTool(accessContext, definition),
		},
		eventEmitter: { emit: vi.fn() },
		cropManager: { enterCropMode: vi.fn() },
		extendManager: { enterExtendMode: vi.fn() },
		eraserManager: { enterEraserMode: vi.fn() },
	}
	return canvas
}

describe("CanvasElementToolCommandBus", () => {
	it("executes a command against its captured Content target", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		const execute = vi.fn()
		bus.register({ elementId: "image-1", toolId: ElementToolTypeEnum.ContentCrop }, execute, {
			available: true,
		})

		bus.execute({
			toolId: ElementToolTypeEnum.ContentCrop,
			elementId: "image-1",
			contentId: "content-a",
		})
		expect(execute).toHaveBeenCalledWith({
			toolId: ElementToolTypeEnum.ContentCrop,
			elementId: "image-1",
			contentId: "content-a",
		})
	})

	it("returns a structured result when a command target is unavailable", () => {
		const canvas = createCanvas()
		canvas.elementManager.getElementData = vi.fn(() => undefined)
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.ContentDownload,
				elementId: "deleted-image",
				contentId: "content-a",
			}),
		).toEqual({ executed: false, reason: "ELEMENT_NOT_FOUND" })
	})

	it("rejects commands when the declared capability is unavailable", () => {
		const canvas = createCanvas()
		canvas.permissionManager.getContext = vi.fn<() => TestAccessContext>(() => ({
			mode: "readonly" as CanvasAccessMode,
			capabilities: new Set<CanvasCapability>(),
			can: () => false,
		}))
		canvas.permissionManager.can = vi.fn(() => false)
		canvas.permissionManager.authorizeTool = vi.fn<
			(definition: Parameters<typeof authorizeCanvasTool>[1]) => CanvasAuthorizationResult
		>(() => ({
			allowed: false,
			reason: "CAPABILITY_REQUIRED",
			requiredCapability: "document.write",
		}))
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.ContentCrop,
				elementId: "image-1",
				contentId: "content-a",
			}),
		).toEqual({
			executed: false,
			reason: "CAPABILITY_REQUIRED",
			requiredCapability: "document.write",
		})
	})

	it("drops commands for deleted Content and stale generation attempts", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		const execute = vi.fn()
		bus.register({ elementId: "image-1", toolId: ElementToolTypeEnum.ContentCrop }, execute)

		canvas.image.contents = []
		bus.execute({
			toolId: ElementToolTypeEnum.ContentCrop,
			elementId: "image-1",
			contentId: "content-a",
		})
		expect(execute).not.toHaveBeenCalled()

		canvas.image.contents = [{ contentId: "content-a", src: "a.png" }]
		canvas.generationRuntimeManager.isCurrent = vi.fn(() => false)
		bus.execute({
			toolId: ElementToolTypeEnum.GenerationGenerateAgain,
			elementId: "image-1",
			contentId: "content-a",
			generationId: "stale-generation",
		})
		expect(execute).not.toHaveBeenCalled()
	})

	it("does not delete a different active Content from a stale version command", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		canvas.image.activeContentId = "content-b"
		const operations = canvas.elementManager.getElementInstance()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.VersionDelete,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(operations.deleteActiveContent).not.toHaveBeenCalled()
	})

	it("returns a structured result for a stale version target", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		canvas.image.activeContentId = "content-b"
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.VersionDelete,
				elementId: "image-1",
				contentId: "content-a",
			}),
		).toEqual({ executed: false, reason: "ACTIVE_CONTENT_MISMATCH" })
	})

	it("allows deleting an active processing version", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b" },
		]
		canvas.image.activeContentId = "content-b"
		;(canvas.image.contents[1] as { status?: string }).status = "processing"
		const operations = canvas.elementManager.getElementInstance()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.VersionDelete,
				elementId: "image-1",
				contentId: "content-b",
			}),
		).toEqual({ executed: true })
		expect(operations.deleteActiveContent).toHaveBeenCalledOnce()
	})

	it("uses session preview for version navigation outside edit mode", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		const previewCanvas = canvas as typeof canvas & {
			setPreviewContent: ReturnType<typeof vi.fn>
		}
		const setPreviewContent = vi.fn()
		previewCanvas.setPreviewContent = setPreviewContent
		previewCanvas.permissionManager.getContext = vi.fn<() => TestAccessContext>(() => ({
			mode: "share",
			capabilities: new Set<CanvasCapability>(["interaction.switchContent"]),
			can: (capability: CanvasCapability) => capability === "interaction.switchContent",
		}))
		previewCanvas.permissionManager.can = vi.fn(
			(capability: CanvasCapability) => capability === "interaction.switchContent",
		)
		previewCanvas.permissionManager.authorizeTool = vi.fn(
			(definition: Parameters<typeof authorizeCanvasTool>[1]) => ({
				allowed:
					definition.requiredCapability === "interaction.switchContent" ||
					definition.requiredCapability === "document.read",
			}),
		)
		const bus = new CanvasElementToolCommandBus(previewCanvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.VersionNext,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(setPreviewContent).toHaveBeenCalledWith("image-1", "content-b")
		expect(canvas.image.activeContentId).toBe("content-a")
	})

	it("reports an unavailable target when version navigation is already at the boundary", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.VersionPrevious,
				elementId: "image-1",
				contentId: "content-a",
			}),
		).toEqual({ executed: false, reason: "TARGET_UNAVAILABLE" })
		expect(
			canvas.elementManager.getElementInstance().switchActiveContent,
		).not.toHaveBeenCalled()
	})

	it("reports an unavailable target when a generation fallback has no media route", () => {
		const canvas = createCanvas()
		canvas.elementManager.getElementData = vi.fn(() => canvas.textElement)
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				elementId: "text-1",
				contentId: "text-content",
			}),
		).toEqual({ executed: false, reason: "TARGET_UNAVAILABLE" })
		expect(canvas.eventEmitter.emit).not.toHaveBeenCalled()
	})

	it("routes an unmounted generation editor through a target-safe fallback event", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.GenerationGenerateAgain,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "element:image:toolCommand",
			data: {
				elementId: "image-1",
				contentId: "content-a",
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
			},
		})
	})

	it.each([
		[ElementToolTypeEnum.FrameCreate, "frame.create"],
		[ElementToolTypeEnum.FrameRemove, "frame.remove"],
	])("routes %s through its UserAction fallback", (toolId, actionId) => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId,
			elementId: "image-1",
		})

		expect(canvas.userActionRegistry.canExecute).toHaveBeenCalledWith(actionId)
		expect(canvas.userActionRegistry.execute).toHaveBeenCalledWith(actionId, {})
	})

	it("returns a structured result when an action fallback is unavailable", () => {
		const canvas = createCanvas()
		canvas.userActionRegistry.canExecute = vi.fn(() => false)
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.FrameCreate,
				elementId: "image-1",
			}),
		).toEqual({ executed: false, reason: "ACTION_UNAVAILABLE" })
		expect(canvas.userActionRegistry.execute).not.toHaveBeenCalled()
	})

	it("returns a structured result for an invalid element fallback payload", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		expect(
			bus.execute({
				toolId: ElementToolTypeEnum.ElementResize,
				elementId: "image-1",
			}),
		).toEqual({ executed: false, reason: "INVALID_PAYLOAD" })
		expect(canvas.elementManager.update).not.toHaveBeenCalled()
	})

	it("does not query UserActionRegistry with an undefined action id", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.ContentEnhance,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(canvas.userActionRegistry.canExecute).not.toHaveBeenCalledWith(undefined)
		expect(canvas.userActionRegistry.execute).not.toHaveBeenCalled()
	})

	it("drops a generation fallback after the active Content changed", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		canvas.image.activeContentId = "content-b"
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.GenerationQuickEdit,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(canvas.eventEmitter.emit).not.toHaveBeenCalled()
	})

	it("passes the captured Content target into image editing sessions", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.ContentCrop,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(canvas.cropManager.enterCropMode).toHaveBeenCalledWith("image-1", "content-a")
	})

	it("updates dimensions for image and video media original size commands", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		bus.execute({
			toolId: ElementToolTypeEnum.ContentMediaOriginalSize,
			elementId: "image-1",
			contentId: "content-a",
			payload: { width: 300, height: 200 },
		})
		expect(canvas.elementManager.update).toHaveBeenCalledWith("image-1", {
			width: 300,
			height: 200,
		})

		const video = { ...canvas.image, id: "video-1", type: "video" }
		canvas.elementManager.getElementData = vi.fn(() => video)
		bus.execute({
			toolId: ElementToolTypeEnum.ContentMediaOriginalSize,
			elementId: "video-1",
			contentId: "content-a",
			payload: { width: 400, height: 225 },
		})
		expect(canvas.elementManager.update).toHaveBeenLastCalledWith("video-1", {
			width: 400,
			height: 225,
		})
	})

	it("drops a stale active-content download command", () => {
		const canvas = createCanvas()
		canvas.image.contents = [
			{ contentId: "content-a", src: "a.png" },
			{ contentId: "content-b", src: "b.png" },
		]
		canvas.image.activeContentId = "content-b"
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.ContentDownload,
			elementId: "image-1",
			contentId: "content-a",
		})

		expect(canvas.userActionRegistry.execute).not.toHaveBeenCalled()
	})

	it("isolates registered runtime state by Content target", () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		bus.register(
			{
				elementId: "image-1",
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				contentId: "content-a",
			},
			vi.fn(),
			{ loading: true },
		)
		bus.register(
			{
				elementId: "image-1",
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				contentId: "content-b",
			},
			vi.fn(),
			{ disabled: true },
		)

		expect(
			bus
				.getElementToolStates("image-1", "content-a")
				.get(ElementToolTypeEnum.GenerationGenerateAgain),
		).toEqual(expect.objectContaining({ loading: true }))
		expect(
			bus
				.getElementToolStates("image-1", "content-b")
				.get(ElementToolTypeEnum.GenerationGenerateAgain),
		).toEqual(expect.objectContaining({ disabled: true }))
	})

	it("coalesces registration notifications and ignores handler-only refreshes", async () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		const listener = vi.fn()
		bus.subscribeElement("image-1", "content-a", listener)

		bus.register(
			{
				elementId: "image-1",
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				contentId: "content-a",
			},
			vi.fn(),
			{ available: true },
		)
		bus.register(
			{
				elementId: "image-1",
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				contentId: "content-a",
			},
			vi.fn(),
			{ available: true },
		)

		expect(listener).not.toHaveBeenCalled()
		await Promise.resolve()
		expect(listener).toHaveBeenCalledTimes(1)
	})

	it("publishes a new runtime snapshot when the points estimate changes", async () => {
		const canvas = createCanvas()
		const bus = new CanvasElementToolCommandBus(canvas as never)
		const listener = vi.fn()
		bus.subscribeElement("image-1", "content-a", listener)
		const key = {
			elementId: "image-1",
			toolId: ElementToolTypeEnum.GenerationGenerateFinal,
			contentId: "content-a",
		}

		bus.register(key, vi.fn(), {
			available: true,
			data: {
				videoGenerationEstimate: { resolution: "1080P", points: null },
			},
		})
		await Promise.resolve()
		listener.mockClear()
		bus.register(key, vi.fn(), {
			available: true,
			data: {
				videoGenerationEstimate: { resolution: "1080P", points: 3190 },
			},
		})
		await Promise.resolve()

		expect(listener).toHaveBeenCalledTimes(1)
		expect(
			bus
				.getElementToolStates("image-1", "content-a")
				.get(ElementToolTypeEnum.GenerationGenerateFinal)?.data,
		).toEqual({
			videoGenerationEstimate: { resolution: "1080P", points: 3190 },
		})
	})

	it("drops a command whose captured Content revision is stale", () => {
		const canvas = createCanvas()
		canvas.image.contents = [{ contentId: "content-a", src: "a.png", revision: 2 }]
		const bus = new CanvasElementToolCommandBus(canvas as never)
		const execute = vi.fn()
		bus.register({ elementId: "image-1", toolId: ElementToolTypeEnum.ContentCrop }, execute)

		bus.execute({
			toolId: ElementToolTypeEnum.ContentCrop,
			elementId: "image-1",
			contentId: "content-a",
			contentRevision: 1,
		})

		expect(execute).not.toHaveBeenCalled()
	})

	it("routes text formatting commands through TextFormattingManager", () => {
		const canvas = createCanvas()
		canvas.elementManager.getElementData = vi.fn(() => canvas.textElement)
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.TextFontSize,
			elementId: "text-1",
			contentId: "text-content",
			payload: { fontSize: 24 },
		})
		bus.execute({
			toolId: ElementToolTypeEnum.TextFontStyle,
			elementId: "text-1",
			contentId: "text-content",
			payload: { bold: true },
		})

		expect(canvas.textFormattingManager.setFontSize).toHaveBeenCalledWith(24)
		expect(canvas.textFormattingManager.setBold).toHaveBeenCalledWith(true)
	})

	it("drops text optimization results after the editing context changes", () => {
		const canvas = createCanvas()
		canvas.elementManager.getElementData = vi.fn(() => canvas.textElement)
		canvas.textFormattingManager.getToolbarState = vi.fn(() => ({
			selectedTextElement: { id: "another-text" },
		}))
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.TextContentOptimization,
			elementId: "text-1",
			contentId: "text-content",
			payload: { action: "apply", content: [{ type: "paragraph", children: [] }] },
		})

		expect(canvas.elementManager.update).not.toHaveBeenCalled()
	})

	it("routes shape updates through the captured element target", () => {
		const canvas = createCanvas()
		const shape = {
			id: "shape-1",
			type: "rectangle",
			contents: [{ contentId: "shape-content" }],
			activeContentId: "shape-content",
		}
		canvas.elementManager.getElementData = vi.fn(() => shape)
		const bus = new CanvasElementToolCommandBus(canvas as never)

		bus.execute({
			toolId: ElementToolTypeEnum.ShapeStyle,
			elementId: "shape-1",
			payload: { updates: { opacity: 0.5, sides: 6 } },
		})

		expect(canvas.elementManager.update).toHaveBeenCalledWith("shape-1", {
			opacity: 0.5,
			sides: 6,
		})
	})
})
