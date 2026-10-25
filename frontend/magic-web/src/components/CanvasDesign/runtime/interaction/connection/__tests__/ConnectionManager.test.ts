import { beforeAll, describe, expect, it, vi } from "vitest"
import Konva from "konva"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import { ConnectionManager } from "../ConnectionManager"
import { ElementTypeEnum, type CanvasConnection, type LayerElement } from "../../../document/types"
import {
	CONNECTION_HOVER_LINE_STYLE,
	CONNECTION_HIT_STYLE,
	CONNECTION_LINE_STYLE,
	CONNECTION_SELECTED_LINE_STYLE,
	CONNECTION_STROKE_SCALE_STYLE,
	resolveConnectionScreenStrokeWidth,
} from "../connectionStyle"
import { CONNECTION_HIT_PATH_NAME, CONNECTION_VISUAL_PATH_NAME } from "../connectionNodeUtils"

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

function createCanvasStub(
	visibleIds: string[] = ["source", "target", "other"],
	scale = 1,
	boundsById?: Map<string, { x: number; y: number; width: number; height: number }>,
) {
	const visibleSet = new Set(visibleIds)
	const documentOwnedIds = new Set(["source", "target", "other"])
	const elementData = new Map<string, LayerElement>(
		["source", "target", "other"].map((id) => [
			id,
			{
				id,
				type: ElementTypeEnum.Text,
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				activeContentId: `${id}-content`,
				mainContentId: `${id}-content`,
				contents: [{ contentId: `${id}-content` }],
			},
		]),
	)
	const connectionGroup = {
		destroyChildren: vi.fn(),
		add: vi.fn(),
	}
	const requestLayerDraw = vi.fn()
	const selectionManager = {
		deselectAll: vi.fn(),
	}
	const updateElement = vi.fn((elementId: string, updates: Partial<LayerElement>) => {
		const current = elementData.get(elementId)
		if (current) elementData.set(elementId, { ...current, ...updates })
	})
	const canvas = {
		eventEmitter: new EventEmitter(),
		elementManager: {
			getElementData: vi.fn((id: string) => elementData.get(id)),
			isElementVisibleInDataTree: vi.fn((id: string) => visibleSet.has(id)),
			canParticipateInDocumentRelations: vi.fn((id: string) => documentOwnedIds.has(id)),
			update: updateElement,
		},
		connectionGroup,
		controlsLayer: { add: vi.fn(), find: vi.fn(() => []) },
		ensureConnectionGroup: vi.fn(() => connectionGroup),
		geometryCacheManager: {
			getElementBounds: vi.fn(
				(elementId: string) =>
					boundsById?.get(elementId) ?? { x: 0, y: 0, width: 100, height: 40 },
			),
			invalidateElements: vi.fn(),
		},
		runtimeScheduler: {
			requestLayerDraw,
		},
		selectionManager,
		permissionManager: {
			can: vi.fn(() => true),
			canUseSelectionToolAffordance: vi.fn(() => true),
		},
		cursorManager: {
			setTemporary: vi.fn(),
			restoreToolCursor: vi.fn(),
		},
		stage: {
			scaleX: () => scale,
		},
	} as unknown as Canvas

	return {
		canvas,
		elementData,
		documentOwnedIds,
		connectionGroup,
		requestLayerDraw,
		selectionManager,
		updateElement,
	}
}

function createVideoEditElement(id: string): LayerElement {
	return {
		id,
		type: ElementTypeEnum.VideoEdit,
		x: 0,
		y: 0,
		width: 1280,
		height: 720,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	} as LayerElement
}

function getLastRenderedConnectionGroup(connectionGroup: {
	add: ReturnType<typeof vi.fn>
}): Konva.Group {
	const node = connectionGroup.add.mock.calls.at(-1)?.[0]
	if (!(node instanceof Konva.Group)) {
		throw new Error("Expected rendered connection group")
	}
	return node
}

function getConnectionPath(group: Konva.Group, name: string): Konva.Path {
	const path = group.findOne(`.${name}`)
	if (!(path instanceof Konva.Path)) {
		throw new Error(`Expected ${name} path`)
	}
	return path
}

function getRequiredGroup(node: Konva.Node | null | undefined, label: string): Konva.Group {
	if (!(node instanceof Konva.Group)) {
		throw new Error(`Expected ${label} to be a Konva.Group`)
	}
	return node
}

describe("ConnectionManager", () => {
	it("loads, filters, and exports connections as cloned data", () => {
		const { canvas, connectionGroup } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			elements: [],
			connections: [
				{ id: "valid", sourceElementId: "source", targetElementId: "target" },
				{ id: "missing", sourceElementId: "source", targetElementId: "missing" },
				{ id: "self", sourceElementId: "source", targetElementId: "source" },
			],
		})

		const exported = manager.exportConnections()
		expect(exported).toEqual([
			{ id: "valid", sourceElementId: "source", targetElementId: "target" },
		])

		exported[0].sourceElementId = "changed"
		expect(manager.exportConnections()[0].sourceElementId).toBe("source")

		const renderedNode = getLastRenderedConnectionGroup(connectionGroup)
		const hitPath = getConnectionPath(renderedNode, CONNECTION_HIT_PATH_NAME)
		const visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)
		expect(renderedNode.getClassName()).toBe("Group")
		expect(renderedNode.attrs).toEqual(
			expect.objectContaining({
				name: "canvas-connection",
				listening: true,
				connectionData: {
					connectionId: "valid",
					sourceElementId: "source",
					targetElementId: "target",
					sourceSide: "right",
					targetSide: "left",
				},
			}),
		)
		expect(hitPath.attrs).toEqual(
			expect.objectContaining({
				name: CONNECTION_HIT_PATH_NAME,
				data: "M 100 20 C 160 20 -60 20 0 20",
				stroke: "rgba(0, 0, 0, 0)",
				strokeWidth: CONNECTION_HIT_STYLE.strokeWidth,
				listening: true,
			}),
		)
		expect(visualPath.attrs).toEqual(
			expect.objectContaining({
				name: CONNECTION_VISUAL_PATH_NAME,
				data: "M 100 20 C 160 20 -60 20 0 20",
				stroke: CONNECTION_LINE_STYLE.stroke,
				strokeWidth: CONNECTION_LINE_STYLE.strokeWidth,
				opacity: CONNECTION_LINE_STYLE.opacity,
				lineCap: "round",
				lineJoin: "round",
				listening: false,
				shadowColor: CONNECTION_LINE_STYLE.shadowColor,
				shadowBlur: CONNECTION_LINE_STYLE.shadowBlur,
				shadowOpacity: CONNECTION_LINE_STYLE.shadowOpacity,
			}),
		)
		expect(visualPath.attrs.fill).toBeUndefined()
		expect(visualPath.attrs.dash).toBeUndefined()
		expect(visualPath.attrs.pointerLength).toBeUndefined()
		expect(visualPath.attrs.pointerWidth).toBeUndefined()
	})

	it("queries upstream and downstream connections", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [
				{ id: "a", sourceElementId: "source", targetElementId: "target" },
				{ id: "b", sourceElementId: "target", targetElementId: "other" },
			],
		})

		expect(manager.getUpstreamConnections("target").map((item) => item.id)).toEqual(["a"])
		expect(manager.getDownstreamConnections("target").map((item) => item.id)).toEqual(["b"])
	})

	it("skips viewport scale rerenders when there are no connections", () => {
		const requestAnimationFrameMock = vi.fn()
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock)
		const { canvas, connectionGroup, requestLayerDraw } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		try {
			manager.loadDocument({ connections: [] })
			connectionGroup.destroyChildren.mockClear()
			requestLayerDraw.mockClear()

			canvas.eventEmitter.emit({ type: "viewport:scale", data: { scale: 2 } })

			expect(manager.hasConnections()).toBe(false)
			expect(requestAnimationFrameMock).not.toHaveBeenCalled()
			expect(connectionGroup.destroyChildren).not.toHaveBeenCalled()
			expect(requestLayerDraw).not.toHaveBeenCalled()
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it("keeps viewport scale rerenders for documents with connections", () => {
		const frameCallbacks: FrameRequestCallback[] = []
		const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
			frameCallbacks.push(callback)
			return frameCallbacks.length
		})
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock)
		const { canvas, requestLayerDraw } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		try {
			manager.loadDocument({
				connections: [{ id: "edge", sourceElementId: "source", targetElementId: "target" }],
			})
			requestLayerDraw.mockClear()

			canvas.eventEmitter.emit({ type: "viewport:scale", data: { scale: 2 } })

			expect(manager.hasConnections()).toBe(true)
			expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
			expect(requestLayerDraw).not.toHaveBeenCalled()

			frameCallbacks[0](0)
			expect(requestLayerDraw).toHaveBeenCalledTimes(1)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it("keeps hidden element connections in data but skips rendering them", () => {
		const { canvas, connectionGroup } = createCanvasStub(["source"])
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [{ id: "hidden", sourceElementId: "source", targetElementId: "target" }],
		})

		expect(manager.exportConnections()).toEqual([
			{ id: "hidden", sourceElementId: "source", targetElementId: "target" },
		])
		expect(connectionGroup.add).not.toHaveBeenCalled()
	})

	it("renders same-frame connections above the frame background and below children", () => {
		const boundsById = new Map([
			["source", { x: 120, y: 70, width: 80, height: 40 }],
			["target", { x: 300, y: 70, width: 80, height: 40 }],
		])
		const { canvas, elementData } = createCanvasStub(["source", "target"], 1, boundsById)
		elementData.set("frame", {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 100,
			y: 50,
			width: 360,
			height: 200,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [],
		})

		const contentLayer = new Konva.Group()
		const globalConnectionGroup = new Konva.Group({ name: "canvas-connections" })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const hitNode = new Konva.Rect({
			name: "hit-area",
			width: 360,
			height: 200,
		})
		const backgroundNode = new Konva.Rect({
			name: "background",
			width: 360,
			height: 200,
		})
		const sourceNode = new Konva.Group({ id: "source" })
		const targetNode = new Konva.Group({ id: "target" })
		frameNode.add(hitNode, backgroundNode, sourceNode, targetNode)
		contentLayer.add(globalConnectionGroup, frameNode)

		const mutableCanvas = canvas
		Object.assign(
			mutableCanvas as unknown as {
				contentLayer: Konva.Group
				connectionGroup: Konva.Group
				ensureConnectionGroup: ReturnType<typeof vi.fn>
			},
			{
				contentLayer,
				connectionGroup: globalConnectionGroup,
				ensureConnectionGroup: vi.fn(() => globalConnectionGroup),
			},
		)
		Object.assign(mutableCanvas.elementManager, {
			findParentIdForElement: vi.fn((elementId: string) =>
				elementId === "source" || elementId === "target" ? "frame" : undefined,
			),
			getElementInstance: vi.fn((elementId: string) =>
				elementId === "frame" ? { getNode: () => frameNode } : undefined,
			),
		})

		const manager = new ConnectionManager({ canvas: mutableCanvas })
		manager.loadDocument({
			connections: [{ id: "in-frame", sourceElementId: "source", targetElementId: "target" }],
		})

		const localConnectionGroup = getRequiredGroup(
			frameNode.findOne(".canvas-local-connections"),
			"local connection group",
		)
		expect(localConnectionGroup).toBeInstanceOf(Konva.Group)
		expect(globalConnectionGroup.children).toHaveLength(0)
		expect(localConnectionGroup.zIndex()).toBe(backgroundNode.zIndex() + 1)
		expect(localConnectionGroup.zIndex()).toBeLessThan(sourceNode.zIndex())
		expect(localConnectionGroup.x()).toBeCloseTo(-100)
		expect(localConnectionGroup.y()).toBeCloseTo(-50)
		expect(localConnectionGroup.findOne(`.${CONNECTION_VISUAL_PATH_NAME}`)).toBeInstanceOf(
			Konva.Path,
		)
	})

	it("renders cross-frame connections globally and inside the endpoint frame", () => {
		const boundsById = new Map([
			["source", { x: 120, y: 70, width: 80, height: 40 }],
			["target", { x: 520, y: 70, width: 80, height: 40 }],
		])
		const { canvas, elementData } = createCanvasStub(["source", "target"], 1, boundsById)
		elementData.set("frame", {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 100,
			y: 50,
			width: 360,
			height: 200,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [],
		})

		const contentLayer = new Konva.Group()
		const globalConnectionGroup = new Konva.Group({ name: "canvas-connections" })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const hitNode = new Konva.Rect({
			name: "hit-area",
			width: 360,
			height: 200,
		})
		const backgroundNode = new Konva.Rect({
			name: "background",
			width: 360,
			height: 200,
		})
		const sourceNode = new Konva.Group({ id: "source" })
		const targetNode = new Konva.Group({ id: "target" })
		frameNode.add(hitNode, backgroundNode, sourceNode)
		contentLayer.add(globalConnectionGroup, frameNode, targetNode)

		const mutableCanvas = canvas
		Object.assign(
			mutableCanvas as unknown as {
				contentLayer: Konva.Group
				connectionGroup: Konva.Group
				ensureConnectionGroup: ReturnType<typeof vi.fn>
			},
			{
				contentLayer,
				connectionGroup: globalConnectionGroup,
				ensureConnectionGroup: vi.fn(() => globalConnectionGroup),
			},
		)
		Object.assign(mutableCanvas.elementManager, {
			findParentIdForElement: vi.fn((elementId: string) =>
				elementId === "source" ? "frame" : undefined,
			),
			getElementInstance: vi.fn((elementId: string) =>
				elementId === "frame" ? { getNode: () => frameNode } : undefined,
			),
		})

		const manager = new ConnectionManager({ canvas: mutableCanvas })
		manager.loadDocument({
			connections: [
				{ id: "cross-frame", sourceElementId: "source", targetElementId: "target" },
			],
		})

		const localConnectionGroup = getRequiredGroup(
			frameNode.findOne(".canvas-local-connections"),
			"local connection group",
		)
		expect(globalConnectionGroup.children).toHaveLength(1)
		expect(localConnectionGroup).toBeInstanceOf(Konva.Group)
		expect(localConnectionGroup.children).toHaveLength(1)
		expect(localConnectionGroup.zIndex()).toBe(backgroundNode.zIndex() + 1)
		expect(localConnectionGroup.zIndex()).toBeLessThan(sourceNode.zIndex())
		expect(localConnectionGroup.x()).toBeCloseTo(-100)
		expect(localConnectionGroup.y()).toBeCloseTo(-50)
	})

	it("thins visual connection stroke after the viewport shrinks past the threshold", () => {
		const scale = CONNECTION_STROKE_SCALE_STYLE.shrinkStartScale / 2
		const { canvas, connectionGroup } = createCanvasStub(undefined, scale)
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [{ id: "thin", sourceElementId: "source", targetElementId: "target" }],
		})

		const renderedNode = getLastRenderedConnectionGroup(connectionGroup)
		const hitPath = getConnectionPath(renderedNode, CONNECTION_HIT_PATH_NAME)
		const visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)
		const screenStrokeWidth = visualPath.strokeWidth() * scale

		expect(screenStrokeWidth).toBeCloseTo(
			resolveConnectionScreenStrokeWidth(CONNECTION_LINE_STYLE.strokeWidth, scale),
		)
		expect(screenStrokeWidth).toBeLessThan(CONNECTION_LINE_STYLE.strokeWidth)
		expect(hitPath.strokeWidth() * scale).toBeCloseTo(CONNECTION_HIT_STYLE.strokeWidth)
	})

	it("removes connections attached to deleted elements", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [
				{ id: "a", sourceElementId: "source", targetElementId: "target" },
				{ id: "b", sourceElementId: "target", targetElementId: "other" },
			],
		})

		manager.removeConnectionsByElementId("target")
		expect(manager.exportConnections()).toEqual([])
	})

	it("selects one connection independently from element selection", () => {
		const { canvas, connectionGroup, selectionManager } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onSelect = vi.fn()
		canvas.eventEmitter.on("connection:select", onSelect)

		manager.loadDocument({
			connections: [{ id: "selected", sourceElementId: "source", targetElementId: "target" }],
		})

		expect(manager.selectConnection("selected")).toBe(true)
		expect(selectionManager.deselectAll).toHaveBeenCalledTimes(1)
		expect(manager.getSelectedConnectionId()).toBe("selected")
		expect(onSelect).toHaveBeenCalledWith({
			type: "connection:select",
			data: { connectionId: "selected" },
		})

		const renderedNode = getLastRenderedConnectionGroup(connectionGroup)
		const visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)
		expect(visualPath.stroke()).toBe(CONNECTION_SELECTED_LINE_STYLE.stroke)
		expect(visualPath.strokeWidth()).toBe(CONNECTION_SELECTED_LINE_STYLE.strokeWidth)
		expect(visualPath.opacity()).toBe(CONNECTION_SELECTED_LINE_STYLE.opacity)
	})

	it("applies hover line style while preserving selected priority", () => {
		const originalRequestAnimationFrame = globalThis.requestAnimationFrame
		const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
		const frameCallbacks: FrameRequestCallback[] = []
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				frameCallbacks.push(callback)
				return frameCallbacks.length
			}),
		)
		vi.stubGlobal("cancelAnimationFrame", vi.fn())

		try {
			const { canvas, connectionGroup } = createCanvasStub()
			const manager = new ConnectionManager({ canvas })
			;(canvas as Canvas & { connectionManager: ConnectionManager }).connectionManager =
				manager

			manager.loadDocument({
				connections: [
					{ id: "hovered", sourceElementId: "source", targetElementId: "target" },
				],
			})

			let renderedNode = getLastRenderedConnectionGroup(connectionGroup)
			let hitPath = getConnectionPath(renderedNode, CONNECTION_HIT_PATH_NAME)
			let visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)

			hitPath.fire("mouseenter")
			expect(visualPath.stroke()).toBe(CONNECTION_HOVER_LINE_STYLE.stroke)
			expect(visualPath.opacity()).toBe(CONNECTION_HOVER_LINE_STYLE.opacity)

			hitPath.fire("mouseleave")
			expect(visualPath.stroke()).toBe(CONNECTION_HOVER_LINE_STYLE.stroke)
			expect(frameCallbacks).toHaveLength(1)
			frameCallbacks[0](0)
			expect(visualPath.stroke()).toBe(CONNECTION_LINE_STYLE.stroke)
			expect(visualPath.opacity()).toBe(CONNECTION_LINE_STYLE.opacity)

			manager.selectConnection("hovered", { autoFocus: false })
			renderedNode = getLastRenderedConnectionGroup(connectionGroup)
			hitPath = getConnectionPath(renderedNode, CONNECTION_HIT_PATH_NAME)
			visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)

			hitPath.fire("mouseenter")
			expect(visualPath.stroke()).toBe(CONNECTION_SELECTED_LINE_STYLE.stroke)
			expect(visualPath.opacity()).toBe(CONNECTION_SELECTED_LINE_STYLE.opacity)
		} finally {
			if (originalRequestAnimationFrame) {
				vi.stubGlobal("requestAnimationFrame", originalRequestAnimationFrame)
			} else {
				Reflect.deleteProperty(globalThis, "requestAnimationFrame")
			}
			if (originalCancelAnimationFrame) {
				vi.stubGlobal("cancelAnimationFrame", originalCancelAnimationFrame)
			} else {
				Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
			}
		}
	})

	it("keeps connection selection when element selection events are emitted", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onDeselect = vi.fn()
		canvas.eventEmitter.on("connection:deselect", onDeselect)

		manager.loadDocument({
			connections: [{ id: "selected", sourceElementId: "source", targetElementId: "target" }],
		})
		manager.selectConnection("selected", { autoFocus: false })

		canvas.eventEmitter.emit({
			type: "element:select",
			data: { elementIds: ["source"] },
		})

		expect(manager.getSelectedConnectionId()).toBe("selected")
		expect(onDeselect).not.toHaveBeenCalled()
	})

	it("highlights connections attached to selected elements without selecting those connections", () => {
		const { canvas, connectionGroup } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [{ id: "edge", sourceElementId: "source", targetElementId: "target" }],
		})

		const renderedNode = getLastRenderedConnectionGroup(connectionGroup)
		const visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)
		expect(visualPath.stroke()).toBe(CONNECTION_LINE_STYLE.stroke)

		canvas.eventEmitter.emit({
			type: "element:select",
			data: { elementIds: ["source"] },
		})
		expect(visualPath.stroke()).toBe(CONNECTION_SELECTED_LINE_STYLE.stroke)
		expect(visualPath.opacity()).toBe(CONNECTION_SELECTED_LINE_STYLE.opacity)
		expect(manager.getSelectedConnectionIds()).toEqual([])

		canvas.eventEmitter.emit({
			type: "element:deselect",
			data: { elementIds: ["source"] },
		})
		expect(visualPath.stroke()).toBe(CONNECTION_LINE_STYLE.stroke)
		expect(visualPath.opacity()).toBe(CONNECTION_LINE_STYLE.opacity)
	})

	it("supports append and toggle connection selection", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onSelectionChange = vi.fn()
		canvas.eventEmitter.on("connection:selection:change", onSelectionChange)

		manager.loadDocument({
			connections: [
				{ id: "a", sourceElementId: "source", targetElementId: "target" },
				{ id: "b", sourceElementId: "target", targetElementId: "other" },
			],
		})

		manager.selectConnection("a", { autoFocus: false })
		manager.selectConnection("b", { append: true, autoFocus: false })
		expect(manager.getSelectedConnectionIds()).toEqual(["a", "b"])

		manager.selectConnection("a", { toggle: true, autoFocus: false })
		expect(manager.getSelectedConnectionIds()).toEqual(["b"])
		expect(onSelectionChange).toHaveBeenLastCalledWith({
			type: "connection:selection:change",
			data: {
				selectedConnectionIds: ["b"],
				addedConnectionIds: [],
				removedConnectionIds: ["a"],
			},
		})
	})

	it("finds connections intersecting a selection box", () => {
		const boundsById = new Map([
			["source", { x: 0, y: 0, width: 100, height: 40 }],
			["target", { x: 220, y: 0, width: 100, height: 40 }],
			["other", { x: 0, y: 300, width: 100, height: 40 }],
		])
		const { canvas } = createCanvasStub(undefined, 1, boundsById)
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [
				{ id: "inside", sourceElementId: "source", targetElementId: "target" },
				{ id: "outside", sourceElementId: "target", targetElementId: "other" },
			],
		})

		expect(manager.findConnectionsInBox({ x: 145, y: 10, width: 40, height: 20 })).toEqual([
			"inside",
		])
	})

	it("deletes the selected connection through the connection manager", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		manager.loadDocument({
			connections: [{ id: "selected", sourceElementId: "source", targetElementId: "target" }],
		})
		manager.selectConnection("selected", { autoFocus: false })

		expect(manager.deleteSelectedConnection()).toBe(true)
		expect(manager.getSelectedConnectionId()).toBeNull()
		expect(manager.exportConnections()).toEqual([])
		expect(onConnectionChange).toHaveBeenCalledWith({
			type: "connection:change",
			data: {
				connections: [],
				changedConnectionIds: undefined,
				deletedConnectionIds: ["selected"],
			},
		})
	})

	it("syncs VideoEdit inputs when connections are added or removed", () => {
		const { canvas, elementData, documentOwnedIds } = createCanvasStub([
			"video-1",
			"video-2",
			"audio-1",
			"editor",
		])
		;["video-1", "video-2", "audio-1", "editor"].forEach((id) => documentOwnedIds.add(id))
		elementData.set("video-1", {
			id: "video-1",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			activeContentId: "video-1-content",
			mainContentId: "video-1-content",
			contents: [{ contentId: "video-1-content", src: "/1.mp4" }],
		} as LayerElement)
		elementData.set("video-2", {
			id: "video-2",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			activeContentId: "video-2-content",
			mainContentId: "video-2-content",
			contents: [{ contentId: "video-2-content", src: "/2.mp4" }],
		} as LayerElement)
		elementData.set("audio-1", {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			activeContentId: "audio-1-content",
			mainContentId: "audio-1-content",
			contents: [{ contentId: "audio-1-content", src: "/voice.wav" }],
		} as LayerElement)
		elementData.set("editor", createVideoEditElement("editor"))
		const manager = new ConnectionManager({ canvas })

		const videoConnection = manager.connectElements({
			sourceElementId: "video-1",
			targetElementId: "editor",
		})
		expect(videoConnection.status).toBe("created")

		const secondVideoConnection = manager.connectElements({
			sourceElementId: "video-2",
			targetElementId: "editor",
		})
		expect(secondVideoConnection.status).toBe("created")

		const audioConnection = manager.connectElements({
			sourceElementId: "audio-1",
			targetElementId: "editor",
		})
		expect(audioConnection.status).toBe("created")

		if (secondVideoConnection.status !== "created") throw new Error("Expected video connection")
		manager.removeConnection(secondVideoConnection.connectionId)

		if (audioConnection.status !== "created") throw new Error("Expected audio connection")
		manager.removeConnection(audioConnection.connectionId)
	})

	it("cleans deleted element connections without emitting a separate connection change", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		manager.loadDocument({
			connections: [
				{ id: "a", sourceElementId: "source", targetElementId: "target" },
				{ id: "b", sourceElementId: "target", targetElementId: "other" },
			],
		})

		canvas.eventEmitter.emit({
			type: "element:deleted",
			data: { elementId: "target" },
		})

		expect(manager.exportConnections()).toEqual([])
		expect(onConnectionChange).not.toHaveBeenCalled()
	})

	it("batches transform rerenders until the next frame and refreshes moved geometry", () => {
		const originalRequestAnimationFrame = globalThis.requestAnimationFrame
		const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
		const frameCallbacks: FrameRequestCallback[] = []
		const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
			frameCallbacks.push(callback)
			return frameCallbacks.length
		})
		const cancelAnimationFrameMock = vi.fn()
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock)
		vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock)

		try {
			const boundsById = new Map([
				["source", { x: 0, y: 0, width: 100, height: 40 }],
				["target", { x: 220, y: 0, width: 100, height: 40 }],
			])
			const { canvas, connectionGroup } = createCanvasStub(undefined, 1, boundsById)
			const manager = new ConnectionManager({ canvas })

			manager.loadDocument({
				connections: [{ id: "edge", sourceElementId: "source", targetElementId: "target" }],
			})
			const renderedNode = getLastRenderedConnectionGroup(connectionGroup)
			const visualPath = getConnectionPath(renderedNode, CONNECTION_VISUAL_PATH_NAME)
			connectionGroup.destroyChildren.mockClear()
			connectionGroup.add.mockClear()

			boundsById.set("target", { x: 300, y: 80, width: 100, height: 40 })
			canvas.eventEmitter.emit({
				type: "elements:transform:dragmove",
				data: { elementIds: ["source"] },
			})
			canvas.eventEmitter.emit({
				type: "elements:transform:dragmove",
				data: { elementIds: ["source", "target"] },
			})

			expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
			expect(connectionGroup.destroyChildren).not.toHaveBeenCalled()
			expect(connectionGroup.add).not.toHaveBeenCalled()
			expect(canvas.geometryCacheManager.invalidateElements).not.toHaveBeenCalled()

			frameCallbacks[0](0)

			expect(canvas.geometryCacheManager.invalidateElements).toHaveBeenCalledWith([
				"source",
				"target",
			])
			expect(connectionGroup.destroyChildren).not.toHaveBeenCalled()
			expect(connectionGroup.add).not.toHaveBeenCalled()
			expect(visualPath.data()).toBe("M 100 20 C 200 20 200 100 300 100")
		} finally {
			if (originalRequestAnimationFrame) {
				vi.stubGlobal("requestAnimationFrame", originalRequestAnimationFrame)
			} else {
				Reflect.deleteProperty(globalThis, "requestAnimationFrame")
			}
			if (originalCancelAnimationFrame) {
				vi.stubGlobal("cancelAnimationFrame", originalCancelAnimationFrame)
			} else {
				Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
			}
		}
	})

	it("rerenders connection geometry after a batched layout update", () => {
		const { canvas, connectionGroup } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		manager.loadDocument({
			connections: [{ id: "edge", sourceElementId: "source", targetElementId: "target" }],
		})
		const rerender = vi.spyOn(manager, "rerender")
		connectionGroup.destroyChildren.mockClear()
		connectionGroup.add.mockClear()

		canvas.eventEmitter.emit({ type: "element:batchupdated", data: undefined })

		expect(rerender).toHaveBeenCalledTimes(1)
	})

	it("invalidates only the elements named by a batched update", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const hitTester = (
			manager as unknown as {
				hitTester: {
					invalidateElements: (elementIds: string[]) => void
					invalidateAll: () => void
				}
			}
		).hitTester
		const invalidateElements = vi.spyOn(hitTester, "invalidateElements")
		const invalidateAll = vi.spyOn(hitTester, "invalidateAll")

		canvas.eventEmitter.emit({
			type: "element:batchupdated",
			data: { elementIds: ["source", "target"] },
		})

		expect(invalidateElements).toHaveBeenCalledWith(["source", "target"])
		expect(invalidateAll).not.toHaveBeenCalled()
	})

	it("adds valid connections and rejects missing or self connections", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })

		expect(
			manager.addConnection({
				id: "valid",
				sourceElementId: "source",
				targetElementId: "target",
			}),
		).toBe("valid")
		expect(
			manager.addConnection({
				sourceElementId: "source",
				targetElementId: "source",
			}),
		).toBeNull()
		expect(
			manager.addConnection({
				sourceElementId: "source",
				targetElementId: "missing",
			}),
		).toBeNull()
		expect(
			manager.addConnection({
				sourceElementId: "target",
				targetElementId: "source",
			}),
		).toBeNull()
		expect(
			manager.addConnection({
				sourceElementId: "source",
				targetElementId: "target",
			}),
		).toBeNull()
		expect(manager.exportConnections()).toEqual([
			{ id: "valid", sourceElementId: "source", targetElementId: "target" },
		])
	})

	it("rejects duplicate same-direction connections", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		const created = manager.connectElements({
			sourceElementId: "source",
			targetElementId: "target",
		})
		expect(created.status).toBe("created")
		expect(manager.exportConnections()).toHaveLength(1)
		expect(onConnectionChange).toHaveBeenCalledTimes(1)

		const connectionId = manager.exportConnections()[0].id
		expect(manager.exportDocumentPatch({ changedConnectionIds: [connectionId] })).toMatchObject(
			{
				connectionUpserts: [
					{ id: connectionId, sourceElementId: "source", targetElementId: "target" },
				],
				changedConnectionIds: [connectionId],
			},
		)
		expect(
			manager.connectElements({
				sourceElementId: "source",
				targetElementId: "target",
			}),
		).toEqual({ status: "invalid", reason: "already-connected" })
		expect(manager.exportConnections()).toEqual([
			{ id: connectionId, sourceElementId: "source", targetElementId: "target" },
		])
		expect(onConnectionChange).toHaveBeenCalledTimes(1)
	})

	it("preflights a batch and emits one change for all created edges", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		const created = manager.connectElementsBatch({
			edges: [
				{ sourceElementId: "source", targetElementId: "target" },
				{ sourceElementId: "source", targetElementId: "other" },
			],
		})

		expect(created.status).toBe("created")
		expect(created.status === "created" ? created.connectionIds : []).toHaveLength(2)
		expect(manager.exportConnections()).toHaveLength(2)
		expect(onConnectionChange).toHaveBeenCalledTimes(1)

		const rejected = manager.connectElementsBatch({
			edges: [
				{ sourceElementId: "target", targetElementId: "other" },
				{ sourceElementId: "other", targetElementId: "missing" },
			],
		})
		expect(rejected).toEqual({ status: "invalid", reason: "missing-element" })
		expect(manager.exportConnections()).toHaveLength(2)
		expect(onConnectionChange).toHaveBeenCalledTimes(1)
	})

	it("loads a connection with only the supported DSL fields", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		manager.loadDocument({
			connections: [
				{
					id: "storyboard-output",
					sourceElementId: "source",
					targetElementId: "target",
					unsupportedField: true,
				} as CanvasConnection & { unsupportedField: true },
			],
		})

		expect(manager.exportConnections()).toEqual([
			{
				id: "storyboard-output",
				sourceElementId: "source",
				targetElementId: "target",
			},
		])
		expect(manager.removeConnection("storyboard-output")).toBe(true)
		expect(manager.exportConnections()).toEqual([])
	})

	it("rejects reverse connections without changing the existing direction", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		const created = manager.connectElements({
			sourceElementId: "source",
			targetElementId: "target",
		})
		expect(created.status).toBe("created")
		const connectionId = manager.exportConnections()[0].id
		expect(manager.hasReverseConnection("target", "source")).toBe(true)

		expect(
			manager.connectElements({
				sourceElementId: "target",
				targetElementId: "source",
			}),
		).toEqual({ status: "invalid", reason: "reverse-existing" })
		expect(manager.exportConnections()).toEqual([
			{ id: connectionId, sourceElementId: "source", targetElementId: "target" },
		])
		expect(onConnectionChange).toHaveBeenCalledTimes(1)
	})

	it("rejects invalid connectElements requests without emitting changes", () => {
		const { canvas } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)

		expect(
			manager.connectElements({
				sourceElementId: "source",
				targetElementId: "source",
			}),
		).toEqual({ status: "invalid", reason: "self" })
		expect(
			manager.connectElements({
				sourceElementId: "source",
				targetElementId: "missing",
			}),
		).toEqual({ status: "invalid", reason: "missing-element" })
		expect(manager.exportConnections()).toEqual([])
		expect(onConnectionChange).not.toHaveBeenCalled()
	})

	it("rejects connections whose endpoint is still runtime-only", () => {
		const { canvas, documentOwnedIds } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const onConnectionChange = vi.fn()
		canvas.eventEmitter.on("connection:change", onConnectionChange)
		documentOwnedIds.delete("target")

		expect(
			manager.connectElements({ sourceElementId: "source", targetElementId: "target" }),
		).toEqual({ status: "invalid", reason: "temporary-element" })
		expect(
			manager.addConnection({ sourceElementId: "source", targetElementId: "target" }),
		).toBeNull()
		expect(onConnectionChange).not.toHaveBeenCalled()
	})

	it("filters a connection defensively when an endpoint becomes runtime-only", () => {
		const { canvas, documentOwnedIds } = createCanvasStub()
		const manager = new ConnectionManager({ canvas })
		const created = manager.connectElements({
			sourceElementId: "source",
			targetElementId: "target",
		})
		expect(created.status).toBe("created")
		if (created.status !== "created") throw new Error("Expected connection to be created")

		documentOwnedIds.delete("target")

		expect(manager.getConnections()).toHaveLength(1)
		expect(manager.exportConnections()).toEqual([])
		expect(
			manager.exportDocumentPatch({ changedConnectionIds: [created.connectionId] }),
		).toMatchObject({ connectionUpserts: [], changedConnectionIds: [] })
	})
})
