import { describe, expect, it, vi } from "vitest"
import {
	CanvasRenderVisibilityController,
	type CanvasRenderVisibilityStrategy,
} from "../visibility/CanvasRenderVisibilityController"

interface FakeNode {
	visible: ReturnType<typeof vi.fn>
	listening: ReturnType<typeof vi.fn>
	getParent: ReturnType<typeof vi.fn>
	remove: ReturnType<typeof vi.fn>
	destroy: ReturnType<typeof vi.fn>
	zIndex: ReturnType<typeof vi.fn>
}

function createParentWithNode(node: FakeNode) {
	const parent = {
		children: [node],
		add: vi.fn((child: FakeNode) => {
			if (!parent.children.includes(child)) {
				parent.children.push(child)
			}
			child.getParent.mockReturnValue(parent)
		}),
		getChildren: vi.fn(() => parent.children),
	}
	node.getParent.mockReturnValue(parent)
	node.remove.mockImplementation(() => {
		parent.children = parent.children.filter((child) => child !== node)
		node.getParent.mockReturnValue(null)
	})
	return parent
}

function createFakeNode(options?: { visible?: boolean; listening?: boolean }): FakeNode {
	let visible = options?.visible ?? true
	let listening = options?.listening ?? true
	const node = {
		visible: vi.fn((next?: boolean) => {
			if (typeof next === "boolean") {
				visible = next
				return undefined
			}
			return visible
		}),
		listening: vi.fn((next?: boolean) => {
			if (typeof next === "boolean") {
				listening = next
				return undefined
			}
			return listening
		}),
		getParent: vi.fn(() => null),
		remove: vi.fn(),
		destroy: vi.fn(),
		zIndex: vi.fn(),
	}
	createParentWithNode(node)
	return node
}

function createController(strategy: CanvasRenderVisibilityStrategy = "hidden") {
	const nodes = new Map<string, FakeNode>()
	const renderFns = new Map<string, ReturnType<typeof vi.fn>>()
	const onMountedFns = new Map<string, ReturnType<typeof vi.fn>>()
	const dataById = new Map<string, { id: string; visible?: boolean; children?: unknown[] }>()
	const runtimeScheduler = { requestLayerDraw: vi.fn() }
	const eventEmitter = { emit: vi.fn() }
	const canvas = {
		runtimeScheduler,
		eventEmitter,
		elementManager: {
			getElementInstance: (elementId: string) => {
				const node = nodes.get(elementId)
				const data = dataById.get(elementId) ?? { id: elementId, visible: true }
				if (!node && !renderFns.has(elementId)) return undefined
				return {
					getId: () => elementId,
					getNode: () => nodes.get(elementId) ?? null,
					getData: () => data,
					onMounted: onMountedFns.get(elementId) ?? vi.fn(),
					destroyRenderNodeForVisibilityCull: () => {
						const current = nodes.get(elementId)
						current?.destroy()
						nodes.delete(elementId)
					},
					render: renderFns.get(elementId) ?? (() => null),
				}
			},
		},
	}
	const controller = new CanvasRenderVisibilityController({
		canvas: canvas as ConstructorParameters<
			typeof CanvasRenderVisibilityController
		>[0]["canvas"],
		strategy,
	})
	return {
		controller,
		dataById,
		eventEmitter,
		nodes,
		onMountedFns,
		renderFns,
		runtimeScheduler,
	}
}

describe("CanvasRenderVisibilityController", () => {
	it("hides far nodes only when culling is allowed", () => {
		const { controller, nodes, runtimeScheduler } = createController("hidden")
		const node = createFakeNode()
		nodes.set("far", node)

		controller.sync({
			activeElementIds: [],
			allElementIds: ["far"],
			allowCullFar: false,
		})

		expect(node.visible()).toBe(true)
		expect(node.listening()).toBe(true)
		expect(controller.getCulledCount()).toBe(0)
		expect(runtimeScheduler.requestLayerDraw).not.toHaveBeenCalled()

		controller.sync({
			activeElementIds: [],
			allElementIds: ["far"],
			allowCullFar: true,
		})

		expect(node.visible()).toBe(false)
		expect(node.listening()).toBe(false)
		expect(controller.getCulledCount()).toBe(1)
		expect(runtimeScheduler.requestLayerDraw).toHaveBeenCalledTimes(1)
	})

	it("does not enumerate all roots when far culling is disabled", () => {
		const { controller } = createController("hidden")
		const activeElementIds = new Set(["active-1", "active-2"])
		const allElementIds = new Set(["far-1", "far-2"])
		const activeIteratorSpy = vi.spyOn(activeElementIds, Symbol.iterator)
		const iteratorSpy = vi.spyOn(allElementIds, Symbol.iterator)

		controller.sync({
			activeElementIds,
			allElementIds,
			allowCullFar: false,
		})

		expect(activeIteratorSpy).not.toHaveBeenCalled()
		expect(iteratorSpy).not.toHaveBeenCalled()
	})

	it("restores active hidden nodes to their previous listening state", () => {
		const { controller, nodes } = createController("hidden")
		const node = createFakeNode({ visible: true, listening: true })
		nodes.set("image-1", node)

		controller.sync({
			activeElementIds: [],
			allElementIds: ["image-1"],
			allowCullFar: true,
		})
		controller.sync({
			activeElementIds: ["image-1"],
			allElementIds: ["image-1"],
			allowCullFar: false,
		})

		expect(node.visible()).toBe(true)
		expect(node.listening()).toBe(true)
		expect(controller.getCulledCount()).toBe(0)
	})

	it("diffs the admitted render workset without enumerating all elements during motion", () => {
		const { controller, nodes } = createController("hidden")
		const activeNode = createFakeNode()
		const enteringNode = createFakeNode()
		const farNode = createFakeNode()
		nodes.set("active", activeNode)
		nodes.set("entering", enteringNode)
		nodes.set("far", farNode)
		const allElementIds = new Set(["active", "entering", "far"])
		const allElementIdsIterator = vi.spyOn(allElementIds, Symbol.iterator)

		controller.sync({
			activeElementIds: ["active"],
			allElementIds,
			allowCullFar: true,
			mode: "bootstrap",
			topologyRevision: 1,
		})
		allElementIdsIterator.mockClear()

		controller.sync({
			activeElementIds: ["entering"],
			allElementIds,
			allowCullFar: false,
			mode: "incremental",
			topologyRevision: 1,
		})

		expect(allElementIdsIterator).not.toHaveBeenCalled()
		expect(activeNode.visible()).toBe(true)
		expect(enteringNode.visible()).toBe(true)
		expect(farNode.visible()).toBe(false)

		controller.sync({
			activeElementIds: ["entering"],
			allElementIds,
			allowCullFar: true,
			mode: "incremental",
			topologyRevision: 1,
		})

		expect(activeNode.visible()).toBe(false)
		expect(enteringNode.visible()).toBe(true)
		expect(farNode.visible()).toBe(false)
	})

	it("does not restore unchanged active nodes on an incremental sync", () => {
		const { controller, nodes } = createController("hidden")
		const node = createFakeNode()
		nodes.set("image-1", node)

		controller.sync({
			activeElementIds: ["image-1"],
			allElementIds: ["image-1"],
			allowCullFar: true,
			mode: "bootstrap",
			topologyRevision: 1,
		})
		const visibleCallCount = node.visible.mock.calls.length
		const listeningCallCount = node.listening.mock.calls.length

		controller.sync({
			activeElementIds: ["image-1"],
			allElementIds: [],
			allowCullFar: false,
			mode: "incremental",
			topologyRevision: 1,
		})

		expect(node.visible.mock.calls).toHaveLength(visibleCallCount)
		expect(node.listening.mock.calls).toHaveLength(listeningCallCount)
	})

	it("cleans stale cull state during a topology reconcile", () => {
		const { controller, nodes } = createController("hidden")
		const activeNode = createFakeNode()
		const removedNode = createFakeNode()
		nodes.set("active", activeNode)
		nodes.set("removed", removedNode)

		controller.sync({
			activeElementIds: ["active"],
			allElementIds: ["active", "removed"],
			allowCullFar: true,
			mode: "bootstrap",
			topologyRevision: 1,
		})
		expect(controller.getCulledCount()).toBe(1)

		nodes.delete("removed")
		controller.sync({
			activeElementIds: ["active"],
			allElementIds: ["active"],
			allowCullFar: true,
			mode: "bootstrap",
			topologyRevision: 2,
		})

		expect(controller.getCulledCount()).toBe(0)
	})

	it("detaches and reattaches far nodes when using the detached strategy", () => {
		const { controller, nodes } = createController("detached")
		const node = createFakeNode()
		const parent = node.getParent()
		nodes.set("image-1", node)

		controller.sync({
			activeElementIds: [],
			allElementIds: ["image-1"],
			allowCullFar: true,
		})

		expect(node.remove).toHaveBeenCalledTimes(1)
		expect(node.getParent()).toBeNull()

		controller.sync({
			activeElementIds: ["image-1"],
			allElementIds: ["image-1"],
			allowCullFar: false,
		})

		expect(parent?.add).toHaveBeenCalledWith(node)
		expect(node.getParent()).toBe(parent)
	})

	it("destroys and rerenders leaf nodes when using the destroyed strategy", () => {
		const { controller, eventEmitter, nodes, onMountedFns, renderFns } =
			createController("destroyed")
		const node = createFakeNode()
		const parent = node.getParent()
		const nextNode = createFakeNode()
		nextNode.getParent.mockReturnValue(null)
		nodes.set("image-1", node)
		onMountedFns.set("image-1", vi.fn())
		renderFns.set(
			"image-1",
			vi.fn(() => {
				nodes.set("image-1", nextNode)
				return nextNode
			}),
		)

		controller.sync({
			activeElementIds: [],
			allElementIds: ["image-1"],
			allowCullFar: true,
		})

		expect(node.destroy).toHaveBeenCalledTimes(1)
		expect(nodes.has("image-1")).toBe(false)

		controller.sync({
			activeElementIds: ["image-1"],
			allElementIds: ["image-1"],
			allowCullFar: false,
		})

		expect(parent?.add).toHaveBeenCalledWith(nextNode)
		expect(onMountedFns.get("image-1")).toHaveBeenCalledTimes(1)
		expect(eventEmitter.emit).toHaveBeenCalledWith({
			type: "element:rerendered",
			data: { elementId: "image-1", data: { id: "image-1", visible: true } },
		})
	})

	it("falls back to detach for container nodes under the destroyed strategy", () => {
		const { controller, dataById, nodes } = createController("destroyed")
		const node = createFakeNode()
		nodes.set("frame-1", node)
		dataById.set("frame-1", {
			id: "frame-1",
			visible: true,
			children: [{ id: "child-1" }],
		})

		controller.sync({
			activeElementIds: [],
			allElementIds: ["frame-1"],
			allowCullFar: true,
		})

		expect(node.destroy).not.toHaveBeenCalled()
		expect(node.remove).toHaveBeenCalledTimes(1)
	})
})
