import { describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import { AlignmentManager } from "../AlignmentManager"

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	},
}))

function ordinary(id: string, x: number, y: number, overrides: Partial<LayerElement> = {}) {
	return {
		id,
		type: ElementTypeEnum.Image,
		x,
		y,
		width: 40,
		height: 20,
		visible: true,
		zIndex: 0,
		...overrides,
	} as LayerElement
}

function createHarness(
	elements: LayerElement[],
	selectedIds: string[],
	parentIds = new Map<string, string | null>(),
	connections: Array<{ sourceElementId: string; targetElementId: string }> = [],
) {
	const byId = new Map(elements.map((element) => [element.id, element]))
	const batchUpdate = vi.fn((updates: Array<{ id: string; data: Partial<LayerElement> }>) => {
		for (const update of updates) {
			const current = byId.get(update.id)
			if (current) byId.set(update.id, { ...current, ...update.data } as LayerElement)
		}
	})
	const runTransaction = vi.fn((callback: () => void) => callback())
	const refreshSelectionPosition = vi.fn()
	const updateTransformer = vi.fn()
	const updateHighlights = vi.fn()
	const refreshHighlights = vi.fn()
	const clearAllHighlights = vi.fn()
	const refreshLabelLayouts = vi.fn()
	const canvas = {
		selectionManager: { getSelectedIds: () => selectedIds, refreshSelectionPosition },
		elementManager: {
			getElementData: (id: string) => byId.get(id),
			getAllElements: () => elements,
			findParentIdForElement: (id: string) => parentIds.get(id) ?? null,
			batchUpdate,
		},
		connectionManager: { getConnections: () => connections },
		permissionManager: { can: () => true },
		transformManager: { updateTransformer },
		selectionHighlightManager: { updateHighlights, refreshHighlights, clearAllHighlights },
		nameLabelManager: { refreshLabelLayouts },
		sizeLabelManager: { refreshLabelLayouts },
		historyManager: { runTransaction },
		t: (_key: string, fallback: string) => fallback,
	}
	return {
		canvas,
		byId,
		batchUpdate,
		runTransaction,
		refreshSelectionPosition,
		updateTransformer,
		updateHighlights,
		refreshHighlights,
		clearAllHighlights,
		refreshLabelLayouts,
	}
}

describe("AlignmentManager", () => {
	it("reports when an arrangement is already satisfied", () => {
		const childA = ordinary("a", 98, 90)
		const childB = ordinary("b", 162, 90)
		const frame = {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			children: [childA, childB],
		} as LayerElement
		const harness = createHarness([frame, childA, childB], [frame.id])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })
		vi.mocked(toast.info).mockClear()

		const result = manager.arrange("horizontal-row")

		expect(result?.changed).toBe(false)
		expect(harness.batchUpdate).not.toHaveBeenCalled()
		expect(toast.info).toHaveBeenCalledWith("选中节点已是整齐排列，无需调整")
	})

	it("arranges a same-parent selection and resizes its Frame in one batch", () => {
		const childA = ordinary("a", 120, 80)
		const childB = ordinary("b", 20, 10)
		const locked = ordinary("locked", 300, 200, { locked: true })
		const frame = {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 500,
			y: 600,
			width: 600,
			height: 500,
			children: [childA, childB, locked],
		} as LayerElement
		const parentIds = new Map([
			["a", "frame"],
			["b", "frame"],
			["locked", "frame"],
		])
		const harness = createHarness([frame, childA, childB, locked], ["a", "b"], parentIds)
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		manager.arrange("horizontal-row")

		expect(harness.batchUpdate).toHaveBeenCalledTimes(1)
		const updateIds = harness.batchUpdate.mock.calls[0][0].map((update) => update.id)
		expect(updateIds).toEqual(expect.arrayContaining(["a", "b", "frame"]))
		expect(harness.byId.get("locked")?.x).toBe(300)
		expect(harness.byId.get("frame")?.x).toBe(500)
		expect(harness.byId.get("frame")?.y).toBe(600)
		expect(harness.byId.get("frame")?.width).toBe(600)
		expect(harness.byId.get("frame")?.height).toBe(500)
		expect(harness.byId.get("a")?.x).toBe(248)
		expect(harness.byId.get("b")?.x).toBe(312)
		expect(harness.byId.get("a")?.y).toBe(240)
		expect(harness.byId.get("b")?.y).toBe(240)
		const frameUpdate = harness.batchUpdate.mock.calls[0][0].find(
			(update) => update.id === "frame",
		)
		expect(
			(frameUpdate?.data as { children?: LayerElement[] }).children?.find(
				(child) => child.id === "a",
			)?.x,
		).toBe(harness.byId.get("a")?.x)
		expect(harness.runTransaction).toHaveBeenCalledTimes(1)
		expect(harness.refreshSelectionPosition).toHaveBeenCalledOnce()
		expect(harness.updateTransformer).toHaveBeenCalledWith(["a", "b"])
		expect(harness.refreshHighlights).toHaveBeenCalledWith(["a", "b"])
		expect(harness.updateHighlights).toHaveBeenCalledWith(["a", "b"])
		expect(harness.refreshLabelLayouts).toHaveBeenCalledWith(["a", "b", "frame"])
	})

	it("resizes a container even when the requested layout keeps child positions", () => {
		const childA = ordinary("a", 8, 8)
		const childB = ordinary("b", 72, 8)
		const frame = {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 10,
			y: 20,
			width: 900,
			height: 700,
			children: [childA, childB],
		} as LayerElement
		const harness = createHarness([frame, childA, childB], ["frame"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		const result = manager.arrange("horizontal-row")

		expect(result?.changed).toBe(true)
		expect(harness.batchUpdate).toHaveBeenCalledTimes(1)
		expect(harness.byId.get("frame")?.width).toBe(900)
		expect(harness.byId.get("frame")?.height).toBe(700)
		expect(harness.byId.get("frame")?.x).toBe(10)
		expect(harness.byId.get("frame")?.y).toBe(20)
	})

	it("expands only when a centered row cannot fit the container width", () => {
		const childA = ordinary("a", 0, 0, { width: 80 })
		const childB = ordinary("b", 0, 0, { width: 80 })
		const frame = {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 10,
			y: 20,
			width: 100,
			height: 300,
			children: [childA, childB],
		} as LayerElement
		const parentIds = new Map([
			[childA.id, frame.id],
			[childB.id, frame.id],
		])
		const harness = createHarness([frame, childA, childB], [frame.id], parentIds)
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		manager.arrange("horizontal-row")

		expect(harness.byId.get("frame")?.width).toBeGreaterThan(100)
		expect(harness.byId.get("frame")?.height).toBe(300)
	})

	it("uses child bounds when a Group has no persisted size", () => {
		const childA = ordinary("a", 20, 10)
		const childB = ordinary("b", 120, 40)
		const group = {
			id: "group",
			type: ElementTypeEnum.Group,
			x: 10,
			y: 20,
			width: 0,
			height: 0,
			children: [childA, childB],
		} as LayerElement
		const harness = createHarness([group, childA, childB], ["group"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		const result = manager.distribute("horizontal-spacing")

		const childUpdates = harness.batchUpdate.mock.calls[0]?.[0] ?? []
		const aUpdate = childUpdates.find((update) => update.id === "a")
		const bUpdate = childUpdates.find((update) => update.id === "b")
		expect(aUpdate?.data.x).toBeGreaterThanOrEqual(0)
		expect(bUpdate?.data.x).toBeGreaterThan(aUpdate?.data.x ?? 0)
		expect(harness.byId.get("group")?.width).toBeGreaterThan(0)
		expect(result?.arrangedNodeCount).toBe(2)
		expect(result?.positions).toBeInstanceOf(Map)
	})

	it("rejects a cross-parent selection without touching the document", () => {
		const a = ordinary("a", 0, 0)
		const b = ordinary("b", 100, 0)
		const harness = createHarness(
			[a, b],
			["a", "b"],
			new Map([
				["a", "frame-a"],
				["b", "frame-b"],
			]),
		)
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		expect(manager.arrange("smart")).toBeNull()
		expect(harness.batchUpdate).not.toHaveBeenCalled()
	})

	it("supports a single Group scope and updates its bounds", () => {
		const locked = ordinary("locked", 40, 40, { locked: true })
		const child = ordinary("child", 100, 100)
		const childTwo = ordinary("child-two", 10, 10)
		const group = {
			id: "group",
			type: ElementTypeEnum.Group,
			x: 10,
			y: 20,
			width: 300,
			height: 300,
			children: [locked, child, childTwo],
		} as LayerElement
		const harness = createHarness([group, locked, child, childTwo], ["group"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		expect(manager.arrange("compact-grid")).not.toBeNull()
		expect(harness.batchUpdate).toHaveBeenCalledTimes(1)
		expect(harness.byId.get("locked")?.x).toBe(40)
		expect(harness.byId.get("group")?.x).toBe(10)
		expect(harness.byId.get("group")?.y).toBe(20)
	})

	it("resizes a Frame after alignment and legacy spacing in one transaction", () => {
		const childA = ordinary("a", 10, 10)
		const childB = ordinary("b", 180, 100)
		const frame = {
			id: "frame",
			type: ElementTypeEnum.Frame,
			x: 40,
			y: 50,
			width: 800,
			height: 700,
			children: [childA, childB],
		} as LayerElement
		const harness = createHarness([frame, childA, childB], ["frame"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		manager.align("left")
		manager.distribute("horizontal-spacing")

		expect(harness.batchUpdate).toHaveBeenCalledTimes(2)
		expect(harness.runTransaction).toHaveBeenCalledTimes(2)
		expect(harness.byId.get("frame")?.x).toBe(40)
		expect(harness.byId.get("frame")?.y).toBe(50)
		expect(harness.byId.get("frame")?.width).toBeGreaterThan(0)
		expect(harness.byId.get("frame")?.height).toBeGreaterThan(0)
	})

	it("leaves a one-movable scope unchanged, including container size", () => {
		const locked = ordinary("locked", 40, 40, { locked: true })
		const child = ordinary("child", 100, 100)
		const group = {
			id: "group",
			type: ElementTypeEnum.Group,
			x: 10,
			y: 20,
			width: 300,
			height: 300,
			children: [locked, child],
		} as LayerElement
		const harness = createHarness([group, locked, child], ["group"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		expect(manager.arrange("compact-grid")).toBeNull()
		expect(harness.batchUpdate).not.toHaveBeenCalled()
	})

	it("uses only connections internal to the selected scope", () => {
		const a = ordinary("a", 100, 0)
		const b = ordinary("b", 0, 0)
		const external = ordinary("external", -500, 0)
		const harness = createHarness(
			[a, b, external],
			["a", "b"],
			new Map([
				["a", null],
				["b", null],
				["external", null],
			]),
			[{ sourceElementId: "a", targetElementId: "external" }],
		)
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		const result = manager.arrange("smart")

		expect(result?.layerCount).toBe(0)
		expect(harness.byId.get("external")?.x).toBe(-500)
	})

	it("keeps the legacy three-node minimum for root spacing", () => {
		const a = ordinary("a", 0, 0)
		const b = ordinary("b", 100, 0)
		const harness = createHarness([a, b], ["a", "b"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		expect(manager.canExecuteSpacing()).toBe(false)
		manager.distribute("horizontal-spacing")
		expect(harness.batchUpdate).not.toHaveBeenCalled()
	})

	it("keeps document order when the root selection is reversed", () => {
		const first = ordinary("first", 300, 0)
		const second = ordinary("second", 0, 0)
		const harness = createHarness([first, second], ["second", "first"])
		const manager = new AlignmentManager({ canvas: harness.canvas as never })

		manager.arrange("horizontal-row")

		expect(harness.byId.get("first")?.x).toBeLessThan(harness.byId.get("second")?.x ?? 0)
	})
})
