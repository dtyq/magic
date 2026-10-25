import Konva from "konva"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import type {
	CanvasInputEventType,
	CanvasPointerInput,
	CanvasPointerInputHandler,
} from "../../input"
import { ConnectionDragManager } from "../ConnectionDragManager"
import { ConnectionDragRenderer } from "../ConnectionDragRenderer"

beforeAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
		configurable: true,
		value: vi.fn(() => ({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			fillText: vi.fn(),
			getImageData: vi.fn(() => ({ data: [0, 0, 0, 0] })),
			measureText: vi.fn(() => ({ width: 0 })),
		})),
	})
})

function createCanvasStub() {
	const state = {
		selectionToolActive: true,
		transformActive: false,
		dragging: false,
		selectedIds: [] as string[],
		transformerElementIds: new Set<string>(),
		existingConnections: [] as Array<{ sourceElementId: string; targetElementId: string }>,
		visibleIds: new Set(["origin", "target", "other"]),
		elementTypes: new Map<string, LayerElement["type"]>(),
		nonConnectableIds: new Set<string>(),
		bounds: new Map([
			["origin", { x: 10, y: 20, width: 100, height: 40 }],
			["target", { x: 220, y: 20, width: 100, height: 40 }],
			["other", { x: 420, y: 20, width: 100, height: 40 }],
		]),
	}
	const inputHandlers = new Map<CanvasInputEventType, Set<CanvasPointerInputHandler>>()
	const stage = new Konva.Group()
	const controlsLayer = new Konva.Group()
	const elementNodes = new Map(
		["origin", "target", "other"].map((id) => {
			const node = new Konva.Group({ id })
			return [id, node] as const
		}),
	)
	const getElementData = vi.fn((elementId: string): LayerElement | undefined => {
		if (!state.bounds.has(elementId)) return undefined
		const bounds = state.bounds.get(elementId)
		if (!bounds) return undefined
		const baseElement = {
			id: elementId,
			type: state.elementTypes.get(elementId) ?? ElementTypeEnum.Text,
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			visible: state.visibleIds.has(elementId),
			interactionConfig: state.nonConnectableIds.has(elementId)
				? { connectable: false }
				: undefined,
		}
		if (
			baseElement.type === ElementTypeEnum.Video ||
			baseElement.type === ElementTypeEnum.Audio
		) {
			return {
				...baseElement,
				activeContentId: `${elementId}-content`,
				mainContentId: `${elementId}-content`,
				contents: [{ contentId: `${elementId}-content`, src: `/${elementId}.media` }],
			} as LayerElement
		}
		return baseElement as LayerElement
	})
	const connectionManager = {
		connectElements: vi.fn(() => ({ status: "created", connectionId: "connection-1" })),
		connectElementsBatch: vi.fn(() => ({
			status: "created" as const,
			connectionIds: ["connection-1", "connection-2"],
		})),
		hasConnection: vi.fn((sourceElementId: string, targetElementId: string) =>
			state.existingConnections.some(
				(connection) =>
					connection.sourceElementId === sourceElementId &&
					connection.targetElementId === targetElementId,
			),
		),
		hasReverseConnection: vi.fn((sourceElementId: string, targetElementId: string) =>
			state.existingConnections.some(
				(connection) =>
					connection.sourceElementId === targetElementId &&
					connection.targetElementId === sourceElementId,
			),
		),
	}
	const cursorManager = {
		setTemporary: vi.fn(),
		restoreToolCursor: vi.fn(),
	}
	const connectionHandleOverlayManager = {
		clear: vi.fn(),
		refresh: vi.fn(),
	}
	const selectionManager = {
		deselectAll: vi.fn(),
		getSelectedIds: vi.fn(() => state.selectedIds),
	}
	const canvas = {
		can: vi.fn(() => true),
		stage,
		controlsLayer,
		eventEmitter: new EventEmitter(),
		inputManager: {
			on: vi.fn((type: CanvasInputEventType, handler: CanvasPointerInputHandler) => {
				const handlers = inputHandlers.get(type) ?? new Set<CanvasPointerInputHandler>()
				handlers.add(handler)
				inputHandlers.set(type, handlers)
				return () => handlers.delete(handler)
			}),
		},
		connectionManager,
		connectionHandleOverlayManager,
		cursorManager,
		selectionManager,
		runtimeScheduler: {
			requestLayerDraw: vi.fn(),
		},
		permissionManager: {
			can: vi.fn(() => true),
			canUseSelectionToolAffordance: () => state.selectionToolActive,
			canHover: (element: LayerElement | undefined) =>
				!!element && state.visibleIds.has(element.id),
			canConnect: (element: LayerElement | undefined) =>
				!!element &&
				state.visibleIds.has(element.id) &&
				element.interactionConfig?.connectable !== false &&
				element.type !== ElementTypeEnum.Group,
		},
		transformManager: {
			isTransformInteractionActive: () => state.transformActive,
			isDraggingElement: () => state.dragging,
			isTransforming: (elementId: string) => state.transformerElementIds.has(elementId),
			isElementInActiveTransformInteraction: (elementId: string) =>
				state.transformActive && state.transformerElementIds.has(elementId),
		},
		cropManager: {
			getCroppingElementId: () => null,
		},
		extendManager: {
			getExtendingElementId: () => null,
		},
		eraserManager: {
			getErasingElementId: () => null,
		},
		elementManager: {
			hasElement: (elementId: string) => state.bounds.has(elementId),
			getElementData,
			getAllElements: () =>
				Array.from(state.bounds.keys())
					.map((elementId) => getElementData(elementId))
					.filter((element): element is LayerElement => !!element),
			isElementVisibleInDataTree: (elementId: string) => state.visibleIds.has(elementId),
			canParticipateInDocumentRelations: () => true,
			getElementInstance: (elementId: string) => {
				const node = elementNodes.get(elementId)
				return node ? { getNode: () => node } : undefined
			},
		},
		geometryCacheManager: {
			getElementBounds: vi.fn((elementId: string) => state.bounds.get(elementId) ?? null),
			queryElementIdsByExpandedRect: vi.fn(
				(rect: { x: number; y: number; width: number; height: number }) =>
					Array.from(state.bounds.entries())
						.filter(([elementId, bounds]) => {
							if (!state.visibleIds.has(elementId)) return false
							return (
								rect.x >= bounds.x &&
								rect.x <= bounds.x + bounds.width &&
								rect.y >= bounds.y &&
								rect.y <= bounds.y + bounds.height
							)
						})
						.map(([elementId]) => elementId),
			),
		},
	} as unknown as Canvas
	const manager = new ConnectionDragManager({ canvas })
	const getElementNode = (elementId: string): Konva.Group => {
		const node = elementNodes.get(elementId)
		if (!node) {
			throw new Error(`Expected ${elementId} node`)
		}
		return node
	}

	return {
		canvas,
		connectionHandleOverlayManager,
		connectionManager,
		controlsLayer,
		cursorManager,
		emitInput: (type: CanvasInputEventType, input: CanvasPointerInput) => {
			inputHandlers.get(type)?.forEach((handler) => handler(input))
		},
		getElementNode,
		manager,
		selectionManager,
		stage,
		state,
	}
}

function createInput(
	type: CanvasInputEventType,
	options: {
		client: { x: number; y: number }
		canvas: { x: number; y: number }
		target: Konva.Node
		activePointerCount?: number
	},
): CanvasPointerInput {
	const nativeEvent = {
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as MouseEvent
	return {
		type,
		pointerId: 1,
		pointerType: "mouse",
		button: 0,
		buttons: type === "up" || type === "cancel" ? 0 : 1,
		client: options.client,
		stage: options.client,
		canvas: options.canvas,
		target: options.target,
		modifiers: { shift: false, alt: false, meta: false, ctrl: false },
		activePointerCount: options.activePointerCount ?? 1,
		nativeEvent,
		konvaEvent: {
			target: options.target,
			evt: nativeEvent,
		} as Konva.KonvaEventObject<MouseEvent>,
	}
}

function getPreviewPath(controlsLayer: Konva.Container): Konva.Path | null {
	const path = controlsLayer.findOne(`.${ConnectionDragRenderer.PREVIEW_PATH_NAME}`)
	return path instanceof Konva.Path ? path : null
}

function getTargetFeedbackRect(controlsLayer: Konva.Container): Konva.Rect | null {
	const rect = controlsLayer.findOne(`.${ConnectionDragRenderer.TARGET_FEEDBACK_RECT_NAME}`)
	return rect instanceof Konva.Rect ? rect : null
}

describe("ConnectionDragManager", () => {
	it("creates all root-to-target edges for a right-side selection drag", () => {
		const { connectionManager, emitInput, getElementNode, manager, stage } = createCanvasStub()

		expect(
			manager.startFromHandle({
				origin: {
					kind: "selection",
					elementIds: ["origin", "other"],
					side: "right",
					boundingRect: { x: 10, y: 20, width: 510, height: 40 },
					selectionRevision: "origin\u0000other",
				},
				client: { x: 110, y: 40 },
				canvasPoint: { x: 110, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			}),
		).toBe(true)

		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)
		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "origin", targetElementId: "target" },
				{ sourceElementId: "other", targetElementId: "target" },
			],
		})
		expect(stage.isDragging()).toBe(false)
	})

	it("creates target-to-all-root edges for a left-side selection drag", () => {
		const { connectionManager, emitInput, getElementNode, manager } = createCanvasStub()
		manager.startFromHandle({
			origin: {
				kind: "selection",
				elementIds: ["origin", "other"],
				side: "left",
				boundingRect: { x: 10, y: 20, width: 510, height: 40 },
				selectionRevision: "origin\u0000other",
			},
			client: { x: 10, y: 40 },
			canvasPoint: { x: 10, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})

		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)
		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				{ sourceElementId: "target", targetElementId: "origin" },
				{ sourceElementId: "target", targetElementId: "other" },
			],
		})
	})

	it("does not create any selection edge when one root pair fails preflight", () => {
		const { connectionManager, emitInput, getElementNode, manager, state } = createCanvasStub()
		state.existingConnections.push({ sourceElementId: "origin", targetElementId: "target" })
		manager.startFromHandle({
			origin: {
				kind: "selection",
				elementIds: ["origin", "other"],
				side: "right",
				boundingRect: { x: 10, y: 20, width: 510, height: 40 },
				selectionRevision: "origin\u0000other",
			},
			client: { x: 110, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})

		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)
		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElementsBatch).not.toHaveBeenCalled()
		expect(connectionManager.connectElements).not.toHaveBeenCalled()
	})

	it("invalidates a pending selection drag when the selected roots change", () => {
		const { canvas, manager, state } = createCanvasStub()
		state.selectedIds = ["origin", "other"]
		const origin = {
			kind: "selection" as const,
			elementIds: ["origin", "other"],
			side: "right" as const,
			boundingRect: { x: 10, y: 20, width: 510, height: 40 },
			selectionRevision: "origin\u0000other",
		}

		expect(
			manager.startFromHandle({
				origin,
				client: { x: 110, y: 40 },
				canvasPoint: { x: 110, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			}),
		).toBe(true)

		state.selectedIds = ["origin", "target"]
		canvas.eventEmitter.emit({
			type: "element:select",
			data: { elementIds: ["origin", "target"] },
		})

		expect(manager.isDraggingConnection()).toBe(false)
	})

	it.each(["left", "right"] as const)(
		"opens the shared selection creation menu from the %s handle",
		(side) => {
			const { canvas, manager, state } = createCanvasStub()
			state.selectedIds = ["origin", "other"]
			const onMenuOpen = vi.fn()
			canvas.eventEmitter.on("connection:menu:open", onMenuOpen)

			manager.startFromHandle({
				origin: {
					kind: "selection",
					elementIds: ["origin", "other"],
					side,
					boundingRect: { x: 10, y: 20, width: 510, height: 40 },
					selectionRevision: "origin\u0000other",
				},
				client: { x: side === "left" ? 10 : 520, y: 40 },
				canvasPoint: { x: side === "left" ? 10 : 520, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			})
			manager.releasePendingHandleInteraction()
			expect(onMenuOpen).toHaveBeenCalledWith({
				type: "connection:menu:open",
				data: expect.objectContaining({
					origin: {
						kind: "selection",
						elementIds: ["origin", "other"],
						side,
						boundingRect: { x: 10, y: 20, width: 510, height: 40 },
						selectionRevision: "origin\u0000other",
					},
				}),
			})
		},
	)

	it.each(["left", "right"] as const)(
		"opens the shared selection creation menu after a %s-side drag to blank space",
		(side) => {
			const { canvas, emitInput, manager, stage, state } = createCanvasStub()
			state.selectedIds = ["origin", "other"]
			const onMenuOpen = vi.fn()
			canvas.eventEmitter.on("connection:menu:open", onMenuOpen)

			manager.startFromHandle({
				origin: {
					kind: "selection",
					elementIds: ["origin", "other"],
					side,
					boundingRect: { x: 10, y: 20, width: 510, height: 40 },
					selectionRevision: "origin\u0000other",
				},
				client: { x: side === "left" ? 10 : 520, y: 40 },
				canvasPoint: { x: side === "left" ? 10 : 520, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			})
			emitInput(
				"move",
				createInput("move", {
					client: { x: 700, y: 300 },
					canvas: { x: 700, y: 300 },
					target: stage,
				}),
			)
			emitInput(
				"up",
				createInput("up", {
					client: { x: 700, y: 300 },
					canvas: { x: 700, y: 300 },
					target: stage,
				}),
			)

			expect(onMenuOpen).toHaveBeenCalledWith({
				type: "connection:menu:open",
				data: expect.objectContaining({
					origin: {
						kind: "selection",
						elementIds: ["origin", "other"],
						side,
						boundingRect: { x: 10, y: 20, width: 510, height: 40 },
						selectionRevision: "origin\u0000other",
					},
					source: "drag-empty",
				}),
			})
		},
	)

	it("creates origin-to-target connections from the right handle", () => {
		const {
			connectionHandleOverlayManager,
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			manager,
			stage,
		} = createCanvasStub()

		expect(
			manager.startFromHandle({
				origin: { kind: "element", elementId: "origin", side: "right" },
				client: { x: 100, y: 40 },
				canvasPoint: { x: 110, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			}),
		).toBe(true)

		emitInput(
			"move",
			createInput("move", {
				client: { x: 106, y: 40 },
				canvas: { x: 130, y: 40 },
				target: stage,
			}),
		)

		expect(connectionHandleOverlayManager.clear).toHaveBeenCalledWith({ animated: false })
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("crosshair")
		expect(getPreviewPath(controlsLayer)).toBeInstanceOf(Konva.Path)

		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).toHaveBeenCalledWith({
			sourceElementId: "origin",
			targetElementId: "target",
		})
		expect(getPreviewPath(controlsLayer)).toBeNull()
		expect(cursorManager.restoreToolCursor).toHaveBeenCalledTimes(1)
		expect(connectionHandleOverlayManager.refresh).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("creates target-to-origin connections from the left handle", () => {
		const { connectionManager, emitInput, getElementNode, manager, stage } = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "left" },
			client: { x: 10, y: 40 },
			canvasPoint: { x: 10, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 0, y: 40 },
				canvas: { x: 225, y: 40 },
				target: stage,
			}),
		)
		emitInput(
			"up",
			createInput("up", {
				client: { x: 0, y: 40 },
				canvas: { x: 225, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElements).toHaveBeenCalledWith({
			sourceElementId: "target",
			targetElementId: "origin",
		})
		manager.destroy()
	})

	it("renders a valid target feedback while dragging over a connectable element", () => {
		const { controlsLayer, cursorManager, emitInput, manager, stage } = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		const previewPath = getPreviewPath(controlsLayer)
		expect(previewPath?.getAttr("connectionDragPreviewData")).toEqual({
			targetElementId: "target",
			originSide: "right",
			state: "valid",
			validationReason: null,
			sourceSide: "right",
			targetSide: "left",
		})
		expect(
			getTargetFeedbackRect(controlsLayer)?.getAttr("connectionDragTargetFeedbackData"),
		).toEqual({
			targetElementId: "target",
			state: "valid",
			validationReason: null,
		})
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("crosshair")
		manager.destroy()
	})

	it("renders invalid target feedback while dragging over a non-connectable element", () => {
		const {
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			manager,
			stage,
			state,
		} = createCanvasStub()
		state.nonConnectableIds.add("target")

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: "target",
			state: "invalid",
			validationReason: "cannot-connect",
		})
		expect(
			getTargetFeedbackRect(controlsLayer)?.getAttr("connectionDragTargetFeedbackData"),
		).toEqual({
			targetElementId: "target",
			state: "invalid",
			validationReason: "cannot-connect",
		})
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("not-allowed")

		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("does not start dragging from explicitly disabled elements", () => {
		const { manager, state } = createCanvasStub()

		state.nonConnectableIds.add("origin")
		expect(
			manager.startFromHandle({
				origin: { kind: "element", elementId: "origin", side: "right" },
				client: { x: 100, y: 40 },
				canvasPoint: { x: 110, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			}),
		).toBe(false)

		manager.destroy()
	})

	it("starts dragging from a frame", () => {
		const { manager, state } = createCanvasStub()
		state.elementTypes.set("origin", ElementTypeEnum.Frame)
		expect(
			manager.startFromHandle({
				origin: { kind: "element", elementId: "origin", side: "right" },
				client: { x: 100, y: 40 },
				canvasPoint: { x: 110, y: 40 },
				pointerId: 1,
				pointerType: "mouse",
			}),
		).toBe(true)
		manager.destroy()
	})

	it.each([ElementTypeEnum.Group])("skips %s targets while dragging", (elementType) => {
		const {
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			getElementNode,
			manager,
			state,
		} = createCanvasStub()
		state.elementTypes.set("target", elementType)

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: null,
			state: "free",
			validationReason: null,
		})
		expect(getTargetFeedbackRect(controlsLayer)).toBeNull()
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("crosshair")

		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("connects to a frame target instead of resolving an element underneath", () => {
		const { connectionManager, controlsLayer, emitInput, getElementNode, manager, state } =
			createCanvasStub()
		state.elementTypes.set("target", ElementTypeEnum.Frame)
		state.bounds.set("other", { x: 220, y: 20, width: 100, height: 40 })

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: "target",
			state: "valid",
			validationReason: null,
		})

		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: getElementNode("target"),
			}),
		)

		expect(connectionManager.connectElements).toHaveBeenCalledWith({
			sourceElementId: "origin",
			targetElementId: "target",
		})
		manager.destroy()
	})

	it("allows connecting to a selected target with an idle transformer", () => {
		const { connectionManager, controlsLayer, emitInput, manager, stage, state } =
			createCanvasStub()
		state.transformerElementIds.add("target")

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: "target",
			state: "valid",
			validationReason: null,
		})

		emitInput(
			"up",
			createInput("up", {
				client: { x: 230, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).toHaveBeenCalledWith({
			sourceElementId: "origin",
			targetElementId: "target",
		})
		manager.destroy()
	})

	it("rejects dragging an already connected pair resolved from the opposite handle", () => {
		const {
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			manager,
			stage,
			state,
		} = createCanvasStub()
		state.existingConnections.push({
			sourceElementId: "origin",
			targetElementId: "target",
		})

		manager.startFromHandle({
			origin: { kind: "element", elementId: "target", side: "left" },
			client: { x: 220, y: 40 },
			canvasPoint: { x: 220, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 20, y: 40 },
				canvas: { x: 20, y: 40 },
				target: stage,
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: "origin",
			state: "invalid",
			validationReason: "already-connected",
		})
		expect(
			getTargetFeedbackRect(controlsLayer)?.getAttr("connectionDragTargetFeedbackData"),
		).toEqual({
			targetElementId: "origin",
			state: "invalid",
			validationReason: "already-connected",
		})
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("not-allowed")

		emitInput(
			"up",
			createInput("up", {
				client: { x: 20, y: 40 },
				canvas: { x: 20, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("rejects dragging a reverse connection over an already connected pair", () => {
		const {
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			manager,
			stage,
			state,
		} = createCanvasStub()
		state.existingConnections.push({
			sourceElementId: "origin",
			targetElementId: "target",
		})

		manager.startFromHandle({
			origin: { kind: "element", elementId: "target", side: "right" },
			client: { x: 320, y: 40 },
			canvasPoint: { x: 320, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 20, y: 40 },
				canvas: { x: 20, y: 40 },
				target: stage,
			}),
		)

		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			targetElementId: "origin",
			state: "invalid",
			validationReason: "reverse-existing",
		})
		expect(
			getTargetFeedbackRect(controlsLayer)?.getAttr("connectionDragTargetFeedbackData"),
		).toEqual({
			targetElementId: "origin",
			state: "invalid",
			validationReason: "reverse-existing",
		})
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("not-allowed")

		emitInput(
			"up",
			createInput("up", {
				client: { x: 20, y: 40 },
				canvas: { x: 20, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("does not create a connection before the drag threshold is crossed", () => {
		const { connectionManager, cursorManager, emitInput, manager, stage } = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 103, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)
		emitInput(
			"up",
			createInput("up", {
				client: { x: 103, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		expect(cursorManager.setTemporary).not.toHaveBeenCalledWith("crosshair")
		manager.destroy()
	})

	it("opens the connection menu when a handle click stays below the drag threshold", () => {
		const { canvas, manager } = createCanvasStub()
		const emitSpy = vi.spyOn(canvas.eventEmitter, "emit")

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		manager.releasePendingHandleInteraction()

		expect(emitSpy).toHaveBeenCalledWith({
			type: "connection:menu:open",
			data: {
				origin: { kind: "element", elementId: "origin", side: "right" },
				x: 100,
				y: 40,
				canvasX: 110,
				canvasY: 40,
				source: "handle",
			},
		})
		manager.destroy()
	})

	it("deselects elements when a connection drag starts", () => {
		const { emitInput, manager, selectionManager, stage } = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		expect(selectionManager.deselectAll).not.toHaveBeenCalled()

		emitInput(
			"move",
			createInput("move", {
				client: { x: 106, y: 40 },
				canvas: { x: 130, y: 40 },
				target: stage,
			}),
		)

		expect(selectionManager.deselectAll).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("opens the connection menu and keeps the preview when released on blank space", () => {
		const {
			canvas,
			connectionHandleOverlayManager,
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			manager,
			stage,
		} = createCanvasStub()
		const emitSpy = vi.spyOn(canvas.eventEmitter, "emit")

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 120, y: 40 },
				canvas: { x: 160, y: 40 },
				target: stage,
			}),
		)
		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			state: "free",
			targetElementId: null,
		})
		emitInput(
			"up",
			createInput("up", {
				client: { x: 120, y: 40 },
				canvas: { x: 160, y: 40 },
				target: stage,
			}),
		)
		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		expect(emitSpy).toHaveBeenCalledWith({
			type: "connection:menu:open",
			data: {
				origin: { kind: "element", elementId: "origin", side: "right" },
				x: 120,
				y: 40,
				canvasX: 160,
				canvasY: 40,
				source: "drag-empty",
			},
		})
		expect(getPreviewPath(controlsLayer)).toBeInstanceOf(Konva.Path)
		expect(manager.isDraggingConnection()).toBe(true)
		expect(cursorManager.restoreToolCursor).toHaveBeenCalledTimes(1)

		canvas.eventEmitter.emit({
			type: "connection:menu:close",
			data: {
				origin: { kind: "element", elementId: "origin", side: "right" },
				source: "drag-empty",
			},
		})

		expect(getPreviewPath(controlsLayer)).toBeNull()
		expect(manager.isDraggingConnection()).toBe(false)
		expect(connectionHandleOverlayManager.refresh).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("cancels when released on the origin element", () => {
		const {
			connectionManager,
			controlsLayer,
			cursorManager,
			emitInput,
			getElementNode,
			manager,
			stage,
		} = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		emitInput(
			"move",
			createInput("move", {
				client: { x: 120, y: 40 },
				canvas: { x: 20, y: 40 },
				target: stage,
			}),
		)
		expect(getPreviewPath(controlsLayer)?.getAttr("connectionDragPreviewData")).toMatchObject({
			state: "invalid",
			targetElementId: "origin",
			validationReason: "self",
		})
		expect(
			getTargetFeedbackRect(controlsLayer)?.getAttr("connectionDragTargetFeedbackData"),
		).toEqual({
			targetElementId: "origin",
			state: "invalid",
			validationReason: "self",
		})
		expect(cursorManager.setTemporary).toHaveBeenLastCalledWith("not-allowed")
		emitInput(
			"up",
			createInput("up", {
				client: { x: 120, y: 40 },
				canvas: { x: 20, y: 40 },
				target: getElementNode("origin"),
			}),
		)
		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("clears pending click state when the handle receives mouseup directly", () => {
		const { connectionManager, emitInput, manager, stage } = createCanvasStub()

		manager.startFromHandle({
			origin: { kind: "element", elementId: "origin", side: "right" },
			client: { x: 100, y: 40 },
			canvasPoint: { x: 110, y: 40 },
			pointerId: 1,
			pointerType: "mouse",
		})
		manager.releasePendingHandleInteraction()
		emitInput(
			"move",
			createInput("move", {
				client: { x: 130, y: 40 },
				canvas: { x: 230, y: 40 },
				target: stage,
			}),
		)

		expect(connectionManager.connectElements).not.toHaveBeenCalled()
		manager.destroy()
	})
})
