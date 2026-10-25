import Konva from "konva"
import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import type { LayerElement } from "../../../document/types"
import { FrameManager } from "../FrameManager"
import { resolveFrameContentLayout } from "../frameCreation"

describe("FrameManager frame creation", () => {
	it("uses 8% of the content short edge as the default padding", () => {
		const elements = new Map<string, LayerElement>([
			[
				"first",
				{
					id: "first",
					type: "rectangle",
					x: 100,
					y: 200,
					width: 100,
					height: 50,
					zIndex: 1,
					activeContentId: "first-content",
					mainContentId: "first-content",
					contents: [{ contentId: "first-content" }],
				},
			],
			[
				"second",
				{
					id: "second",
					type: "rectangle",
					x: 250,
					y: 260,
					width: 80,
					height: 40,
					zIndex: 2,
					activeContentId: "second-content",
					mainContentId: "second-content",
					contents: [{ contentId: "second-content" }],
				},
			],
		])
		const contentLayer = new Konva.Group()
		const nodes = new Map<string, Konva.Group>([
			["first", new Konva.Group({ id: "first", x: 100, y: 200 })],
			["second", new Konva.Group({ id: "second", x: 250, y: 260 })],
		])
		contentLayer.add(nodes.get("first")!, nodes.get("second")!)

		let createdFrameData: LayerElement | undefined
		const update = vi.fn()
		const emit = vi.fn()
		const frameLayer = { batchDraw: vi.fn() } as unknown as Konva.Layer
		const canvas = {
			contentLayer,
			can: vi.fn(() => true),
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
				emit,
			},
			transformManager: { rebaseActiveDragNodePositions: vi.fn() },
			selectionManager: {
				getSelectedIds: vi.fn(() => ["first", "second"]),
				select: vi.fn(),
			},
			permissionManager: {
				canAddToFrame: vi.fn(() => true),
			},
			historyManager: {
				disable: vi.fn(),
				enable: vi.fn(),
				recordHistoryImmediate: vi.fn(),
			},
			elementManager: {
				getElementData: vi.fn((id: string) => elements.get(id)),
				create: vi.fn((elementData: LayerElement) => {
					createdFrameData = elementData
					const frameNode = new Konva.Group({
						id: elementData.id,
						x: elementData.x,
						y: elementData.y,
					})
					vi.spyOn(frameNode, "getLayer").mockReturnValue(frameLayer)
					nodes.set(elementData.id, frameNode)
					contentLayer.add(frameNode)
				}),
				delete: vi.fn(),
				update,
				getElementInstance: vi.fn(() => undefined),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn((id: string) => nodes.get(id) ?? null),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		const frameId = manager.createFrame()

		expect(createdFrameData).toEqual(
			expect.objectContaining({
				id: frameId,
				type: "frame",
				children: [],
			}),
		)
		expect(createdFrameData?.x).toBeCloseTo(92)
		expect(createdFrameData?.y).toBeCloseTo(192)
		expect(createdFrameData?.width).toBeCloseTo(246)
		expect(createdFrameData?.height).toBeCloseTo(116)
		expect(nodes.get("first")?.position().x).toBeCloseTo(8)
		expect(nodes.get("first")?.position().y).toBeCloseTo(8)
		expect(nodes.get("second")?.position().x).toBeCloseTo(158)
		expect(nodes.get("second")?.position().y).toBeCloseTo(68)
		expect(update).toHaveBeenCalledWith(
			frameId,
			expect.objectContaining({
				children: [
					expect.objectContaining({
						id: "second",
						x: expect.closeTo(158),
						y: expect.closeTo(68),
					}),
					expect.objectContaining({
						id: "first",
						x: expect.closeTo(8),
						y: expect.closeTo(8),
					}),
				],
			}),
		)
		expect(emit).toHaveBeenCalledWith({ type: "frame:created", data: { frameId } })
	})

	it("uses the content height when it is the long edge", () => {
		expect(resolveFrameContentLayout({ width: 100, height: 200 })).toEqual({
			padding: 8,
			width: 116,
			height: 216,
		})
	})

	it("rounds generated frame dimensions up to preserve the content bounds", () => {
		expect(
			resolveFrameContentLayout({ width: 101.2, height: 99.4 }, { padding: 7.13 }),
		).toEqual({
			padding: 7.13,
			width: 116,
			height: 114,
		})
	})
})

describe("FrameManager frame removal", () => {
	it("deletes an empty frame when removing its frame wrapper", () => {
		const frame: LayerElement = {
			id: "empty-frame",
			type: "frame",
			x: 100,
			y: 200,
			width: 300,
			height: 200,
			children: [],
			activeContentId: "empty-frame-content",
			mainContentId: "empty-frame-content",
			contents: [{ contentId: "empty-frame-content" }],
		}
		const deleteElement = vi.fn()
		const emit = vi.fn()
		const canvas = {
			can: vi.fn(() => true),
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
				emit,
			},
			selectionManager: {
				getSelectedIds: vi.fn(() => ["empty-frame"]),
			},
			permissionManager: {
				canRemoveFrame: vi.fn(() => true),
			},
			historyManager: {
				disable: vi.fn(),
				enable: vi.fn(),
				recordHistoryImmediate: vi.fn(),
			},
			elementManager: {
				getElementData: vi.fn(() => frame),
				delete: deleteElement,
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		expect(manager.removeFrame()).toEqual([])
		expect(deleteElement).toHaveBeenCalledWith("empty-frame")
		expect(emit).toHaveBeenCalledWith({
			type: "frame:removed",
			data: { frameId: "empty-frame" },
		})
		expect(canvas.historyManager.disable).toHaveBeenCalledOnce()
		expect(canvas.historyManager.recordHistoryImmediate).toHaveBeenCalledOnce()
	})
})

describe("FrameManager frame creation", () => {
	it("expands the created frame bounds without moving selected content", () => {
		const elements = new Map<string, LayerElement>([
			[
				"first",
				{
					id: "first",
					type: "rectangle",
					x: 100,
					y: 200,
					width: 100,
					height: 50,
					zIndex: 1,
					activeContentId: "first-content",
					mainContentId: "first-content",
					contents: [{ contentId: "first-content" }],
				},
			],
			[
				"second",
				{
					id: "second",
					type: "rectangle",
					x: 250,
					y: 260,
					width: 80,
					height: 40,
					zIndex: 2,
					activeContentId: "second-content",
					mainContentId: "second-content",
					contents: [{ contentId: "second-content" }],
				},
			],
		])
		const contentLayer = new Konva.Group()
		const nodes = new Map<string, Konva.Group>([
			["first", new Konva.Group({ id: "first", x: 100, y: 200 })],
			["second", new Konva.Group({ id: "second", x: 250, y: 260 })],
		])
		contentLayer.add(nodes.get("first")!, nodes.get("second")!)

		let createdFrameData: LayerElement | undefined
		const update = vi.fn()
		const emit = vi.fn()
		const frameLayer = { batchDraw: vi.fn() } as unknown as Konva.Layer
		const canvas = {
			contentLayer,
			can: vi.fn(() => true),
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
				emit,
			},
			transformManager: { rebaseActiveDragNodePositions: vi.fn() },
			selectionManager: {
				getSelectedIds: vi.fn(() => ["first", "second"]),
				select: vi.fn(),
			},
			permissionManager: {
				canAddToFrame: vi.fn(() => true),
			},
			historyManager: {
				disable: vi.fn(),
				enable: vi.fn(),
				recordHistoryImmediate: vi.fn(),
			},
			elementManager: {
				getElementData: vi.fn((id: string) => elements.get(id)),
				create: vi.fn((elementData: LayerElement) => {
					createdFrameData = elementData
					const frameNode = new Konva.Group({
						id: elementData.id,
						x: elementData.x,
						y: elementData.y,
					})
					vi.spyOn(frameNode, "getLayer").mockReturnValue(frameLayer)
					nodes.set(elementData.id, frameNode)
					contentLayer.add(frameNode)
				}),
				delete: vi.fn(),
				update,
				getElementInstance: vi.fn(() => undefined),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn((id: string) => nodes.get(id) ?? null),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		const frameId = manager.createFrame(24)

		expect(createdFrameData).toEqual(
			expect.objectContaining({
				id: frameId,
				type: "frame",
				x: 76,
				y: 176,
				width: 278,
				height: 148,
				children: [],
			}),
		)
		expect(nodes.get("first")?.position()).toEqual({ x: 24, y: 24 })
		expect(nodes.get("second")?.position()).toEqual({ x: 174, y: 84 })
		expect(update).toHaveBeenCalledWith(
			frameId,
			expect.objectContaining({
				children: [
					expect.objectContaining({ id: "second", x: 174, y: 84 }),
					expect.objectContaining({ id: "first", x: 24, y: 24 }),
				],
			}),
		)
		expect(emit).toHaveBeenCalledWith({ type: "frame:created", data: { frameId } })
	})
})

describe("FrameManager drag stacking", () => {
	it("temporarily raises a root element above higher-level frames while dragging", () => {
		const element: LayerElement = {
			id: "element",
			type: "rectangle",
			x: 20,
			y: 30,
			width: 100,
			height: 80,
			zIndex: 1,
			activeContentId: "element-content",
			mainContentId: "element-content",
			contents: [{ contentId: "element-content" }],
		}
		const contentLayer = new Konva.Group()
		const elementNode = new Konva.Group({ id: "element", x: 20, y: 30 })
		const frameNode = new Konva.Group({ id: "frame" })
		contentLayer.add(elementNode, frameNode)

		const canvas = {
			contentLayer,
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			transformManager: { rebaseActiveDragNodePositions: vi.fn() },
			permissionManager: { canReparentElement: vi.fn(() => true) },
			elementManager: {
				getElementData: vi.fn(() => element),
				findParentIdForElement: vi.fn(() => undefined),
				isTemporary: vi.fn(() => false),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn(() => elementNode),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		;(
			manager as unknown as { handleFrameDropDragStart: (ids: string[]) => void }
		).handleFrameDropDragStart(["element"])

		expect(contentLayer.getChildren().map((node) => node.id())).toEqual(["frame", "element"])
		expect(elementNode.position()).toEqual({ x: 20, y: 30 })
		expect(manager.getDragTargetParentId("element")).toBeNull()
		expect(manager.getDragTargetParentId("other")).toBeUndefined()
	})

	it("raises multiple same-parent elements while preserving their visual order", () => {
		const elements = new Map<string, LayerElement>([
			[
				"lower",
				{
					id: "lower",
					type: "rectangle",
					x: 20,
					y: 30,
					width: 100,
					height: 80,
					zIndex: 1,
					activeContentId: "lower-content",
					mainContentId: "lower-content",
					contents: [{ contentId: "lower-content" }],
				},
			],
			[
				"upper",
				{
					id: "upper",
					type: "rectangle",
					x: 80,
					y: 90,
					width: 100,
					height: 80,
					zIndex: 2,
					activeContentId: "upper-content",
					mainContentId: "upper-content",
					contents: [{ contentId: "upper-content" }],
				},
			],
		])
		const contentLayer = new Konva.Group()
		const lowerNode = new Konva.Group({ id: "lower", x: 20, y: 30 })
		const frameNode = new Konva.Group({ id: "frame" })
		const upperNode = new Konva.Group({ id: "upper", x: 80, y: 90 })
		contentLayer.add(lowerNode, frameNode, upperNode)
		const nodes = new Map([
			["lower", lowerNode],
			["upper", upperNode],
		])
		const rebaseActiveDragNodePositions = vi.fn()
		const canvas = {
			contentLayer,
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			transformManager: { rebaseActiveDragNodePositions },
			permissionManager: { canReparentElement: vi.fn(() => true) },
			elementManager: {
				getElementData: vi.fn((id: string) => elements.get(id)),
				findParentIdForElement: vi.fn(() => undefined),
				isTemporary: vi.fn(() => false),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn((id: string) => nodes.get(id) ?? null),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		;(
			manager as unknown as { handleFrameDropDragStart: (ids: string[]) => void }
		).handleFrameDropDragStart(["upper", "lower"])

		expect(contentLayer.getChildren().map((node) => node.id())).toEqual([
			"frame",
			"lower",
			"upper",
		])
		expect(rebaseActiveDragNodePositions).toHaveBeenCalledWith(["lower", "upper"])
	})

	it("skips reparenting when a root drag ends without changing its parent", () => {
		const reorderTopLevelElementsPublic = vi.fn()
		const requestLayerDraw = vi.fn()
		const reparentElements = vi.fn()
		const canvas = {
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			runtimeScheduler: { requestLayerDraw },
			elementManager: {
				reorderTopLevelElementsPublic,
				reparentElements,
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })
		const managerWithSession = manager as unknown as {
			dragSession: {
				elementIds: string[]
				sourceParentId: string | null
				targetParentId: string | null
			} | null
			handleFrameDropDragEnd: () => void
		}
		managerWithSession.dragSession = {
			elementIds: ["element"],
			sourceParentId: null,
			targetParentId: null,
		}

		managerWithSession.handleFrameDropDragEnd()

		expect(reorderTopLevelElementsPublic).toHaveBeenCalledOnce()
		expect(requestLayerDraw).toHaveBeenCalledWith("content", {
			source: "FrameManager",
			reason: "restore-top-level-drag-order",
			priority: "input",
		})
		expect(reparentElements).not.toHaveBeenCalled()
		expect(manager.getDragTargetParentId("element")).toBeUndefined()
	})

	it("does not start a reparent session when the selection contains a frame", () => {
		const rectangle: LayerElement = {
			id: "element",
			type: "rectangle",
			x: 20,
			y: 30,
			width: 100,
			height: 80,
			activeContentId: "element-content",
			mainContentId: "element-content",
			contents: [{ contentId: "element-content" }],
		}
		const frame: LayerElement = {
			id: "frame",
			type: "frame",
			x: 200,
			y: 100,
			width: 400,
			height: 300,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [],
		}
		const contentLayer = new Konva.Group()
		const elementNode = new Konva.Group({ id: "element", x: 20, y: 30 })
		const frameNode = new Konva.Group({ id: "frame", x: 200, y: 100 })
		contentLayer.add(elementNode, frameNode)
		const rebaseActiveDragNodePositions = vi.fn()
		const canvas = {
			contentLayer,
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			transformManager: { rebaseActiveDragNodePositions },
			permissionManager: { canReparentElement: vi.fn(() => true) },
			elementManager: {
				getElementData: vi.fn((id: string) => (id === "frame" ? frame : rectangle)),
				findParentIdForElement: vi.fn(() => undefined),
				isTemporary: vi.fn(() => false),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn((id: string) =>
						id === "frame" ? frameNode : elementNode,
					),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		;(
			manager as unknown as { handleFrameDropDragStart: (ids: string[]) => void }
		).handleFrameDropDragStart(["element", "frame"])

		expect(contentLayer.getChildren().map((node) => node.id())).toEqual(["element", "frame"])
		expect(rebaseActiveDragNodePositions).not.toHaveBeenCalled()
	})

	it("keeps mixed-parent selections in their original containers", () => {
		const rootElement: LayerElement = {
			id: "root",
			type: "rectangle",
			x: 20,
			y: 30,
			width: 100,
			height: 80,
			activeContentId: "root-content",
			mainContentId: "root-content",
			contents: [{ contentId: "root-content" }],
		}
		const childElement: LayerElement = {
			id: "child",
			type: "rectangle",
			x: 40,
			y: 50,
			width: 100,
			height: 80,
			activeContentId: "child-content",
			mainContentId: "child-content",
			contents: [{ contentId: "child-content" }],
		}
		const frame: LayerElement = {
			id: "frame",
			type: "frame",
			x: 200,
			y: 100,
			width: 400,
			height: 300,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [childElement],
		}
		const contentLayer = new Konva.Group()
		const rootNode = new Konva.Group({ id: "root", x: 20, y: 30 })
		const frameNode = new Konva.Group({ id: "frame", x: 200, y: 100 })
		const childNode = new Konva.Group({ id: "child", x: 40, y: 50 })
		frameNode.add(childNode)
		contentLayer.add(rootNode, frameNode)
		const elements = new Map([
			["root", rootElement],
			["child", childElement],
			["frame", frame],
		])
		const nodes = new Map([
			["root", rootNode],
			["child", childNode],
			["frame", frameNode],
		])
		const rebaseActiveDragNodePositions = vi.fn()
		const canvas = {
			contentLayer,
			eventEmitter: { on: vi.fn(() => vi.fn()) },
			transformManager: { rebaseActiveDragNodePositions },
			permissionManager: { canReparentElement: vi.fn(() => true) },
			elementManager: {
				getElementData: vi.fn((id: string) => elements.get(id)),
				findParentIdForElement: vi.fn((id: string) =>
					id === "child" ? "frame" : undefined,
				),
				isTemporary: vi.fn(() => false),
				getNodeAdapter: vi.fn(() => ({
					getNodeForParenting: vi.fn((id: string) => nodes.get(id) ?? null),
				})),
			},
		} as unknown as Canvas
		const manager = new FrameManager({ canvas })

		;(
			manager as unknown as { handleFrameDropDragStart: (ids: string[]) => void }
		).handleFrameDropDragStart(["root", "child"])

		expect(rootNode.getParent()).toBe(contentLayer)
		expect(childNode.getParent()).toBe(frameNode)
		expect(rebaseActiveDragNodePositions).not.toHaveBeenCalled()
	})
})
