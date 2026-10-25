import Konva from "konva"
import { describe, expect, it, vi } from "vitest"
import { ElementManager } from "../ElementManager"
import type {
	ElementType,
	ElementUpdatePatch,
	ImageElement,
	LayerElement,
} from "../../../document/types"
import { CanvasDocumentIndex } from "../CanvasDocumentIndex"
import { GenerationStatus, type UploadFileResponse } from "../../../../public/magic-types"

interface DragManagerHarness {
	canvas: {
		permissionManager: {
			canTransform: ReturnType<typeof vi.fn>
		}
		selectionManager: {
			getSelectionCount: () => number
			isSelected: (elementId: string) => boolean
		}
		isKeepRatioModifierPressed: () => boolean
	}
	elements?: Map<
		string,
		{
			getData: () => LayerElement
			getNode?: () => Konva.Node
			setDraggable: ReturnType<typeof vi.fn>
			setListening: ReturnType<typeof vi.fn>
		}
	>
	canDragElement: (element: LayerElement) => boolean
	canListenElement: () => boolean
	disableElementDragging: () => void
	disableElementDraggingOnly: () => void
	enableElementDragging: () => void
	setViewportGestureDraggingDisabled: (disabled: boolean) => void
}

function createManager(options: { selectedIds?: string[]; canTransform?: boolean } = {}) {
	const selectedIds = new Set(options.selectedIds ?? [])
	const manager = Object.create(ElementManager.prototype) as DragManagerHarness
	manager.canvas = {
		permissionManager: {
			canTransform: vi.fn(() => options.canTransform ?? true),
		},
		selectionManager: {
			getSelectionCount: () => selectedIds.size,
			isSelected: (elementId: string) => selectedIds.has(elementId),
		},
		isKeepRatioModifierPressed: () => false,
	}
	return manager
}

function createElement(id: string): LayerElement {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	}
}

function createVisibilityManager(elements: LayerElement[]) {
	const manager = Object.create(ElementManager.prototype) as unknown as {
		elements: Map<string, { getData: () => LayerElement }>
		documentIndex: CanvasDocumentIndex
		dataTreeVisibilityCache: Map<string, boolean>
		findParentIdForElement: (elementId: string) => string | undefined
		isElementVisibleInDataTree: (elementId: string) => boolean
		updateDataOnly: (
			element: {
				getData: () => LayerElement
				getId: () => string
				update: (data: LayerElement) => boolean
			},
			updates: ElementUpdatePatch,
			options: { silent?: boolean },
		) => void
		invalidateGeometryForElement: (elementId: string) => void
		scheduleContentLayerDraw: () => void
		emitElementChange: () => void
	}
	manager.elements = new Map(elements.map((element) => [element.id, { getData: () => element }]))
	manager.documentIndex = new CanvasDocumentIndex()
	manager.dataTreeVisibilityCache = new Map()
	return manager
}

describe("ElementManager element creation names", () => {
	it("assigns the next unique name through the public create entry", () => {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, { getData: () => LayerElement }>
			doCreate: ReturnType<typeof vi.fn>
			getElementsDict: ElementManager["getElementsDict"]
			create: ElementManager["create"]
		}
		const existing = { ...createElement("existing"), name: "视频合并" }
		manager.elements = new Map([[existing.id, { getData: () => existing }]])
		manager.doCreate = vi.fn((element: LayerElement) => {
			manager.elements.set(element.id, { getData: () => element })
		})
		manager.getElementsDict = () => ({ [existing.id]: existing })

		manager.create({ ...createElement("new"), name: "视频合并" })

		expect(manager.doCreate).toHaveBeenCalledWith(
			expect.objectContaining({ name: "视频合并(1)" }),
			{},
		)
	})

	it("normalizes Frame dimensions at the public create boundary", () => {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, { getData: () => LayerElement }>
			doCreate: ReturnType<typeof vi.fn>
			getElementsDict: ElementManager["getElementsDict"]
			create: ElementManager["create"]
		}
		const frame: LayerElement = {
			id: "frame",
			type: "frame",
			x: 10,
			y: 20,
			width: 101.2,
			height: 99.4,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
		}
		manager.elements = new Map()
		manager.doCreate = vi.fn((element: LayerElement) => {
			manager.elements.set(element.id, { getData: () => element })
		})
		manager.getElementsDict = () => ({})

		manager.create(frame)

		expect(manager.doCreate).toHaveBeenCalledWith(
			expect.objectContaining({ width: 102, height: 100 }),
			{},
		)
	})
})

describe("ElementManager nested geometry invalidation", () => {
	it("invalidates descendants and ancestors when a container changes", () => {
		const image = createElement("image")
		const group = {
			...createElement("group"),
			type: "group" as const,
			children: [image],
		}
		const frame = {
			...createElement("frame"),
			type: "frame" as const,
			children: [group],
		}
		const outerGroup = {
			...createElement("outer-group"),
			type: "group" as const,
			children: [frame],
		}
		const dataById = new Map<string, LayerElement>([
			[image.id, image],
			[group.id, group],
			[frame.id, frame],
			[outerGroup.id, outerGroup],
		])
		const parentById = new Map([
			[image.id, group.id],
			[group.id, frame.id],
			[frame.id, outerGroup.id],
		])
		const invalidateElements = vi.fn()
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, { getData: () => LayerElement }>
			canvas: {
				geometryCacheManager: { invalidateElements: typeof invalidateElements }
			}
			findParentElement: (elementId: string) => { getData: () => LayerElement } | undefined
			invalidateGeometryForElement: (elementId: string) => void
		}
		manager.elements = new Map(
			Array.from(dataById, ([elementId, data]) => [elementId, { getData: () => data }]),
		)
		manager.canvas = { geometryCacheManager: { invalidateElements } }
		manager.findParentElement = (elementId) => {
			const parentId = parentById.get(elementId)
			return parentId ? manager.elements.get(parentId) : undefined
		}

		manager.invalidateGeometryForElement(frame.id)

		expect(invalidateElements).toHaveBeenCalledOnce()
		expect(invalidateElements).toHaveBeenCalledWith(
			new Set([frame.id, group.id, image.id, outerGroup.id]),
		)
	})
})

describe("ElementManager data-tree visibility", () => {
	it("reuses cached visibility for descendants of nested Frame and Group elements", () => {
		const image = createElement("image")
		const sibling = createElement("sibling")
		const group = {
			...createElement("group"),
			type: "group" as const,
			children: [image, sibling],
		}
		const innerFrame = {
			...createElement("inner-frame"),
			type: "frame" as const,
			children: [group],
		}
		const outerFrame = {
			...createElement("outer-frame"),
			type: "frame" as const,
			children: [innerFrame],
		}
		const manager = createVisibilityManager([outerFrame, innerFrame, group, image, sibling])
		const findParentId = vi.spyOn(manager, "findParentIdForElement")

		expect(manager.isElementVisibleInDataTree(image.id)).toBe(true)
		expect(manager.isElementVisibleInDataTree(sibling.id)).toBe(true)

		// The second branch only resolves the sibling itself; the shared Group and Frame chain is cached.
		expect(findParentId).toHaveBeenCalledTimes(5)
		expect(manager.dataTreeVisibilityCache).toEqual(
			new Map([
				[image.id, true],
				[group.id, true],
				[innerFrame.id, true],
				[outerFrame.id, true],
				[sibling.id, true],
			]),
		)
	})

	it("invalidates cached visibility when a hidden nested ancestor becomes visible", () => {
		const image = createElement("image")
		let groupData = {
			...createElement("group"),
			type: "group" as const,
			visible: false,
			children: [image],
		}
		const frame = {
			...createElement("frame"),
			type: "frame" as const,
			children: [groupData],
		}
		const groupElement = {
			getData: () => groupData as LayerElement,
			getId: () => groupData.id,
			update: vi.fn((nextData: LayerElement) => {
				groupData = nextData as typeof groupData
				return false
			}),
			getNode: () => null,
		}
		const manager = createVisibilityManager([frame, groupData, image])
		manager.elements.set(groupData.id, groupElement)
		manager.invalidateGeometryForElement = vi.fn()
		manager.scheduleContentLayerDraw = vi.fn()
		manager.emitElementChange = vi.fn()

		expect(manager.isElementVisibleInDataTree(image.id)).toBe(false)

		manager.updateDataOnly(groupElement, { visible: true }, { silent: true })

		expect(manager.isElementVisibleInDataTree(image.id)).toBe(true)
		expect(manager.dataTreeVisibilityCache.get(groupData.id)).toBe(true)
	})
})

describe("ElementManager document loading", () => {
	it("preserves persisted Frame dimensions during document loading", () => {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			batchMode: boolean
			elements: Map<string, unknown>
			pendingEvents: unknown[]
			clear: ReturnType<typeof vi.fn>
			doCreate: ReturnType<typeof vi.fn>
			flush: ReturnType<typeof vi.fn>
			reorderTopLevelElements: ReturnType<typeof vi.fn>
			canvas: { geometryCacheManager: { invalidateAll: ReturnType<typeof vi.fn> } }
			replaceAll: ElementManager["replaceAll"]
		}
		const frame: LayerElement = {
			id: "persisted-frame",
			type: "frame",
			x: 10,
			y: 20,
			width: 101.2,
			height: 99.4,
			activeContentId: "persisted-frame-content",
			mainContentId: "persisted-frame-content",
			contents: [{ contentId: "persisted-frame-content" }],
		}
		manager.batchMode = false
		manager.elements = new Map()
		manager.pendingEvents = []
		manager.clear = vi.fn()
		manager.doCreate = vi.fn()
		manager.flush = vi.fn()
		manager.reorderTopLevelElements = vi.fn()
		manager.canvas = { geometryCacheManager: { invalidateAll: vi.fn() } }

		manager.replaceAll([frame])

		expect(manager.doCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				id: frame.id,
				width: frame.width,
				height: frame.height,
			}),
			{ batch: true },
		)
		expect(manager.canvas.geometryCacheManager.invalidateAll).toHaveBeenCalledOnce()
	})

	it("continues loading after one element fails and records the issue", () => {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			batchMode: boolean
			elements: Map<string, unknown>
			pendingEvents: unknown[]
			clear: ReturnType<typeof vi.fn>
			doCreate: ReturnType<typeof vi.fn>
			flush: ReturnType<typeof vi.fn>
			reorderTopLevelElements: ReturnType<typeof vi.fn>
			canvas: { geometryCacheManager: { invalidateAll: ReturnType<typeof vi.fn> } }
			replaceAll: ElementManager["replaceAll"]
			getLastLoadIssues: ElementManager["getLastLoadIssues"]
		}
		manager.batchMode = false
		manager.elements = new Map()
		manager.pendingEvents = []
		manager.clear = vi.fn()
		manager.doCreate = vi.fn((element: LayerElement) => {
			if (element.id === "broken") throw new Error("invalid video size")
		})
		manager.flush = vi.fn()
		manager.reorderTopLevelElements = vi.fn()
		manager.canvas = { geometryCacheManager: { invalidateAll: vi.fn() } }

		manager.replaceAll([createElement("first"), createElement("broken"), createElement("last")])

		expect(manager.doCreate).toHaveBeenCalledTimes(3)
		expect(manager.getLastLoadIssues()).toEqual([
			{
				elementId: "broken",
				elementType: "rectangle",
				message: "invalid video size",
			},
		])
		expect(manager.flush).toHaveBeenCalledOnce()
		expect(manager.reorderTopLevelElements).toHaveBeenCalledOnce()
	})
})

describe("ElementManager drag eligibility", () => {
	it("keeps the selected element draggable in single selection", () => {
		const manager = createManager({ selectedIds: ["element-1"] })

		expect(manager.canDragElement(createElement("element-1"))).toBe(true)
	})

	it("disables native dragging for selected nodes in multi-selection", () => {
		const manager = createManager({ selectedIds: ["element-1", "element-2"] })

		expect(manager.canDragElement(createElement("element-1"))).toBe(false)
		expect(manager.canDragElement(createElement("element-2"))).toBe(false)
	})

	it("does not disable native dragging for elements outside the multi-selection", () => {
		const manager = createManager({ selectedIds: ["element-1", "element-2"] })

		expect(manager.canDragElement(createElement("element-3"))).toBe(true)
	})

	it("keeps rerendered nodes non-interactive while element dragging is disabled", () => {
		const manager = createManager()
		const elementData = createElement("element-1")
		const element = {
			getData: () => elementData,
			setDraggable: vi.fn(),
			setListening: vi.fn(),
		}
		manager.elements = new Map([["element-1", element]])

		manager.disableElementDragging()

		expect(manager.canDragElement(elementData)).toBe(false)
		expect(manager.canListenElement()).toBe(false)
		expect(element.setDraggable).toHaveBeenLastCalledWith(false)
		expect(element.setListening).toHaveBeenLastCalledWith(false)

		manager.enableElementDragging()

		expect(manager.canDragElement(elementData)).toBe(true)
		expect(manager.canListenElement()).toBe(true)
		expect(element.setDraggable).toHaveBeenLastCalledWith(true)
		expect(element.setListening).toHaveBeenLastCalledWith(true)
	})

	it("keeps listening enabled when only element dragging is disabled", () => {
		const manager = createManager()
		const elementData = createElement("element-1")
		const element = {
			getData: () => elementData,
			setDraggable: vi.fn(),
			setListening: vi.fn(),
		}
		manager.elements = new Map([["element-1", element]])

		manager.disableElementDraggingOnly()

		expect(manager.canDragElement(elementData)).toBe(false)
		expect(manager.canListenElement()).toBe(true)
		expect(element.setDraggable).toHaveBeenLastCalledWith(false)
		expect(element.setListening).not.toHaveBeenCalled()
	})

	it("stops active element drags and disables draggable during viewport gesture", () => {
		const manager = createManager()
		const elementOneData = createElement("element-1")
		const elementTwoData = createElement("element-2")
		const nodeOne = new Konva.Group()
		const nodeTwo = new Konva.Group()
		vi.spyOn(nodeOne, "isDragging").mockReturnValue(true)
		vi.spyOn(nodeTwo, "isDragging").mockReturnValue(true)
		const stopDragOne = vi.spyOn(nodeOne, "stopDrag").mockImplementation(() => undefined)
		const stopDragTwo = vi.spyOn(nodeTwo, "stopDrag").mockImplementation(() => undefined)
		const elementOne = {
			getData: () => elementOneData,
			getNode: () => nodeOne,
			setDraggable: vi.fn(),
			setListening: vi.fn(),
		}
		const elementTwo = {
			getData: () => elementTwoData,
			getNode: () => nodeTwo,
			setDraggable: vi.fn(),
			setListening: vi.fn(),
		}
		manager.elements = new Map([
			["element-1", elementOne],
			["element-2", elementTwo],
		])

		manager.setViewportGestureDraggingDisabled(true)

		expect(stopDragOne).toHaveBeenCalledTimes(1)
		expect(stopDragTwo).toHaveBeenCalledTimes(1)
		expect(manager.canDragElement(elementOneData)).toBe(false)
		expect(manager.canDragElement(elementTwoData)).toBe(false)
		expect(elementOne.setDraggable).toHaveBeenLastCalledWith(false)
		expect(elementTwo.setDraggable).toHaveBeenLastCalledWith(false)

		manager.setViewportGestureDraggingDisabled(false)

		expect(manager.canDragElement(elementOneData)).toBe(true)
		expect(manager.canDragElement(elementTwoData)).toBe(true)
		expect(elementOne.setDraggable).toHaveBeenLastCalledWith(true)
		expect(elementTwo.setDraggable).toHaveBeenLastCalledWith(true)
	})

	it("unsubscribes viewport gesture listener on destroy", () => {
		const manager = Object.create(ElementManager.prototype) as ElementManager
		const unsubscribe = vi.fn()
		Object.assign(
			manager as unknown as {
				clear: ReturnType<typeof vi.fn>
				elements: Map<string, never>
				viewportGestureUnsubscribe?: () => void
			},
			{
				clear: vi.fn(),
				elements: new Map(),
				viewportGestureUnsubscribe: unsubscribe,
			},
		)

		manager.destroy()

		expect(unsubscribe).toHaveBeenCalledTimes(1)
		expect(
			(manager as unknown as { viewportGestureUnsubscribe?: () => void })
				.viewportGestureUnsubscribe,
		).toBeUndefined()
	})
})

describe("ElementManager node-only resize sync", () => {
	it("syncs internal transform layout when node-only updates group size", () => {
		const node = new Konva.Group({ width: 100, height: 80 })
		const onTransformResize = vi.fn()
		const elementData = createElement("element-1")
		const manager = Object.create(ElementManager.prototype) as {
			elements: Map<
				string,
				{
					getData: () => LayerElement
					getId: () => string
					getNode: () => Konva.Node
					onTransformResize?: (width: number, height: number) => void
				}
			>
			update: ElementManager["update"]
		}
		manager.elements = new Map([
			[
				"element-1",
				{
					getData: () => elementData,
					getId: () => "element-1",
					getNode: () => node,
					onTransformResize,
				},
			],
		])

		manager.update(
			"element-1",
			{ width: 160, height: 120 },
			{ mode: "node-only", skipGeometryInvalidate: true },
		)

		expect(node.width()).toBe(160)
		expect(node.height()).toBe(120)
		expect(onTransformResize).toHaveBeenCalledWith(160, 120)
	})
})

describe("ElementManager image crop resize sync", () => {
	it("preserves an explicit nested crop clear during a resize update", () => {
		const currentData = {
			id: "image-1",
			type: "image",
			width: 100,
			height: 80,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [
				{
					contentId: "content-1",
					src: "./image.png",
					crop: { x: 10, y: 12, width: 40, height: 30 },
				},
			],
		} as ImageElement
		const element = {
			getData: () => currentData,
		}
		const manager = Object.create(ElementManager.prototype) as {
			normalizeUpdates: (element: unknown, updates: ElementUpdatePatch) => ElementUpdatePatch
		}

		const normalized = manager.normalizeUpdates(element, {
			width: 200,
			height: 160,
			contents: [
				{
					...currentData.contents[0],
					crop: undefined,
				},
			],
		})

		expect(normalized.contents?.[0]?.crop).toBeUndefined()
	})
})

describe("ElementManager transform-safe full updates", () => {
	it("preserves the live node position and defers structural rerender for resource updates", () => {
		const node = new Konva.Group({ x: 140, y: 180 })
		let elementData = {
			id: "pasted-image",
			type: "image",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			contents: [
				{
					contentId: "content-1",
					status: GenerationStatus.Processing,
				},
			],
			activeContentId: "content-1",
			mainContentId: "content-1",
		} as LayerElement
		const updateElement = vi.fn((nextData: LayerElement) => {
			elementData = nextData
			return true
		})
		const rerenderWhenTransformIdle = vi.fn()
		const element = {
			getData: () => elementData,
			getNode: () => node,
			update: updateElement,
			rerenderWhenTransformIdle,
		}
		const manager = Object.create(ElementManager.prototype) as {
			elements: Map<string, typeof element>
			invalidateGeometryForElement: ReturnType<typeof vi.fn>
			scheduleContentLayerDraw: ReturnType<typeof vi.fn>
			update: ElementManager["update"]
		}
		manager.elements = new Map([["pasted-image", element]])
		manager.invalidateGeometryForElement = vi.fn()
		manager.scheduleContentLayerDraw = vi.fn()

		manager.update(
			"pasted-image",
			{
				src: "target/image.png",
				status: GenerationStatus.Completed,
			},
			{ silent: true },
		)

		expect(updateElement).toHaveBeenCalledWith(
			expect.objectContaining({
				x: 140,
				y: 180,
				contents: [
					expect.objectContaining({
						contentId: "content-1",
						src: "target/image.png",
						status: GenerationStatus.Completed,
					}),
				],
			}),
		)
		expect(rerenderWhenTransformIdle).toHaveBeenCalledTimes(1)
	})
})

describe("ElementManager container child lifecycle", () => {
	it("mounts newly rendered child elements inside containers", () => {
		const childNode = new Konva.Group()
		const childElement = {
			render: vi.fn(() => childNode),
			onMounted: vi.fn(),
		}
		const manager = Object.create(ElementManager.prototype) as {
			elements: Map<string, typeof childElement>
			dataTreeVisibilityCache: Map<string, boolean>
			canvas: {
				eventEmitter: {
					emit: ReturnType<typeof vi.fn>
				}
			}
			createElementInstance: ReturnType<typeof vi.fn>
			markDocumentIndexDirty: ReturnType<typeof vi.fn>
			invalidateGeometryForElement: ReturnType<typeof vi.fn>
			renderChildren: (
				parentNode: Konva.Node,
				parentElementData: LayerElement,
				parentElement: unknown,
			) => void
		}
		manager.elements = new Map()
		manager.dataTreeVisibilityCache = new Map()
		manager.canvas = {
			eventEmitter: {
				emit: vi.fn(),
			},
		}
		manager.createElementInstance = vi.fn(() => childElement)
		manager.markDocumentIndexDirty = vi.fn()
		manager.invalidateGeometryForElement = vi.fn()

		const parentNode = new Konva.Group()
		const child = {
			id: "child-image",
			type: "image",
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			activeContentId: "child-content",
			mainContentId: "child-content",
			contents: [{ contentId: "child-content", src: "./images/child.png" }],
		} as LayerElement
		const frame = {
			id: "frame-1",
			type: "frame",
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [child],
		} as LayerElement

		manager.renderChildren(parentNode, frame, {} as never)

		expect(childElement.render).toHaveBeenCalled()
		expect(childElement.onMounted).toHaveBeenCalledOnce()
		expect(manager.elements.get("child-image")).toBe(childElement)
		expect(childNode.getParent()).toBe(parentNode)
	})
})

describe("ElementManager document patch export", () => {
	function createPatchManager(
		elements: LayerElement[],
		temporaryElements: Array<{ id: string; kind?: "upload" | "generation-result" }> = [],
	) {
		const manager = Object.create(ElementManager.prototype) as {
			elements: Map<string, { getData: () => LayerElement }>
			temporaryElements: Map<
				string,
				{
					kind: "upload" | "generation-result"
					historyPolicy: "include" | "exclude"
					clipboardPolicy: "include" | "exclude"
				}
			>
			documentIndex: CanvasDocumentIndex
			exportDocumentPatch: ElementManager["exportDocumentPatch"]
			exportDocument: ElementManager["exportDocument"]
			filterElementsForClipboard: ElementManager["filterElementsForClipboard"]
		}
		manager.elements = new Map(
			elements.map((element) => [element.id, { getData: () => element }]),
		)
		manager.temporaryElements = new Map(
			temporaryElements.map(({ id, kind = "generation-result" }) => [
				id,
				kind === "upload"
					? {
							kind,
							historyPolicy: "include" as const,
							clipboardPolicy: "include" as const,
						}
					: {
							kind,
							historyPolicy: "exclude" as const,
							clipboardPolicy: "exclude" as const,
						},
			]),
		)
		manager.documentIndex = new CanvasDocumentIndex()
		return manager
	}

	it("exports sanitized upserts with parent ids", () => {
		const child = {
			id: "child-1",
			type: "image",
			x: 12,
			y: 24,
			width: 80,
			height: 60,
			activeContentId: "child-content",
			mainContentId: "child-content",
			contents: [{ contentId: "child-content", src: "./images/a.png" }],
			runtimeOnly: true,
		} as LayerElement
		const frame = {
			id: "frame-1",
			type: "frame",
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [child],
		} as LayerElement
		const manager = createPatchManager([frame, child])

		const patch = manager.exportDocumentPatch({
			changedElementIds: ["child-1"],
		})

		expect(patch).toEqual({
			upserts: [
				{
					parentId: "frame-1",
					element: expect.objectContaining({
						id: "child-1",
						type: "image",
						contents: [expect.objectContaining({ src: "./images/a.png" })],
					}),
				},
			],
			deletedElementIds: [],
			changedElementIds: ["child-1"],
			elementNameChanges: undefined,
		})
		expect(patch.upserts[0]?.element).not.toHaveProperty("runtimeOnly")
	})

	it("skips deleted and temporary elements while preserving deleted ids", () => {
		const temp = createElement("temp-1")
		const manager = createPatchManager([temp], [{ id: "temp-1" }])

		const patch = manager.exportDocumentPatch({
			changedElementIds: ["deleted-1", "temp-1"],
			deletedElementIds: ["deleted-1"],
		})

		expect(patch.upserts).toEqual([])
		expect(patch.deletedElementIds).toEqual(["deleted-1"])
		expect(patch.changedElementIds).toEqual(["deleted-1", "temp-1"])
	})

	it("recursively filters temporary children from exported documents", () => {
		const tempChild = {
			id: "temp-child",
			type: "image",
			x: 12,
			y: 24,
			width: 80,
			height: 60,
			activeContentId: "temp-content",
			mainContentId: "temp-content",
			contents: [{ contentId: "temp-content" }],
		} as LayerElement
		const child = {
			...createElement("child-1"),
			x: 20,
			y: 32,
			width: 40,
			height: 30,
		} as LayerElement
		const frame = {
			id: "frame-1",
			type: "frame",
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			contents: [{ contentId: "frame-content" }],
			children: [tempChild, child],
		} as LayerElement
		const manager = createPatchManager([frame, tempChild, child], [{ id: "temp-child" }])

		expect(manager.exportDocument()).toEqual({
			elements: [
				expect.objectContaining({
					id: "frame-1",
					children: [
						expect.objectContaining({
							id: "child-1",
						}),
					],
				}),
			],
		})
		// 生成结果占位符即使在历史快照中也必须被排除。
		expect(manager.exportDocument({ includeTemporary: true })).toEqual({
			elements: [
				expect.objectContaining({
					id: "frame-1",
					children: [
						expect.objectContaining({
							id: "child-1",
						}),
					],
				}),
			],
		})

		const uploadManager = createPatchManager(
			[frame, tempChild, child],
			[{ id: "temp-child", kind: "upload" }],
		)
		expect(uploadManager.exportDocument({ includeTemporary: true })).toEqual({
			elements: [
				expect.objectContaining({
					id: "frame-1",
					children: [
						expect.objectContaining({ id: "temp-child" }),
						expect.objectContaining({ id: "child-1" }),
					],
				}),
			],
		})

		expect(manager.filterElementsForClipboard([frame])).toEqual([
			expect.objectContaining({
				id: "frame-1",
				children: [expect.objectContaining({ id: "child-1" })],
			}),
		])
		expect(uploadManager.filterElementsForClipboard([frame])).toEqual([
			expect.objectContaining({
				id: "frame-1",
				children: [
					expect.objectContaining({ id: "temp-child" }),
					expect.objectContaining({ id: "child-1" }),
				],
			}),
		])
	})
})

describe("ElementManager generation target commit", () => {
	function createCommitManager(elementIds: string[]) {
		const batchUpdate = vi.fn()
		const emit = vi.fn()
		const markGenerateImageRequestAsUser = vi.fn()
		const temporaryElements = new Map(
			elementIds.map((elementId) => [
				elementId,
				{
					kind: "generation-result" as const,
					historyPolicy: "exclude" as const,
					clipboardPolicy: "exclude" as const,
				},
			]),
		)
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, unknown>
			temporaryElements: typeof temporaryElements
			batchUpdate: typeof batchUpdate
			canvas: {
				eventEmitter: { emit: typeof emit }
				elementDetailsRuntimeManager: {
					markGenerateImageRequestAsUser: typeof markGenerateImageRequestAsUser
				}
			}
			commitGenerationTargets: ElementManager["commitGenerationTargets"]
		}
		manager.elements = new Map(elementIds.map((elementId) => [elementId, {}]))
		manager.temporaryElements = temporaryElements
		manager.batchUpdate = batchUpdate
		manager.canvas = {
			eventEmitter: { emit },
			elementDetailsRuntimeManager: { markGenerateImageRequestAsUser },
		}
		return {
			manager,
			batchUpdate,
			emit,
			temporaryElements,
			markGenerateImageRequestAsUser,
		}
	}

	it("validates all targets before one batch update and converts them together", () => {
		const { manager, batchUpdate, emit, temporaryElements, markGenerateImageRequestAsUser } =
			createCommitManager(["image-1", "image-2"])
		batchUpdate.mockImplementation(() => {
			expect(temporaryElements.has("image-1")).toBe(true)
			expect(temporaryElements.has("image-2")).toBe(true)
			expect(emit).not.toHaveBeenCalled()
		})

		manager.commitGenerationTargets([
			{
				elementId: "image-1",
				persistedPatch: {
					status: "processing",
					generateImageRequest: { image_id: "image-task-1" },
				},
			},
			{ elementId: "image-2", persistedPatch: { status: "processing" } },
		])

		expect(batchUpdate).toHaveBeenCalledTimes(1)
		expect(batchUpdate).toHaveBeenCalledWith(
			[
				{
					id: "image-1",
					data: {
						status: "processing",
						generateImageRequest: { image_id: "image-task-1" },
					},
				},
				{ id: "image-2", data: { status: "processing" } },
			],
			{ silent: false, emitBatchUpdated: false },
		)
		expect(temporaryElements.size).toBe(0)
		expect(emit).toHaveBeenCalledTimes(3)
		expect(markGenerateImageRequestAsUser).toHaveBeenCalledWith(
			"image-1",
			"image-task-1",
			undefined,
		)
		expect(emit).toHaveBeenLastCalledWith({
			type: "element:batchupdated",
			data: { elementIds: ["image-1", "image-2"] },
		})
	})

	it("does not mutate temporary markers when any target is invalid", () => {
		const { manager, batchUpdate, temporaryElements } = createCommitManager(["image-1"])

		expect(() =>
			manager.commitGenerationTargets([
				{ elementId: "image-1", persistedPatch: { status: "processing" } },
				{ elementId: "missing", persistedPatch: { status: "processing" } },
			]),
		).toThrow("Element missing not found")
		expect(batchUpdate).not.toHaveBeenCalled()
		expect(temporaryElements.has("image-1")).toBe(true)
	})

	it("keeps generation targets temporary when the batch update fails", () => {
		const { manager, batchUpdate, emit, temporaryElements, markGenerateImageRequestAsUser } =
			createCommitManager(["image-1", "image-2"])
		batchUpdate.mockImplementation(() => {
			throw new Error("update failed")
		})

		expect(() =>
			manager.commitGenerationTargets([
				{ elementId: "image-1", persistedPatch: { status: "processing" } },
				{ elementId: "image-2", persistedPatch: { status: "processing" } },
			]),
		).toThrow("update failed")
		expect(temporaryElements.has("image-1")).toBe(true)
		expect(temporaryElements.has("image-2")).toBe(true)
		expect(markGenerateImageRequestAsUser).not.toHaveBeenCalled()
		expect(emit).not.toHaveBeenCalled()
	})
})

describe("ElementManager Content writes", () => {
	it("routes image business field patches into the active Content", () => {
		const manager = Object.create(ElementManager.prototype) as {
			mergeElementData: (
				currentData: LayerElement,
				updates: ElementUpdatePatch,
				elementId: string,
			) => LayerElement
		}
		const current: ImageElement = {
			id: "image-1",
			type: "image",
			activeContentId: "v1",
			mainContentId: "v1",
			contents: [{ contentId: "v1", src: "./images/v1.png" }],
		}

		const merged = manager.mergeElementData(current, { src: "./images/v2.png" }, current.id)
		expect(merged.contents[0]).toEqual(
			expect.objectContaining({ contentId: "v1", src: "./images/v2.png" }),
		)
	})

	it("keeps node identity stable while merging Content patches", () => {
		const manager = Object.create(ElementManager.prototype) as {
			mergeElementData: (
				currentData: LayerElement,
				updates: ElementUpdatePatch & { id?: string; type?: ElementType },
				elementId: string,
			) => LayerElement
		}
		const current: ImageElement = {
			id: "image-1",
			type: "image",
			activeContentId: "v1",
			mainContentId: "v1",
			contents: [{ contentId: "v1", src: "./images/v1.png" }],
		}

		const merged = manager.mergeElementData(
			current,
			{ id: current.id, type: current.type, src: "./images/next.png" },
			current.id,
		)
		if (merged.type !== "image") throw new Error("Expected image Element")
		expect(merged.id).toBe(current.id)
		expect(merged.type).toBe(current.type)
		expect(merged.contents[0]?.src).toBe("./images/next.png")
	})

	it("rejects creating an Element with invalid Content pointers before rendering", () => {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			doCreate: (elementData: LayerElement, options: object) => void
		}
		const invalid: ImageElement = {
			id: "image-1",
			type: "image",
			zIndex: 0,
			activeContentId: "missing",
			mainContentId: "content-1",
			contents: [{ contentId: "content-1", src: "./images/a.png" }],
		}

		expect(() => manager.doCreate(invalid, {})).toThrow("Invalid v3 element data")
	})

	it("rejects updates that leave Content pointers invalid before mutating the Element", () => {
		const current: ImageElement = {
			id: "image-1",
			type: "image",
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [{ contentId: "content-1", src: "./images/a.png" }],
		}
		const update = vi.fn()
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<
				string,
				{ getData: () => LayerElement; getNode: () => null; update: typeof update }
			>
			doUpdate: (elementId: string, updates: Partial<LayerElement>, options: object) => void
		}
		manager.elements = new Map([
			[
				current.id,
				{
					getData: () => current,
					getNode: () => null,
					update,
				},
			],
		])

		expect(() =>
			manager.doUpdate(current.id, { mainContentId: "missing" } as Partial<LayerElement>, {}),
		).toThrow("Invalid v3 element data")
		expect(update).not.toHaveBeenCalled()
	})
})

describe("ElementManager batch update completion events", () => {
	it("does not emit batchupdated when an update throws", () => {
		const emit = vi.fn()
		const current: ImageElement = {
			id: "image-1",
			type: "image",
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [{ contentId: "content-1", src: "./images/a.png" }],
		}
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, { getData: () => LayerElement }>
			batchMode: boolean
			doUpdate: ReturnType<typeof vi.fn>
			flush: ReturnType<typeof vi.fn>
			canvas: { eventEmitter: { emit: typeof emit } }
			batchUpdate: ElementManager["batchUpdate"]
		}
		manager.elements = new Map([["image-1", { getData: () => current }]])
		manager.batchMode = false
		manager.doUpdate = vi.fn(() => {
			throw new Error("update failed")
		})
		manager.flush = vi.fn()
		manager.canvas = { eventEmitter: { emit } }

		expect(() =>
			manager.batchUpdate([{ id: "image-1", data: { status: "processing" } }]),
		).toThrow("update failed")
		expect(manager.flush).toHaveBeenCalledOnce()
		expect(emit).not.toHaveBeenCalled()
	})

	it("validates every batch target before applying any update", () => {
		const image = (id: string): ImageElement => ({
			id,
			type: "image",
			activeContentId: `${id}-content`,
			mainContentId: `${id}-content`,
			contents: [{ contentId: `${id}-content`, src: `./images/${id}.png` }],
		})
		const first = image("image-1")
		const second = image("image-2")
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, { getData: () => LayerElement }>
			batchMode: boolean
			doUpdate: ReturnType<typeof vi.fn>
			flush: ReturnType<typeof vi.fn>
			batchUpdate: ElementManager["batchUpdate"]
		}
		manager.elements = new Map([
			[first.id, { getData: () => first }],
			[second.id, { getData: () => second }],
		])
		manager.batchMode = false
		manager.doUpdate = vi.fn()
		manager.flush = vi.fn()

		expect(() =>
			manager.batchUpdate([
				{ id: first.id, data: { name: "valid" } },
				{ id: second.id, data: { activeContentId: "missing" } as Partial<LayerElement> },
			]),
		).toThrow("Invalid v3 element data")
		expect(manager.doUpdate).not.toHaveBeenCalled()
		expect(manager.flush).not.toHaveBeenCalled()
	})
})

describe("ElementManager temporary element creation", () => {
	function createTemporaryManager() {
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, unknown>
			temporaryElements: Map<string, unknown>
			doCreate: ReturnType<typeof vi.fn>
			doDelete: ReturnType<typeof vi.fn>
			getElementsDict: ElementManager["getElementsDict"]
			createTemporaryElement: ElementManager["createTemporaryElement"]
		}
		manager.elements = new Map()
		manager.temporaryElements = new Map()
		manager.doCreate = vi.fn()
		manager.doDelete = vi.fn((elementId: string) => {
			manager.elements.delete(elementId)
			manager.temporaryElements.delete(elementId)
		})
		manager.getElementsDict = () => ({}) as Record<string, LayerElement>
		return manager
	}

	it("marks an element temporary before creation can emit events", () => {
		const manager = createTemporaryManager()
		const element = createElement("temporary-1")
		manager.doCreate.mockImplementation(() => {
			expect(manager.temporaryElements.has(element.id)).toBe(true)
			expect(manager.temporaryElements.get(element.id)).toMatchObject({
				kind: "generation-result",
				historyPolicy: "exclude",
				clipboardPolicy: "exclude",
			})
			manager.elements.set(element.id, { getData: () => element })
		})

		expect(manager.createTemporaryElement(element)).toMatchObject({ elementId: element.id })
		expect(manager.doCreate).toHaveBeenCalledWith(element, {})
	})

	it("removes the temporary marker when creation fails", () => {
		const manager = createTemporaryManager()
		const element = createElement("temporary-1")
		manager.doCreate.mockImplementation(() => {
			throw new Error("create failed")
		})

		expect(() => manager.createTemporaryElement(element)).toThrow("create failed")
		expect(manager.temporaryElements.has(element.id)).toBe(false)
	})

	it("rolls back an element inserted before a later creation step fails", () => {
		const manager = createTemporaryManager()
		const element = createElement("temporary-1")
		manager.doCreate.mockImplementation(() => {
			manager.elements.set(element.id, {})
			throw new Error("mounted failed")
		})

		expect(() => manager.createTemporaryElement(element)).toThrow("mounted failed")
		expect(manager.doDelete).toHaveBeenCalledWith(element.id, { suppressEvents: true })
		expect(manager.elements.has(element.id)).toBe(false)
		expect(manager.temporaryElements.has(element.id)).toBe(false)
	})

	it("removes the temporary marker when no element instance is created", () => {
		const manager = createTemporaryManager()
		const element = createElement("temporary-1")

		expect(() => manager.createTemporaryElement(element)).toThrow(
			"Element temporary-1 could not be created",
		)
		expect(manager.temporaryElements.has(element.id)).toBe(false)
	})

	it("forwards the normalized upload result to temporary element completion callbacks", () => {
		const element = createElement("temporary-upload-1")
		const queueUpload = vi.fn()
		const manager = Object.create(ElementManager.prototype) as unknown as {
			canvas: {
				canvasFileUploadManager: { queueUpload: typeof queueUpload }
			}
			elements: Map<string, unknown>
			createTemporaryElement: ReturnType<typeof vi.fn>
			createTemporary: ElementManager["createTemporary"]
		}
		manager.canvas = { canvasFileUploadManager: { queueUpload } }
		manager.elements = new Map()
		manager.createTemporaryElement = vi.fn((elementData: LayerElement) => {
			manager.elements.set(elementData.id, {})
			return { elementId: elementData.id, element: elementData }
		})
		const onUploadComplete = vi.fn()

		manager.createTemporary(element, {
			uploadFiles: [new File(["audio"], "voice.mp3", { type: "audio/mpeg" })],
			onUploadComplete,
		})
		const uploadResult: UploadFileResponse = {
			path: "./audios/voice.mp3",
			src: "https://example.test/voice.mp3",
			fileName: "voice.mp3",
		}
		const queuedRequest = queueUpload.mock.calls[0]?.[0] as {
			onUploadComplete: (result: UploadFileResponse) => void
		}
		queuedRequest.onUploadComplete(uploadResult)

		expect(onUploadComplete).toHaveBeenCalledWith(element.id, uploadResult)
	})
})

describe("ElementManager runtime-only generation deletion", () => {
	it("notifies runtime subscribers without emitting a document change", () => {
		const elementData = createElement("runtime-result")
		const element = {
			getData: () => elementData,
			destroy: vi.fn(),
		}
		const runtimeCleanup = vi.fn()
		const eventEmitter = {
			emit: vi.fn((event: { type: string; data?: unknown }) => {
				if (event.type === "element:deleted") runtimeCleanup(event.data)
			}),
		}
		const emitElementChange = vi.fn()
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, typeof element>
			dataTreeVisibilityCache: Map<string, boolean>
			temporaryElements: Map<
				string,
				{
					kind: "generation-result"
					historyPolicy: "exclude"
					clipboardPolicy: "exclude"
				}
			>
			canvas: { eventEmitter: typeof eventEmitter }
			findParentElement: ReturnType<typeof vi.fn>
			markDocumentIndexDirty: ReturnType<typeof vi.fn>
			invalidateGeometryForElement: ReturnType<typeof vi.fn>
			scheduleContentLayerDraw: ReturnType<typeof vi.fn>
			emitElementChange: typeof emitElementChange
			delete: ElementManager["delete"]
		}
		manager.elements = new Map([[elementData.id, element]])
		manager.dataTreeVisibilityCache = new Map()
		manager.temporaryElements = new Map([
			[
				elementData.id,
				{
					kind: "generation-result",
					historyPolicy: "exclude",
					clipboardPolicy: "exclude",
				},
			],
		])
		manager.canvas = { eventEmitter }
		manager.findParentElement = vi.fn(() => null)
		manager.markDocumentIndexDirty = vi.fn()
		manager.invalidateGeometryForElement = vi.fn()
		manager.scheduleContentLayerDraw = vi.fn()
		manager.emitElementChange = emitElementChange

		manager.delete(elementData.id)

		expect(element.destroy).toHaveBeenCalledOnce()
		expect(runtimeCleanup).toHaveBeenCalledWith({
			elementId: elementData.id,
			persistence: "runtime-only",
		})
		expect(emitElementChange).not.toHaveBeenCalled()
	})

	it("does not create a history entry when batch deleting only runtime placeholders", () => {
		const historyManager = {
			disable: vi.fn(),
			enable: vi.fn(),
			recordHistoryImmediate: vi.fn(),
		}
		const manager = Object.create(ElementManager.prototype) as unknown as {
			elements: Map<string, unknown>
			temporaryElements: Map<
				string,
				{
					kind: "generation-result"
					historyPolicy: "exclude"
					clipboardPolicy: "exclude"
				}
			>
			canvas: {
				historyManager: typeof historyManager
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			isBatchDeleting: boolean
			pendingBatchDeleteChangeIds: Set<string>
			isContentLayerDrawDeferred: boolean
			doDelete: ReturnType<typeof vi.fn>
			flushDeferredBatchDeleteEffects: ReturnType<typeof vi.fn>
			batchDelete: ElementManager["batchDelete"]
		}
		manager.elements = new Map([["runtime-result", {}]])
		manager.temporaryElements = new Map([
			[
				"runtime-result",
				{
					kind: "generation-result",
					historyPolicy: "exclude",
					clipboardPolicy: "exclude",
				},
			],
		])
		manager.canvas = {
			historyManager,
			eventEmitter: { emit: vi.fn() },
		}
		manager.isBatchDeleting = false
		manager.pendingBatchDeleteChangeIds = new Set()
		manager.isContentLayerDrawDeferred = false
		manager.doDelete = vi.fn()
		manager.flushDeferredBatchDeleteEffects = vi.fn()

		manager.batchDelete(["runtime-result"])

		expect(manager.doDelete).toHaveBeenCalledWith("runtime-result")
		expect(historyManager.recordHistoryImmediate).not.toHaveBeenCalled()
		expect(historyManager.enable).toHaveBeenCalled()
	})
})
