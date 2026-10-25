import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MediaVersionTagDecorator } from "../MediaVersionTagDecorator"

function createEventEmitterMock() {
	const handlers = new Map<string, Array<() => void>>()
	const viewportLayouts = new Map<string, Array<() => void>>()

	return {
		handlers,
		viewportLayouts,
		eventEmitter: {
			on: vi.fn((eventType: string, handler: () => void) => {
				const currentHandlers = handlers.get(eventType) ?? []
				currentHandlers.push(handler)
				handlers.set(eventType, currentHandlers)
				return () => {
					handlers.set(
						eventType,
						(handlers.get(eventType) ?? []).filter((current) => current !== handler),
					)
				}
			}),
			off: vi.fn((eventType: string, handler: () => void) => {
				handlers.set(
					eventType,
					(handlers.get(eventType) ?? []).filter((current) => current !== handler),
				)
			}),
		},
		runtimeScheduler: {
			registerViewportScaleLayout: vi.fn((elementId: string, handler: () => void) => {
				viewportLayouts.set(elementId, [...(viewportLayouts.get(elementId) ?? []), handler])
				return () => {
					viewportLayouts.set(
						elementId,
						(viewportLayouts.get(elementId) ?? []).filter(
							(current) => current !== handler,
						),
					)
				}
			}),
		},
	}
}

function createHarness() {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const stage = new Konva.Stage({ container, width: 600, height: 400 })
	stage.scale({ x: 2, y: 2 })
	const layer = new Konva.Layer()
	stage.add(layer)
	const group = new Konva.Group({ width: 240, height: 160, scaleX: 0.5, scaleY: 0.5 })
	layer.add(group)
	const { eventEmitter, handlers, runtimeScheduler, viewportLayouts } = createEventEmitterMock()
	const canvas = {
		can: vi.fn(() => true),
		permissionManager: { can: vi.fn(() => true) },
		getEffectiveContent: vi.fn(() => ({ contentId: "main" })),
		eventEmitter,
		runtimeScheduler,
		t: vi.fn((_key: string, options: { defaultValue: string }) => options.defaultValue),
	}

	return { canvas, group, handlers, stage, viewportLayouts }
}

function versionedMedia(type: "image" | "video", activeContentId = "main") {
	return {
		id: `${type}-1`,
		type,
		width: 240,
		height: 160,
		activeContentId,
		mainContentId: "main",
		contents: [
			{ contentId: "main", src: `/${type}-main`, status: "completed" },
			{ contentId: "other", src: `/${type}-other`, status: "completed" },
		],
	} as never
}

describe("MediaVersionTagDecorator", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
			measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
			scale: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		document.body.innerHTML = ""
	})

	it.each(["image", "video"] as const)(
		"shows the static main-version tag for a main %s Content",
		(type) => {
			const { canvas, group, stage } = createHarness()
			const decorator = new MediaVersionTagDecorator(group, {
				canvas: canvas as never,
				width: 240,
				height: 160,
				data: versionedMedia(type),
			})

			decorator.create()
			const tag = group.findOne<Konva.Group>(".decorator-media-main-version-tag")

			expect(tag).toBeTruthy()
			expect(tag?.listening()).toBe(false)
			expect(tag?.height()).toBe(24)
			expect(tag?.findOne<Konva.Text>("Text")?.text()).toBe("主版本")

			decorator.destroy()
			stage.destroy()
		},
	)

	it("hides the tag when the active Content is not the main Content", () => {
		const { canvas, group, stage } = createHarness()
		const decorator = new MediaVersionTagDecorator(group, {
			canvas: canvas as never,
			width: 240,
			height: 160,
			data: versionedMedia("image"),
		})

		decorator.create()
		expect(group.findOne(".decorator-media-main-version-tag")).toBeTruthy()
		;(canvas.getEffectiveContent as ReturnType<typeof vi.fn>).mockReturnValue({
			contentId: "other",
		})
		decorator.updateConfig({ data: versionedMedia("image", "other") })
		expect(group.findOne(".decorator-media-main-version-tag")).toBeUndefined()

		decorator.destroy()
		stage.destroy()
	})

	it("keeps the tag at a fixed screen size and hides it below the content threshold", () => {
		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		Konva.autoDrawEnabled = false
		try {
			const { canvas, group, stage, viewportLayouts } = createHarness()
			const decorator = new MediaVersionTagDecorator(group, {
				canvas: canvas as never,
				width: 240,
				height: 160,
				data: versionedMedia("image"),
			})

			decorator.create()
			const tag = group.findOne<Konva.Group>(".decorator-media-main-version-tag")
			const layerDrawSpy = vi.spyOn(group.getLayer() as Konva.Layer, "batchDraw")
			expect(tag?.visible()).toBe(true)

			stage.scale({ x: 0.5, y: 0.5 })
			viewportLayouts.get("image-1")?.[0]?.()
			expect(tag?.visible()).toBe(true)

			stage.scale({ x: 0.3, y: 0.3 })
			viewportLayouts.get("image-1")?.[0]?.()
			expect(tag?.visible()).toBe(false)

			stage.scale({ x: 0.2, y: 0.2 })
			viewportLayouts.get("image-1")?.[0]?.()
			expect(tag?.visible()).toBe(false)

			stage.scale({ x: 2, y: 2 })
			viewportLayouts.get("image-1")?.[0]?.()
			expect(tag?.visible()).toBe(true)
			expect(
				(tag?.height() ?? 0) * (tag?.scaleY() ?? 0) * stage.scaleX() * group.scaleY(),
			).toBeCloseTo(24)
			expect((tag?.x() ?? 0) * stage.scaleX() * group.scaleX()).toBeCloseTo(8)
			expect(layerDrawSpy).not.toHaveBeenCalled()

			decorator.destroy()
			stage.destroy()
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}
	})
})
