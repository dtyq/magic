import Konva from "konva"
import { describe, expect, it, vi } from "vitest"
import type { LayerElement } from "../../../document/types"
import { ElementManager } from "../ElementManager"

interface ElementStub {
	data: LayerElement
	node: Konva.Node
	getData: () => LayerElement
	getNode: () => Konva.Node
	update: (data: LayerElement) => boolean
}

function createElementStub(data: LayerElement, node: Konva.Node): ElementStub {
	const stub: ElementStub = {
		data,
		node,
		getData: () => stub.data,
		getNode: () => stub.node,
		update: (nextData) => {
			stub.data = nextData
			return false
		},
	}
	return stub
}

function createHarness(options: {
	elements: ElementStub[]
	parents?: Record<string, string>
	topLevelIds?: string[]
	canReparent?: boolean | ((element: LayerElement) => boolean)
}) {
	// Group 已能提供本用例需要的容器和坐标变换，避免 jsdom 创建真实 canvas context。
	const contentLayer = new Konva.Group()
	const emit = vi.fn()
	const manager = Object.create(ElementManager.prototype) as ElementManager
	const elementMap = new Map(options.elements.map((element) => [element.data.id, element]))

	Object.assign(manager as unknown as Record<string, unknown>, {
		elements: elementMap,
		dataTreeVisibilityCache: new Map<string, boolean>(),
		temporaryElements: new Map(),
		canvas: {
			contentLayer,
			permissionManager: {
				canReparentElement: vi.fn((element: LayerElement) =>
					typeof options.canReparent === "function"
						? options.canReparent(element)
						: (options.canReparent ?? true),
				),
			},
			runtimeScheduler: { requestLayerDraw: vi.fn() },
			eventEmitter: { emit },
		},
		findParentIdForElement: vi.fn((elementId: string) => options.parents?.[elementId]),
		getAllElements: vi.fn(() =>
			(options.topLevelIds ?? [])
				.map((elementId) => elementMap.get(elementId)?.getData())
				.filter((element): element is LayerElement => element !== undefined),
		),
		getNextZIndexInLevel: vi.fn(() => 7),
		markDocumentIndexDirty: vi.fn(),
		invalidateGeometryForElement: vi.fn(),
		reorderChildrenInParentPublic: vi.fn(),
		reorderTopLevelElementsPublic: vi.fn(),
	})

	return { contentLayer, emit, manager }
}

function createRectangle(id: string, x: number, y: number): LayerElement {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 80,
		zIndex: 2,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	}
}

function createFrame(
	id: string,
	x: number,
	y: number,
	children: LayerElement[] = [],
): LayerElement {
	return {
		id,
		type: "frame",
		x,
		y,
		width: 400,
		height: 300,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
		children,
	}
}

describe("ElementManager reparentElement", () => {
	it("moves a root element into a frame while preserving its content position", () => {
		const childData = createRectangle("child", 150, 90)
		const frameData = createFrame("frame", 100, 50)
		const childNode = new Konva.Group({ id: "child", x: 150, y: 90 })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const child = createElementStub(childData, childNode)
		const frame = createElementStub(frameData, frameNode)
		const { contentLayer, emit, manager } = createHarness({ elements: [child, frame] })
		;(
			manager as unknown as { dataTreeVisibilityCache: Map<string, boolean> }
		).dataTreeVisibilityCache.set("child", false)
		contentLayer.add(frameNode, childNode)

		const changed = manager.reparentElement("child", {
			targetParentId: "frame",
			positionInContent: { x: 150, y: 90 },
		})

		expect(changed).toBe(true)
		expect(
			(manager as unknown as { dataTreeVisibilityCache: Map<string, boolean> })
				.dataTreeVisibilityCache,
		).toEqual(new Map())
		expect(childNode.getParent()).toBe(frameNode)
		expect(childNode.position()).toEqual({ x: 50, y: 40 })
		expect(child.data).toEqual(expect.objectContaining({ x: 50, y: 40, zIndex: 7 }))
		expect(frame.data).toEqual(expect.objectContaining({ children: [child.data] }))
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:change",
			data: { phase: "commit", elementIds: ["child", "frame"], nameChanges: undefined },
		})
	})

	it("moves an element between frames and updates both children arrays", () => {
		const childData = createRectangle("child", 20, 30)
		const sourceData = createFrame("source", 100, 50, [childData])
		const targetData = createFrame("target", 300, 200)
		const childNode = new Konva.Group({ id: "child", x: 20, y: 30 })
		const sourceNode = new Konva.Group({ id: "source", x: 100, y: 50 })
		const targetNode = new Konva.Group({ id: "target", x: 300, y: 200 })
		sourceNode.add(childNode)
		const child = createElementStub(childData, childNode)
		const source = createElementStub(sourceData, sourceNode)
		const target = createElementStub(targetData, targetNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [child, source, target],
			parents: { child: "source" },
		})
		contentLayer.add(sourceNode, targetNode)

		const changed = manager.reparentElement("child", {
			targetParentId: "target",
			positionInContent: { x: 350, y: 260 },
		})

		expect(changed).toBe(true)
		expect(source.data).toEqual(expect.objectContaining({ children: [] }))
		expect(target.data).toEqual(expect.objectContaining({ children: [child.data] }))
		expect(childNode.getParent()).toBe(targetNode)
		expect(childNode.position()).toEqual({ x: 50, y: 60 })
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:change",
			data: {
				phase: "commit",
				elementIds: ["child", "source", "target"],
				nameChanges: undefined,
			},
		})
	})

	it("places an element released to root directly above its source frame", () => {
		const childData = createRectangle("child", 20, 30)
		const sourceData = { ...createFrame("source", 100, 50, [childData]), zIndex: 2 }
		const upperData = { ...createRectangle("upper", 500, 300), zIndex: 3 }
		const childNode = new Konva.Group({ id: "child", x: 120, y: 80 })
		const sourceNode = new Konva.Group({ id: "source", x: 100, y: 50 })
		const upperNode = new Konva.Group({ id: "upper", x: 500, y: 300 })
		const child = createElementStub(childData, childNode)
		const source = createElementStub(sourceData, sourceNode)
		const upper = createElementStub(upperData, upperNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [child, source, upper],
			parents: { child: "source" },
			topLevelIds: ["source", "upper"],
		})
		contentLayer.add(sourceNode, childNode, upperNode)

		const changed = manager.reparentElement("child", {
			targetParentId: null,
			positionInContent: { x: 350, y: 260 },
		})

		expect(changed).toBe(true)
		expect(child.data.zIndex).toBe(3)
		expect(upper.data.zIndex).toBe(4)
		expect(source.data).toEqual(expect.objectContaining({ children: [] }))
		expect(childNode.getParent()).toBe(contentLayer)
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:change",
			data: {
				phase: "commit",
				elementIds: ["child", "source", "upper"],
				nameChanges: undefined,
			},
		})
	})

	it("rejects children whose source parent is not a frame", () => {
		const childData = createRectangle("child", 20, 30)
		const groupData = {
			...createFrame("group", 0, 0, [childData]),
			type: "group",
		} as LayerElement
		const targetData = createFrame("target", 300, 200)
		const child = createElementStub(childData, new Konva.Group({ id: "child" }))
		const group = createElementStub(groupData, new Konva.Group({ id: "group" }))
		const target = createElementStub(targetData, new Konva.Group({ id: "target" }))
		const { emit, manager } = createHarness({
			elements: [child, group, target],
			parents: { child: "group" },
		})

		expect(
			manager.reparentElement("child", {
				targetParentId: "target",
				positionInContent: { x: 350, y: 260 },
			}),
		).toBe(false)
		expect(emit).not.toHaveBeenCalled()
	})

	it("allows a silent same-parent restore without emitting a committed change", () => {
		const childData = createRectangle("child", 150, 90)
		const frameData = createFrame("frame", 100, 50, [childData])
		const childNode = new Konva.Group({ id: "child", x: 150, y: 90 })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const child = createElementStub(childData, childNode)
		const frame = createElementStub(frameData, frameNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [child, frame],
			parents: { child: "frame" },
			canReparent: false,
		})
		contentLayer.add(frameNode, childNode)

		expect(
			manager.reparentElement("child", {
				targetParentId: "frame",
				positionInContent: { x: 150, y: 90 },
				silent: true,
			}),
		).toBe(true)
		expect(childNode.getParent()).toBe(frameNode)
		expect(childNode.position()).toEqual({ x: 50, y: 40 })
		expect(frame.data).toEqual(expect.objectContaining({ children: [child.data] }))
		expect(emit).not.toHaveBeenCalled()
	})

	it("moves multiple root elements into a frame as one ordered top-level block", () => {
		const lowerData = { ...createRectangle("lower", 150, 90), zIndex: 1 }
		const upperData = { ...createRectangle("upper", 260, 140), zIndex: 2 }
		const frameData = createFrame("frame", 100, 50)
		const lowerNode = new Konva.Group({ id: "lower", x: 150, y: 90 })
		const upperNode = new Konva.Group({ id: "upper", x: 260, y: 140 })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const lower = createElementStub(lowerData, lowerNode)
		const upper = createElementStub(upperData, upperNode)
		const frame = createElementStub(frameData, frameNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [lower, upper, frame],
		})
		contentLayer.add(frameNode, lowerNode, upperNode)

		const changed = manager.reparentElements({
			targetParentId: "frame",
			elements: [
				{ elementId: "lower", positionInContent: { x: 150, y: 90 } },
				{ elementId: "upper", positionInContent: { x: 260, y: 140 } },
			],
		})

		expect(changed).toBe(true)
		expect(lowerNode.position()).toEqual({ x: 50, y: 40 })
		expect(upperNode.position()).toEqual({ x: 160, y: 90 })
		expect(lower.data.zIndex).toBe(7)
		expect(upper.data.zIndex).toBe(8)
		expect(frame.data).toEqual(expect.objectContaining({ children: [lower.data, upper.data] }))
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:change",
			data: {
				phase: "commit",
				elementIds: ["lower", "upper", "frame"],
				nameChanges: undefined,
			},
		})
	})

	it("releases multiple frame children as a consecutive block above the source frame", () => {
		const lowerData = { ...createRectangle("lower", 20, 30), zIndex: 1 }
		const upperData = { ...createRectangle("upper", 80, 90), zIndex: 2 }
		const sourceData = {
			...createFrame("source", 100, 50, [lowerData, upperData]),
			zIndex: 2,
		}
		const existingUpperData = { ...createRectangle("existing-upper", 500, 300), zIndex: 3 }
		const lowerNode = new Konva.Group({ id: "lower", x: 120, y: 80 })
		const upperNode = new Konva.Group({ id: "upper", x: 180, y: 140 })
		const sourceNode = new Konva.Group({ id: "source", x: 100, y: 50 })
		const existingUpperNode = new Konva.Group({ id: "existing-upper", x: 500, y: 300 })
		const lower = createElementStub(lowerData, lowerNode)
		const upper = createElementStub(upperData, upperNode)
		const source = createElementStub(sourceData, sourceNode)
		const existingUpper = createElementStub(existingUpperData, existingUpperNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [lower, upper, source, existingUpper],
			parents: { lower: "source", upper: "source" },
			topLevelIds: ["source", "existing-upper"],
		})
		contentLayer.add(sourceNode, lowerNode, upperNode, existingUpperNode)

		const changed = manager.reparentElements({
			targetParentId: null,
			elements: [
				{ elementId: "lower", positionInContent: { x: 220, y: 180 } },
				{ elementId: "upper", positionInContent: { x: 280, y: 240 } },
			],
		})

		expect(changed).toBe(true)
		expect(lower.data.zIndex).toBe(3)
		expect(upper.data.zIndex).toBe(4)
		expect(existingUpper.data.zIndex).toBe(5)
		expect(source.data).toEqual(expect.objectContaining({ children: [] }))
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:change",
			data: {
				phase: "commit",
				elementIds: ["lower", "upper", "source", "existing-upper"],
				nameChanges: undefined,
			},
		})
	})

	it("does not mutate any element when one item fails batch preflight", () => {
		const allowedData = createRectangle("allowed", 150, 90)
		const deniedData = createRectangle("denied", 260, 140)
		const frameData = createFrame("frame", 100, 50)
		const allowedNode = new Konva.Group({ id: "allowed", x: 150, y: 90 })
		const deniedNode = new Konva.Group({ id: "denied", x: 260, y: 140 })
		const frameNode = new Konva.Group({ id: "frame", x: 100, y: 50 })
		const allowed = createElementStub(allowedData, allowedNode)
		const denied = createElementStub(deniedData, deniedNode)
		const frame = createElementStub(frameData, frameNode)
		const { contentLayer, emit, manager } = createHarness({
			elements: [allowed, denied, frame],
			canReparent: (element) => element.id !== "denied",
		})
		contentLayer.add(frameNode, allowedNode, deniedNode)

		expect(
			manager.reparentElements({
				targetParentId: "frame",
				elements: [
					{ elementId: "allowed", positionInContent: { x: 150, y: 90 } },
					{ elementId: "denied", positionInContent: { x: 260, y: 140 } },
				],
			}),
		).toBe(false)
		expect(allowed.data).toBe(allowedData)
		expect(denied.data).toBe(deniedData)
		expect(frame.data).toBe(frameData)
		expect(allowedNode.getParent()).toBe(contentLayer)
		expect(deniedNode.getParent()).toBe(contentLayer)
		expect(emit).not.toHaveBeenCalled()
	})
})
