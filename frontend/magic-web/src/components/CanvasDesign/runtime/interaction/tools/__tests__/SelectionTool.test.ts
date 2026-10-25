import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import type { LayerElement } from "../../../document/types"
import type { CanvasPointerInput } from "../../input/index"
import { SelectionTool } from "../SelectionTool"

function createTool(node: {
	draggable: () => boolean
	isDragging: () => boolean
	dragDistance: () => number
	startDrag: (options: { evt: MouseEvent }) => void
}) {
	const canvas = {
		contentLayer: {},
		elementManager: {
			getElementInstance: () => ({
				getNode: () => node,
			}),
		},
		inputManager: {
			cancelLongPress: vi.fn(),
		},
	} as unknown as Canvas
	return new SelectionTool({ canvas })
}

function createNode() {
	return {
		draggable: vi.fn(() => true),
		isDragging: vi.fn(() => false),
		dragDistance: vi.fn(() => 3),
		startDrag: vi.fn(),
	}
}

function createConnectionManagerStub() {
	return {
		deselectConnection: vi.fn(),
		findConnectionsInBox: vi.fn(() => []),
		selectConnections: vi.fn(),
	}
}

type SelectionToolPrivate = {
	canvas: Canvas
	activate: () => void
	armPendingDirectDrag: (event: MouseEvent | PointerEvent | TouchEvent, elementId: string) => void
	armPendingMultiSelectionDrag: (
		event: MouseEvent | PointerEvent | TouchEvent,
		elementId: string,
	) => void
	handleTouchDown: (input: CanvasPointerInput) => void
	handlePendingDirectDragInput: (input: CanvasPointerInput) => void
	handleViewportGesture: (event: { data: { active: boolean } }) => void
	tryStartExternalImageDrag: (
		event: MouseEvent | PointerEvent,
		originElementId: string,
		options?: { cancelBubble?: () => void },
	) => boolean
	clearPendingDirectDrag: () => void
	pendingDirectDrag: unknown
	isViewportGestureActive: boolean
}

type SelectionToolBoxPrivate = {
	findElementsInBox: (box: { x: number; y: number; width: number; height: number }) => string[]
	updateSelectionFromBox: (box: { x: number; y: number; width: number; height: number }) => void
	isMultiSelectMode: boolean
}

function createPointerEvent(
	type: string,
	init: MouseEventInit & { pointerId?: number; pointerType?: string },
): PointerEvent {
	const event = new MouseEvent(type, init) as PointerEvent
	Object.defineProperty(event, "pointerId", {
		value: init.pointerId ?? 1,
	})
	Object.defineProperty(event, "pointerType", {
		value: init.pointerType ?? "mouse",
	})
	return event
}

function createPointerInput(
	nativeEvent: PointerEvent,
	client: { x: number; y: number },
	options?: Partial<
		Pick<
			CanvasPointerInput,
			"type" | "pointerType" | "target" | "modifiers" | "activePointerCount"
		>
	>,
): CanvasPointerInput {
	return {
		type: options?.type ?? "move",
		pointerId: nativeEvent.pointerId,
		pointerType: options?.pointerType ?? (nativeEvent.pointerType === "pen" ? "pen" : "touch"),
		button: 0,
		buttons: nativeEvent.buttons,
		client,
		stage: client,
		canvas: client,
		target: options?.target ?? ({} as CanvasPointerInput["target"]),
		modifiers: options?.modifiers ?? {
			shift: false,
			alt: false,
			meta: false,
			ctrl: false,
		},
		activePointerCount: options?.activePointerCount ?? 1,
		nativeEvent,
		konvaEvent: {} as CanvasPointerInput["konvaEvent"],
	}
}

function createKonvaNode(
	id: string,
	parent: CanvasPointerInput["target"] | null = null,
	options?: { name?: string; className?: string },
) {
	return {
		id: () => id,
		name: () => options?.name ?? "",
		getClassName: () => options?.className ?? "Group",
		getParent: () => parent,
		draggable: vi.fn(),
	} as unknown as CanvasPointerInput["target"]
}

function createTouchSelectionTool(options?: {
	canSelect?: boolean
	isSelected?: boolean
	selectionCount?: number
	viewportGestureActive?: boolean
}) {
	const element = {
		id: "element-1",
		type: "rectangle",
	} as LayerElement
	const stage = createKonvaNode("stage")
	const target = createKonvaNode("element-1", stage)
	const canvas = {
		stage,
		contentLayer: {},
		eraserManager: {
			getErasingElementId: () => null,
		},
		elementManager: {
			hasElement: (elementId: string) => elementId === "element-1",
			getElementData: () => element,
			getElementInstance: () => ({
				getNode: () => createNode(),
			}),
		},
		permissionManager: {
			can: vi.fn((capability: string, element?: LayerElement) =>
				capability === "interaction.select" ? (options?.canSelect ?? true) : true,
			),
			canSelect: vi.fn(() => options?.canSelect ?? true),
		},
		selectionManager: {
			isSelected: vi.fn(() => options?.isSelected ?? false),
			getSelectionCount: vi.fn(() => options?.selectionCount ?? 1),
			toggle: vi.fn(),
			replaceSelection: vi.fn(),
			deselectAll: vi.fn(),
		},
		connectionManager: createConnectionManagerStub(),
		inputManager: {
			on: vi.fn(() => vi.fn()),
			cancelLongPress: vi.fn(),
		},
		eventEmitter: {
			on: vi.fn(),
			off: vi.fn(),
		},
		viewportController: {
			isViewportGestureActive: vi.fn(() => options?.viewportGestureActive ?? false),
		},
	} as unknown as Canvas

	return {
		canvas,
		target,
		tool: new SelectionTool({ canvas }) as unknown as SelectionToolPrivate,
	}
}

describe("SelectionTool pending direct drag", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("registers window mouseup and clears pending drag on mouseup", () => {
		const node = createNode()
		const tool = createTool(node) as unknown as SelectionToolPrivate
		const addSpy = vi.spyOn(window, "addEventListener")
		const removeSpy = vi.spyOn(window, "removeEventListener")

		tool.armPendingDirectDrag(
			new MouseEvent("mousedown", {
				clientX: 10,
				clientY: 10,
			}),
			"element-1",
		)

		expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function))
		expect(addSpy).toHaveBeenCalledWith("mouseup", expect.any(Function))

		window.dispatchEvent(new MouseEvent("mouseup"))

		expect(tool.pendingDirectDrag).toBeNull()
		expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function))
		expect(removeSpy).toHaveBeenCalledWith("mouseup", expect.any(Function))
	})

	it("starts dragging after the pointer moves past node dragDistance", () => {
		const node = createNode()
		const tool = createTool(node) as unknown as SelectionToolPrivate

		tool.armPendingDirectDrag(
			new MouseEvent("mousedown", {
				clientX: 0,
				clientY: 0,
			}),
			"element-1",
		)
		window.dispatchEvent(
			new MouseEvent("mousemove", {
				clientX: 10,
				clientY: 0,
				buttons: 1,
			}),
		)

		expect(node.startDrag).toHaveBeenCalledTimes(1)
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("cancels long press when a touch direct drag is armed", () => {
		const node = createNode()
		const tool = createTool(node) as unknown as SelectionToolPrivate

		tool.armPendingDirectDrag(
			createPointerEvent("pointerdown", {
				clientX: 0,
				clientY: 0,
				buttons: 1,
				pointerId: 4,
				pointerType: "touch",
			}),
			"element-1",
		)

		expect(tool.canvas.inputManager.cancelLongPress).toHaveBeenCalledTimes(1)
	})

	it("uses input pointer moves and an 8px minimum threshold for touch direct drag", () => {
		const node = createNode()
		const tool = createTool(node) as unknown as SelectionToolPrivate

		tool.armPendingDirectDrag(
			createPointerEvent("pointerdown", {
				clientX: 0,
				clientY: 0,
				buttons: 1,
				pointerId: 4,
				pointerType: "touch",
			}),
			"element-1",
		)
		window.dispatchEvent(
			new MouseEvent("mousemove", {
				clientX: 20,
				clientY: 0,
				buttons: 1,
			}),
		)
		expect(node.startDrag).not.toHaveBeenCalled()

		tool.handlePendingDirectDragInput(
			createPointerInput(
				createPointerEvent("pointermove", {
					clientX: 7,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
				}),
				{ x: 7, y: 0 },
			),
		)
		expect(node.startDrag).not.toHaveBeenCalled()

		const moveEvent = createPointerEvent("pointermove", {
			clientX: 9,
			clientY: 0,
			buttons: 1,
			pointerId: 4,
			pointerType: "touch",
		})
		tool.handlePendingDirectDragInput(createPointerInput(moveEvent, { x: 9, y: 0 }))

		expect(node.startDrag).toHaveBeenCalledWith({ evt: moveEvent })
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("cancels touch pending drag and active element drag when viewport gesture starts", () => {
		const node = {
			...createNode(),
			isDragging: vi.fn(() => false),
			stopDrag: vi.fn(),
		}
		const clearTransformInteractionIntent = vi.fn()
		const cancelActiveTransformDrag = vi.fn()
		const canvas = {
			contentLayer: {},
			elementManager: {
				getElementInstance: () => ({
					getNode: () => node,
				}),
			},
			selectionManager: {
				getSelectedIds: () => ["element-1"],
			},
			transformManager: {
				clearTransformInteractionIntent,
				cancelActiveTransformDrag,
			},
			inputManager: {
				cancelLongPress: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate

		tool.armPendingDirectDrag(
			createPointerEvent("pointerdown", {
				clientX: 0,
				clientY: 0,
				buttons: 1,
				pointerId: 4,
				pointerType: "touch",
			}),
			"element-1",
		)

		expect(tool.pendingDirectDrag).not.toBeNull()

		node.isDragging.mockReturnValue(true)
		tool.handleViewportGesture({ data: { active: true } })

		expect(tool.pendingDirectDrag).toBeNull()
		expect(node.stopDrag).toHaveBeenCalledTimes(1)
		expect(cancelActiveTransformDrag).toHaveBeenCalledTimes(1)
	})

	it("does not arm touch direct drag while viewport gesture is already active", () => {
		const { canvas, target, tool } = createTouchSelectionTool({
			canSelect: true,
			isSelected: false,
			viewportGestureActive: true,
		})

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target,
				},
			),
		)

		expect(canvas.selectionManager.replaceSelection).not.toHaveBeenCalled()
		expect(canvas.inputManager.cancelLongPress).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("syncs viewport gesture state from controller when activated", () => {
		const { tool } = createTouchSelectionTool({ viewportGestureActive: true })

		tool.activate()

		expect(tool.isViewportGestureActive).toBe(true)
	})

	it("tracks external image drags with pointer window events", () => {
		const node = createNode()
		const emit = vi.fn()
		const canvas = {
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			contentLayer: {},
			elementManager: {
				getElementData: () => ({
					id: "image-1",
					type: "image",
					activeContentId: "image-1-content-1",
					mainContentId: "image-1-content-1",
					contents: [{ contentId: "image-1-content-1", src: "oss://image.png" }],
				}),
				getElementInstance: () => ({
					getNode: () => node,
				}),
			},
			selectionManager: {
				getSelectedIds: () => ["image-1"],
				isSelected: () => true,
				replaceSelection: vi.fn(),
			},
			eventEmitter: {
				emit,
			},
			inputManager: {
				cancelLongPress: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate
		const addSpy = vi.spyOn(window, "addEventListener")
		const removeSpy = vi.spyOn(window, "removeEventListener")

		const downEvent = createPointerEvent("pointerdown", {
			altKey: true,
			button: 0,
			buttons: 1,
			clientX: 10,
			clientY: 20,
			pointerId: 9,
			pointerType: "mouse",
		})

		expect(tool.tryStartExternalImageDrag(downEvent, "image-1")).toBe(true)
		expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function))
		expect(addSpy).toHaveBeenCalledWith("pointerup", expect.any(Function))
		expect(addSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function))

		window.dispatchEvent(
			createPointerEvent("pointermove", {
				buttons: 1,
				clientX: 30,
				clientY: 40,
				pointerId: 9,
				pointerType: "mouse",
			}),
		)
		expect(emit).toHaveBeenCalledWith({
			type: "image:external-drag:move",
			data: expect.objectContaining({
				clientX: 30,
				clientY: 40,
				imageElementIds: ["image-1"],
				originElementId: "image-1",
			}),
		})

		window.dispatchEvent(
			createPointerEvent("pointerup", {
				buttons: 0,
				clientX: 50,
				clientY: 60,
				pointerId: 9,
				pointerType: "mouse",
			}),
		)
		expect(emit).toHaveBeenCalledWith({
			type: "image:external-drag:end",
			data: expect.objectContaining({
				clientX: 50,
				clientY: 60,
				cancelled: false,
			}),
		})
		expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function))
		expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function))
		expect(removeSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function))
	})

	it("cancels long press when a touch multi-selection drag is armed", () => {
		const beginTransformInteractionIntent = vi.fn()
		const canvas = {
			contentLayer: {},
			selectionManager: {
				getSelectedIds: () => ["element-1", "element-2"],
			},
			transformManager: {
				beginTransformInteractionIntent,
				clearTransformInteractionIntent: vi.fn(),
			},
			inputManager: {
				cancelLongPress: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate

		tool.armPendingMultiSelectionDrag(
			createPointerEvent("pointerdown", {
				clientX: 0,
				clientY: 0,
				buttons: 1,
				pointerId: 4,
				pointerType: "touch",
			}),
			"element-1",
		)

		expect(canvas.inputManager.cancelLongPress).toHaveBeenCalledTimes(1)
		expect(beginTransformInteractionIntent).toHaveBeenCalledWith(["element-1", "element-2"])
	})

	it("toggles selection for touch modifier input without arming direct drag", () => {
		const { canvas, target, tool } = createTouchSelectionTool({
			canSelect: true,
			isSelected: false,
		})

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
					metaKey: true,
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target,
					modifiers: {
						shift: false,
						alt: false,
						meta: true,
						ctrl: false,
					},
				},
			),
		)

		expect(canvas.selectionManager.toggle).toHaveBeenCalledWith("element-1")
		expect(canvas.selectionManager.replaceSelection).not.toHaveBeenCalled()
		expect(canvas.inputManager.cancelLongPress).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("allows touch modifier deselect for selected elements that cannot be newly selected", () => {
		const { canvas, target, tool } = createTouchSelectionTool({
			canSelect: false,
			isSelected: true,
		})

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
					shiftKey: true,
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target,
					modifiers: {
						shift: true,
						alt: false,
						meta: false,
						ctrl: false,
					},
				},
			),
		)

		expect(canvas.selectionManager.toggle).toHaveBeenCalledWith("element-1")
		expect(canvas.selectionManager.replaceSelection).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("deselects all when touch input starts on blank canvas without modifier", () => {
		const { canvas, tool } = createTouchSelectionTool()

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target: canvas.stage,
				},
			),
		)

		expect(canvas.selectionManager.deselectAll).toHaveBeenCalledTimes(1)
		expect(canvas.connectionManager.deselectConnection).toHaveBeenCalledTimes(1)
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("keeps selection when touch blank input uses a modifier", () => {
		const { canvas, tool } = createTouchSelectionTool()

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
					shiftKey: true,
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target: canvas.stage,
					modifiers: {
						shift: true,
						alt: false,
						meta: false,
						ctrl: false,
					},
				},
			),
		)

		expect(canvas.selectionManager.deselectAll).not.toHaveBeenCalled()
		expect(canvas.connectionManager.deselectConnection).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("deselects all when touch input starts on blank area of multi-selection proxy", () => {
		const stage = createKonvaNode("stage")
		const proxy = createKonvaNode("proxy", stage, { name: "multi-selection-proxy" })
		const canvas = {
			stage,
			contentLayer: {
				getAbsoluteTransform: () => ({
					copy: () => ({
						invert: () => ({
							point: (point: { x: number; y: number }) => point,
						}),
					}),
				}),
			},
			eraserManager: {
				getErasingElementId: () => null,
			},
			elementManager: {
				hasElement: () => false,
				getElementData: () => undefined,
				getNodeAdapter: () => ({
					getElementBounds: () => ({ x: 100, y: 100, width: 20, height: 20 }),
				}),
			},
			permissionManager: {
				canSelect: vi.fn(() => false),
			},
			selectionManager: {
				isSelected: vi.fn(() => false),
				getSelectionCount: vi.fn(() => 2),
				getSelectedIds: vi.fn(() => ["element-1", "element-2"]),
				toggle: vi.fn(),
				replaceSelection: vi.fn(),
				deselectAll: vi.fn(),
			},
			connectionManager: createConnectionManagerStub(),
			inputManager: {
				cancelLongPress: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
				}),
				{ x: 0, y: 0 },
				{
					type: "down",
					target: proxy,
				},
			),
		)

		expect(canvas.selectionManager.deselectAll).toHaveBeenCalledTimes(1)
		expect(canvas.connectionManager.deselectConnection).toHaveBeenCalledTimes(1)
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("arms touch multi-selection drag when proxy hit is inside a selected element", () => {
		const beginTransformInteractionIntent = vi.fn()
		const clearTransformInteractionIntent = vi.fn()
		const stage = createKonvaNode("stage")
		const proxy = createKonvaNode("proxy", stage, { name: "multi-selection-proxy" })
		const canvas = {
			stage,
			contentLayer: {
				getAbsoluteTransform: () => ({
					copy: () => ({
						invert: () => ({
							point: (point: { x: number; y: number }) => point,
						}),
					}),
				}),
			},
			eraserManager: {
				getErasingElementId: () => null,
			},
			elementManager: {
				hasElement: () => false,
				getElementData: () => undefined,
				getNodeAdapter: () => ({
					getElementBounds: (elementId: string) =>
						elementId === "element-1"
							? { x: 0, y: 0, width: 20, height: 20 }
							: undefined,
				}),
			},
			permissionManager: {
				canSelect: vi.fn(() => false),
			},
			selectionManager: {
				isSelected: vi.fn(() => false),
				getSelectionCount: vi.fn(() => 2),
				getSelectedIds: vi.fn(() => ["element-1", "element-2"]),
				toggle: vi.fn(),
				replaceSelection: vi.fn(),
				deselectAll: vi.fn(),
			},
			connectionManager: createConnectionManagerStub(),
			transformManager: {
				beginTransformInteractionIntent,
				clearTransformInteractionIntent,
			},
			inputManager: {
				cancelLongPress: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate

		tool.handleTouchDown(
			createPointerInput(
				createPointerEvent("pointerdown", {
					clientX: 0,
					clientY: 0,
					buttons: 1,
					pointerId: 4,
					pointerType: "touch",
				}),
				{ x: 10, y: 10 },
				{
					type: "down",
					target: proxy,
				},
			),
		)

		expect(canvas.selectionManager.deselectAll).not.toHaveBeenCalled()
		expect(beginTransformInteractionIntent).toHaveBeenCalledWith(["element-1", "element-2"])
		expect(canvas.inputManager.cancelLongPress).toHaveBeenCalledTimes(1)
		expect(clearTransformInteractionIntent).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toEqual(
			expect.objectContaining({
				mode: "multi-selection",
				elementId: "element-1",
				pointerId: 4,
				pointerType: "touch",
			}),
		)
	})

	it("starts multi-selection proxy drag after the pointer moves past proxy dragDistance", () => {
		const beginTransformInteractionIntent = vi.fn()
		const clearTransformInteractionIntent = vi.fn()
		const startMultiSelectionProxyDrag = vi.fn(() => true)
		const canvas = {
			contentLayer: {},
			selectionManager: {
				getSelectedIds: () => ["element-1", "element-2"],
			},
			transformManager: {
				beginTransformInteractionIntent,
				clearTransformInteractionIntent,
				getMultiSelectionDragDistance: () => 3,
				startMultiSelectionProxyDrag,
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolPrivate

		tool.armPendingMultiSelectionDrag(
			new MouseEvent("mousedown", {
				clientX: 0,
				clientY: 0,
			}),
			"element-1",
		)
		window.dispatchEvent(
			new MouseEvent("mousemove", {
				clientX: 10,
				clientY: 0,
				buttons: 1,
			}),
		)

		expect(beginTransformInteractionIntent).toHaveBeenCalledWith(["element-1", "element-2"])
		expect(startMultiSelectionProxyDrag).toHaveBeenCalledTimes(1)
		expect(clearTransformInteractionIntent).not.toHaveBeenCalled()
		expect(tool.pendingDirectDrag).toBeNull()
	})

	it("uses spatial candidates while preserving top-level and permission filters", () => {
		const box = { x: 0, y: 0, width: 100, height: 100 }
		const elementsById = new Map<string, LayerElement>([
			[
				"visible",
				{
					id: "visible",
					type: "rectangle",
					x: 10,
					y: 10,
					width: 20,
					height: 20,
					activeContentId: "visible-content",
					mainContentId: "visible-content",
					contents: [{ contentId: "visible-content" }],
				},
			],
			[
				"outside",
				{
					id: "outside",
					type: "rectangle",
					x: 150,
					y: 150,
					width: 20,
					height: 20,
					activeContentId: "outside-content",
					mainContentId: "outside-content",
					contents: [{ contentId: "outside-content" }],
				},
			],
			[
				"locked",
				{
					id: "locked",
					type: "rectangle",
					locked: true,
					x: 10,
					y: 10,
					width: 20,
					height: 20,
					activeContentId: "locked-content",
					mainContentId: "locked-content",
					contents: [{ contentId: "locked-content" }],
				},
			],
		])
		const queryElementIdsByExpandedRect = vi.fn(() => [
			"child",
			"visible",
			"outside",
			"locked",
			"missing",
		])
		const getElementData = vi.fn((elementId: string) => elementsById.get(elementId))
		const findParentIdForElement = vi.fn((elementId: string) =>
			elementId === "child" ? "frame" : undefined,
		)
		const canvas = {
			geometryCacheManager: {
				queryElementIdsByExpandedRect,
			},
			elementManager: {
				findParentIdForElement,
				getElementData,
			},
			permissionManager: {
				canSelect: (element: LayerElement) => !element.locked,
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolBoxPrivate

		expect(tool.findElementsInBox(box)).toEqual(["visible"])
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledWith(box, 0)
		expect(getElementData).not.toHaveBeenCalledWith("child")
	})

	it("updates element and connection selections from a selection box", () => {
		const box = { x: 0, y: 0, width: 100, height: 100 }
		const canvas = {
			geometryCacheManager: {
				queryElementIdsByExpandedRect: vi.fn(() => ["element-1"]),
			},
			elementManager: {
				findParentIdForElement: vi.fn(() => undefined),
				getElementData: vi.fn(() => ({
					id: "element-1",
					type: "rectangle",
					x: 10,
					y: 10,
					width: 20,
					height: 20,
				})),
			},
			permissionManager: {
				canSelect: vi.fn(() => true),
			},
			selectionManager: {
				selectMultiple: vi.fn(),
				deselectAll: vi.fn(),
			},
			connectionManager: {
				findConnectionsInBox: vi.fn(() => ["connection-1", "connection-2"]),
				selectConnections: vi.fn(),
				deselectConnection: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolBoxPrivate

		tool.updateSelectionFromBox(box)

		expect(canvas.selectionManager.selectMultiple).toHaveBeenCalledWith(["element-1"], false)
		expect(canvas.connectionManager.findConnectionsInBox).toHaveBeenCalledWith(box)
		expect(canvas.connectionManager.selectConnections).toHaveBeenCalledWith(
			["connection-1", "connection-2"],
			{ append: false, autoFocus: false },
		)
	})

	it("clears element and connection selections when an unmodified selection box is empty", () => {
		const canvas = {
			geometryCacheManager: {
				queryElementIdsByExpandedRect: vi.fn(() => []),
			},
			elementManager: {
				findParentIdForElement: vi.fn(),
				getElementData: vi.fn(),
			},
			permissionManager: {
				canSelect: vi.fn(),
			},
			selectionManager: {
				selectMultiple: vi.fn(),
				deselectAll: vi.fn(),
			},
			connectionManager: {
				findConnectionsInBox: vi.fn(() => []),
				selectConnections: vi.fn(),
				deselectConnection: vi.fn(),
			},
		} as unknown as Canvas
		const tool = new SelectionTool({ canvas }) as unknown as SelectionToolBoxPrivate

		tool.updateSelectionFromBox({ x: 0, y: 0, width: 100, height: 100 })

		expect(canvas.selectionManager.deselectAll).toHaveBeenCalledTimes(1)
		expect(canvas.connectionManager.deselectConnection).toHaveBeenCalledTimes(1)
	})
})
