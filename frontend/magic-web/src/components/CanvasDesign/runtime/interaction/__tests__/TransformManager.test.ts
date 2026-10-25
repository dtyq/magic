import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import { TransformManager } from "../transform/TransformManager"

interface TransformElementStub {
	applyTransform: (
		updates: Partial<LayerElement>,
		options: {
			isRealtime: boolean
			isScaling: boolean
			shouldKeepRatio: boolean
			initialAspectRatio?: number
		},
	) => Partial<LayerElement>
	shouldKeepRatio: () => boolean
	shouldSyncTransformDataInRealtime?: () => boolean
}

interface TransformManagerPrivate {
	canvas: {
		can: ReturnType<typeof vi.fn>
		eventEmitter?: {
			emit: ReturnType<typeof vi.fn>
		}
		runtimeScheduler: {
			requestLayerDraw: ReturnType<typeof vi.fn>
		}
		isKeepRatioModifierPressed: () => boolean
		historyManager?: {
			disable: ReturnType<typeof vi.fn>
			enable: ReturnType<typeof vi.fn>
			recordHistoryImmediate: ReturnType<typeof vi.fn>
		}
		elementManager: {
			getElementInstance: (elementId: string) => TransformElementStub | undefined
			update: ReturnType<typeof vi.fn>
			getNodeAdapter?: () => {
				getElementsBounds: ReturnType<typeof vi.fn>
			}
		}
	}
	transformer?: {
		getActiveAnchor: ReturnType<typeof vi.fn>
		nodes?: ReturnType<typeof vi.fn>
		forceUpdate?: ReturnType<typeof vi.fn>
	}
	multiSelectionProxy: {
		x: () => number
		y: () => number
		width: () => number
		height: () => number
		scaleX: () => number
		scaleY: () => number
	} | null
	proxyInitialBounds: { x: number; y: number; width: number; height: number }
	proxyInitialNodeStates: Map<
		string,
		{
			node: { x: ReturnType<typeof vi.fn>; y: ReturnType<typeof vi.fn> }
			element: TransformElementStub
			x: number
			y: number
			scaleX: number
			scaleY: number
			width?: number
			height?: number
			shouldKeepRatio: boolean
			initialAspectRatio?: number
		}
	>
	transformSessionElementStates: Map<
		string,
		{
			element: TransformElementStub
			shouldKeepRatio: boolean
			initialAspectRatio?: number
		}
	>
	initialElementAspectRatios: Map<string, number>
	initialAspectRatio: number | null
	isAnchorTransformActive: boolean
	isProxyInteractionActive: boolean
	isTransformIntentActive: boolean
	pendingTransformerElementIds: string[] | null
	pendingTransformerUpdateRafId: number | null
	transformingElementIds: Set<string>
	captureProxyState: (elementIds: string[]) => void
	handleTransformerTransformstart: () => void
	handleTransformerTransformend: () => void
	isTransformInteractionActive: () => boolean
	handleTransformerDragmove: () => void
	syncSelectionProxyToElements: (options: { isRealtime: boolean; isScaling: boolean }) => void
	rebaseActiveDragNodePositions: (elementIds: readonly string[]) => void
	isTransforming: (elementId: string) => boolean
	isElementInActiveTransformInteraction: (elementId: string) => boolean
}

interface TransformManagerModifierClickPrivate {
	handleMultiSelectionProxyModifierClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		scale: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
	} as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
	vi.restoreAllMocks()
})

function createModifierClickManager(options?: { canSelect?: boolean; isSelected?: boolean }) {
	const elementId = "element-under-proxy"
	const elementNode = {
		id: () => elementId,
		getParent: () => null,
	} as unknown as Konva.Node
	const hitNode = {
		id: () => "",
		getParent: () => elementNode,
	} as unknown as Konva.Node

	const pointer = { x: 40, y: 60 }
	const getIntersection = vi.fn(() => hitNode)
	const toggle = vi.fn()
	const canSelect = vi.fn(() => options?.canSelect ?? true)
	const isSelected = vi.fn(() => options?.isSelected ?? false)
	const canvas = {
		can: vi.fn(() => true),
		stage: {
			getPointerPosition: vi.fn(() => pointer),
		},
		contentLayer: {
			getIntersection,
		},
		elementManager: {
			hasElement: vi.fn((id: string) => id === elementId),
			getElementData: vi.fn(() => ({ id: elementId, type: "rectangle" })),
		},
		selectionManager: {
			isSelected,
			toggle,
		},
		permissionManager: {
			can: vi.fn((capability: string) =>
				capability === "interaction.select" ? canSelect() : true,
			),
			canSelect,
		},
		eventEmitter: {
			on: vi.fn(),
		},
	} as unknown as Canvas
	const manager = new TransformManager({
		canvas,
	}) as unknown as TransformManagerModifierClickPrivate

	return { canSelect, getIntersection, manager, pointer, toggle }
}

function createProxyClickEvent(
	modifiers: MouseEventInit = { shiftKey: true },
): Konva.KonvaEventObject<MouseEvent> {
	return {
		evt: new MouseEvent("click", modifiers),
	} as Konva.KonvaEventObject<MouseEvent>
}

function createSingleDragMoveManager() {
	const emit = vi.fn()
	const update = vi.fn()
	const applyTransform = vi.fn((updates: Partial<LayerElement>) => updates)
	const element = {
		applyTransform,
		shouldKeepRatio: () => false,
		shouldSyncTransformDataInRealtime: () => false,
	}
	const node = new Konva.Group({ id: "element-1", x: 10, y: 20, width: 100, height: 100 })
	const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate

	manager.canvas = {
		can: vi.fn(() => true),
		permissionManager: { can: vi.fn(() => true) },
		eventEmitter: { emit },
		runtimeScheduler: { requestLayerDraw: vi.fn() },
		isKeepRatioModifierPressed: () => false,
		elementManager: {
			getElementInstance: () => element,
			update,
			getNodeAdapter: () => ({
				getElementsBounds: vi.fn(() => ({ x: 10, y: 20, width: 100, height: 100 })),
			}),
		},
	}
	manager.transformer = {
		getActiveAnchor: vi.fn(() => null),
		nodes: vi.fn(() => [node]),
		forceUpdate: vi.fn(),
	}
	manager.multiSelectionProxy = null
	manager.transformSessionElementStates = new Map([
		["element-1", { element, shouldKeepRatio: false }],
	])
	manager.initialElementAspectRatios = new Map()
	manager.initialAspectRatio = null
	manager.transformingElementIds = new Set(["element-1"])

	return { emit, manager, update }
}

function createProxySyncManager() {
	const emit = vi.fn()
	const update = vi.fn()
	const requestLayerDraw = vi.fn()
	const applyTransform = vi.fn((updates: Partial<LayerElement>) => updates)
	const element = {
		applyTransform,
		shouldKeepRatio: () => false,
		shouldSyncTransformDataInRealtime: () => false,
	}
	const node = {
		x: vi.fn(),
		y: vi.fn(),
	}
	const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate

	manager.canvas = {
		can: vi.fn(() => true),
		permissionManager: { can: vi.fn(() => true) },
		eventEmitter: { emit },
		runtimeScheduler: { requestLayerDraw },
		isKeepRatioModifierPressed: () => false,
		elementManager: {
			getElementInstance: () => element,
			update,
		},
	}
	manager.multiSelectionProxy = {
		x: () => 10,
		y: () => 20,
		width: () => 100,
		height: () => 100,
		scaleX: () => 1,
		scaleY: () => 1,
	}
	manager.proxyInitialBounds = { x: 0, y: 0, width: 100, height: 100 }
	manager.proxyInitialNodeStates = new Map([
		[
			"element-1",
			{
				node,
				element,
				x: 5,
				y: 6,
				scaleX: 1,
				scaleY: 1,
				width: 20,
				height: 30,
				shouldKeepRatio: false,
			},
		],
	])
	manager.transformSessionElementStates = new Map([
		["element-1", { element, shouldKeepRatio: false }],
	])
	manager.initialElementAspectRatios = new Map()
	manager.initialAspectRatio = null
	manager.transformingElementIds = new Set(["element-1"])

	return { applyTransform, element, emit, manager, node, requestLayerDraw, update }
}

function createConstraintManager(elementTypes: Record<string, LayerElement["type"]>) {
	const elementIds = Object.keys(elementTypes)
	const nodes = new Map(
		elementIds.map((elementId, index) => [
			elementId,
			new Konva.Group({
				id: elementId,
				x: index * 500,
				y: 0,
				width: 480,
				height: 120,
			}),
		]),
	)
	const getElementData = vi.fn((elementId: string) => ({
		id: elementId,
		type: elementTypes[elementId],
		x: 0,
		y: 0,
		width: 480,
		height: 120,
	}))
	const getElementInstance = vi.fn((elementId: string) => ({
		getSize: () => ({ width: 480, height: 120 }),
		getTransformConstraints: () => {
			if (elementTypes[elementId] === ElementTypeEnum.Audio) {
				return {
					enabledAnchors: ["middle-left", "middle-right"],
					minWidth: 240,
					fixedHeight: 120,
				}
			}
			if (elementTypes[elementId] === ElementTypeEnum.Storyboard) {
				return { enabledAnchors: [] }
			}
			return undefined
		},
		shouldKeepRatio: () => false,
	}))
	const getSnappedBox = vi.fn((_oldBox, newBox) => newBox)
	const canvas = {
		can: vi.fn(() => true),
		eventEmitter: { on: vi.fn(), emit: vi.fn() },
		runtimeScheduler: { requestLayerDraw: vi.fn() },
		isKeepRatioModifierPressed: () => false,
		elementManager: {
			getElementData,
			getElementInstance,
			getNodeAdapter: () => ({
				getNodesForTransform: (ids: string[]) => ids.map((id) => nodes.get(id)),
				getElementsBounds: () => ({
					x: 0,
					y: 0,
					width: elementIds.length * 480,
					height: 120,
				}),
			}),
		},
		permissionManager: { can: () => true, canTransform: () => true },
		controlsLayer: { add: vi.fn() },
		selectionManager: { getSelectedIds: () => elementIds },
		snapGuideManager: { getSnappedBox },
	} as unknown as Canvas

	return {
		getSnappedBox,
		manager: new TransformManager({ canvas }),
	}
}

describe("TransformManager multi-selection proxy modifier click", () => {
	it("toggles the top content element beneath the proxy", () => {
		const { getIntersection, manager, pointer, toggle } = createModifierClickManager()

		manager.handleMultiSelectionProxyModifierClick(createProxyClickEvent())

		expect(getIntersection).toHaveBeenCalledWith(pointer)
		expect(toggle).toHaveBeenCalledWith("element-under-proxy")
	})

	it("does not add an unselected element that cannot be selected", () => {
		const { canSelect, manager, toggle } = createModifierClickManager({ canSelect: false })

		manager.handleMultiSelectionProxyModifierClick(createProxyClickEvent({ ctrlKey: true }))

		expect(canSelect).toHaveBeenCalledTimes(1)
		expect(toggle).not.toHaveBeenCalled()
	})

	it("still allows modifier deselection for an already selected element", () => {
		const { canSelect, manager, toggle } = createModifierClickManager({
			canSelect: false,
			isSelected: true,
		})

		manager.handleMultiSelectionProxyModifierClick(createProxyClickEvent({ metaKey: true }))

		expect(canSelect).not.toHaveBeenCalled()
		expect(toggle).toHaveBeenCalledWith("element-under-proxy")
	})

	it("keeps ordinary proxy clicks out of selection toggling", () => {
		const { getIntersection, manager, toggle } = createModifierClickManager()

		manager.handleMultiSelectionProxyModifierClick(createProxyClickEvent({}))

		expect(getIntersection).not.toHaveBeenCalled()
		expect(toggle).not.toHaveBeenCalled()
	})
})

describe("TransformManager element constraints", () => {
	it("uses horizontal anchors and preserves the audio minimum width and fixed height", () => {
		const { getSnappedBox, manager } = createConstraintManager({
			"audio-1": ElementTypeEnum.Audio,
		})

		manager.showTransformer(["audio-1"])
		const transformer = (manager as unknown as { transformer: Konva.Transformer }).transformer
		expect(transformer.enabledAnchors()).toEqual(["middle-left", "middle-right"])

		vi.spyOn(transformer, "getActiveAnchor").mockReturnValue("middle-right")
		const boundBoxFunc = transformer.boundBoxFunc()
		const oldBox = { x: 0, y: 0, width: 480, height: 120, rotation: 0 }
		getSnappedBox.mockReturnValueOnce({
			x: 0,
			y: 20,
			width: 300,
			height: 80,
			rotation: 0,
		})
		expect(boundBoxFunc(oldBox, { x: 0, y: 10, width: 300, height: 90, rotation: 0 })).toEqual({
			x: 0,
			y: 0,
			width: 300,
			height: 120,
			rotation: 0,
		})

		getSnappedBox.mockReturnValueOnce({
			x: 0,
			y: 0,
			width: 239,
			height: 120,
			rotation: 0,
		})
		expect(boundBoxFunc(oldBox, { x: 0, y: 0, width: 260, height: 120, rotation: 0 })).toEqual(
			oldBox,
		)
	})

	it("does not expose resize anchors for a storyboard", () => {
		const { manager } = createConstraintManager({
			"storyboard-1": ElementTypeEnum.Storyboard,
		})

		manager.showTransformer(["storyboard-1"])
		const transformer = (manager as unknown as { transformer: Konva.Transformer }).transformer

		expect(transformer.enabledAnchors()).toEqual([])
	})

	it("disables resize anchors when a multi-selection contains audio", () => {
		const { manager } = createConstraintManager({
			"audio-1": ElementTypeEnum.Audio,
			"rectangle-1": ElementTypeEnum.Rectangle,
		})

		manager.showTransformer(["audio-1", "rectangle-1"])
		const transformer = (manager as unknown as { transformer: Konva.Transformer }).transformer

		expect(transformer.enabledAnchors()).toEqual([])
		expect(transformer.nodes()).toHaveLength(1)
	})

	it("disables resize anchors when a multi-selection contains a storyboard", () => {
		const { manager } = createConstraintManager({
			"storyboard-1": ElementTypeEnum.Storyboard,
			"rectangle-1": ElementTypeEnum.Rectangle,
		})

		manager.showTransformer(["storyboard-1", "rectangle-1"])
		const transformer = (manager as unknown as { transformer: Konva.Transformer }).transformer

		expect(transformer.enabledAnchors()).toEqual([])
		expect(transformer.nodes()).toHaveLength(1)
	})
})

describe("TransformManager multi-selection proxy sync", () => {
	it("rebases proxy node coordinates after nodes move to the content layer", () => {
		const node = {
			x: vi.fn(() => 105),
			y: vi.fn(() => 206),
		}
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.multiSelectionProxy = {} as TransformManagerPrivate["multiSelectionProxy"]
		manager.isProxyInteractionActive = true
		manager.proxyInitialNodeStates = new Map([
			[
				"element-1",
				{
					node,
					element: {} as TransformElementStub,
					x: 5,
					y: 6,
					scaleX: 1,
					scaleY: 1,
					shouldKeepRatio: false,
				},
			],
		])

		manager.rebaseActiveDragNodePositions(["element-1"])

		expect(manager.proxyInitialNodeStates.get("element-1")).toEqual(
			expect.objectContaining({ x: 105, y: 206 }),
		)
	})

	it("captures node references for the realtime translation fast path", () => {
		const node = {
			id: () => "element-1",
			x: vi.fn(() => 5),
			y: vi.fn(() => 6),
			scaleX: vi.fn(() => 1),
			scaleY: vi.fn(() => 1),
		}
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.canvas = {
			permissionManager: { can: vi.fn(() => true) },
			elementManager: {
				getNodeAdapter: () => ({
					getElementsBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
					getNodesForTransform: () => [node],
				}),
				getElementData: () => ({ id: "element-1", width: 100, height: 100 }),
				getElementInstance: () => ({
					applyTransform: vi.fn((updates: Partial<LayerElement>) => updates),
					shouldKeepRatio: () => false,
				}),
			},
		} as unknown as TransformManagerPrivate["canvas"]
		manager.proxyInitialNodeStates = new Map()
		manager.transformSessionElementStates = new Map()
		manager.initialElementAspectRatios = new Map()
		manager.initialAspectRatio = null

		manager.captureProxyState(["element-1"])

		expect(manager.proxyInitialNodeStates.get("element-1")?.node).toBe(node)
	})

	it("uses the translation fast path during realtime proxy movement", () => {
		const { applyTransform, manager, node, requestLayerDraw, update } = createProxySyncManager()

		manager.syncSelectionProxyToElements({ isRealtime: true, isScaling: false })

		expect(node.x).toHaveBeenCalledWith(15)
		expect(node.y).toHaveBeenCalledWith(26)
		expect(applyTransform).not.toHaveBeenCalled()
		expect(update).not.toHaveBeenCalled()
		expect(requestLayerDraw).toHaveBeenCalledWith(
			"content",
			expect.objectContaining({
				source: "TransformManager",
				reason: "selection-proxy-translation",
				priority: "input",
			}),
		)
	})

	it("commits data when proxy movement finishes", () => {
		const { manager, update } = createProxySyncManager()

		manager.syncSelectionProxyToElements({ isRealtime: false, isScaling: false })

		expect(update).toHaveBeenCalledTimes(2)
		expect(update).toHaveBeenNthCalledWith(
			1,
			"element-1",
			expect.any(Object),
			expect.objectContaining({ mode: "node-only" }),
		)
		expect(update).toHaveBeenNthCalledWith(
			2,
			"element-1",
			expect.any(Object),
			expect.objectContaining({ mode: "data-only", silent: true }),
		)
	})

	it("syncs data in realtime for elements that rebuild their internal render nodes", () => {
		const { element, manager, update } = createProxySyncManager()
		element.shouldSyncTransformDataInRealtime = () => true
		manager.multiSelectionProxy = {
			x: () => 10,
			y: () => 20,
			width: () => 200,
			height: () => 150,
			scaleX: () => 1,
			scaleY: () => 1,
		}

		manager.syncSelectionProxyToElements({ isRealtime: true, isScaling: true })

		expect(update).toHaveBeenCalledTimes(2)
		expect(update).toHaveBeenNthCalledWith(
			1,
			"element-1",
			expect.any(Object),
			expect.objectContaining({ mode: "node-only" }),
		)
		expect(update).toHaveBeenNthCalledWith(
			2,
			"element-1",
			expect.any(Object),
			expect.objectContaining({ mode: "data-only", silent: true }),
		)
	})

	it("keeps the node-only fast path for ordinary elements during realtime scaling", () => {
		const { manager, update } = createProxySyncManager()
		manager.multiSelectionProxy = {
			x: () => 10,
			y: () => 20,
			width: () => 200,
			height: () => 150,
			scaleX: () => 1,
			scaleY: () => 1,
		}

		manager.syncSelectionProxyToElements({ isRealtime: true, isScaling: true })

		expect(update).toHaveBeenCalledTimes(1)
		expect(update).toHaveBeenCalledWith(
			"element-1",
			expect.any(Object),
			expect.objectContaining({ mode: "node-only" }),
		)
	})

	it("converts mixed Frame and root elements back to their parent coordinates", () => {
		const contentLayer = new Konva.Layer()
		const frame = new Konva.Group({ x: 100, y: 50 })
		const insideNode = new Konva.Group({
			id: "inside",
			x: 30,
			y: 10,
			width: 20,
			height: 20,
		})
		const outsideNode = new Konva.Group({
			id: "outside",
			x: 180,
			y: 60,
			width: 20,
			height: 20,
		})
		frame.add(insideNode)
		contentLayer.add(frame)
		contentLayer.add(outsideNode)

		const applyTransform = vi.fn((updates: Partial<LayerElement>) => updates)
		const update = vi.fn()
		const elementInstance = {
			applyTransform,
			shouldKeepRatio: () => false,
			shouldSyncTransformDataInRealtime: () => false,
		}
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.canvas = {
			permissionManager: { can: vi.fn(() => true) },
			contentLayer,
			isKeepRatioModifierPressed: () => false,
			elementManager: {
				getNodeAdapter: () => ({
					getElementsBounds: vi.fn(() => ({ x: 130, y: 60, width: 70, height: 20 })),
					getNodesForTransform: () => [insideNode, outsideNode],
				}),
				getElementData: () => ({ width: 20, height: 20 }),
				getElementInstance: () => elementInstance,
				update,
			},
		} as unknown as TransformManagerPrivate["canvas"]
		manager.multiSelectionProxy = {
			x: () => 130,
			y: () => 60,
			width: () => 140,
			height: () => 20,
			scaleX: () => 1,
			scaleY: () => 1,
		}
		manager.proxyInitialNodeStates = new Map()
		manager.transformSessionElementStates = new Map()
		manager.initialElementAspectRatios = new Map()
		manager.initialAspectRatio = null
		manager.proxyInitialBounds = { x: 130, y: 60, width: 70, height: 20 }

		manager.captureProxyState(["inside", "outside"])
		manager.syncSelectionProxyToElements({ isRealtime: true, isScaling: true })

		const insideUpdate = update.mock.calls.find(([id]) => id === "inside")?.[1]
		const outsideUpdate = update.mock.calls.find(([id]) => id === "outside")?.[1]
		expect(insideUpdate).toEqual(expect.objectContaining({ x: 30, y: 10, scaleX: 2 }))
		expect(outsideUpdate).toEqual(expect.objectContaining({ x: 230, y: 60, scaleX: 2 }))
	})

	it("emits one batched dragmove with proxy bounds during realtime proxy movement", () => {
		const { emit, manager } = createProxySyncManager()

		manager.handleTransformerDragmove()

		expect(emit).toHaveBeenCalledTimes(1)
		expect(emit).toHaveBeenCalledWith({
			type: "elements:transform:dragmove",
			data: {
				elementIds: ["element-1"],
				boundingRect: { x: 10, y: 20, width: 100, height: 100 },
			},
		})
		expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: "element:dragmove" }))
	})

	it("emits one batched dragmove with selection bounds during realtime single movement", () => {
		const { emit, manager, update } = createSingleDragMoveManager()

		manager.handleTransformerDragmove()

		expect(update).toHaveBeenCalledWith(
			"element-1",
			expect.objectContaining({ x: 10, y: 20 }),
			expect.objectContaining({
				mode: "node-only",
				skipGeometryInvalidate: true,
			}),
		)
		expect(emit).toHaveBeenCalledWith({
			type: "elements:transform:dragmove",
			data: {
				elementIds: ["element-1"],
				boundingRect: { x: 10, y: 20, width: 100, height: 100 },
			},
		})
		expect(emit).toHaveBeenCalledWith({
			type: "element:dragmove",
			data: { elementId: "element-1" },
		})
	})

	it("marks single-anchor scaling as an active transform", () => {
		const emit = vi.fn()
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.canvas = {
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			eventEmitter: { emit },
			runtimeScheduler: { requestLayerDraw: vi.fn() },
			isKeepRatioModifierPressed: () => false,
			elementManager: {
				getNodeAdapter: () => ({
					getElementsBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 50 })),
					getElementBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 50 })),
				}),
				getElementInstance: vi.fn(() => undefined),
				update: vi.fn(),
			},
		}
		manager.transformer = {
			getActiveAnchor: vi.fn(() => "top-left"),
			forceUpdate: vi.fn(),
		}
		manager.multiSelectionProxy = null
		manager.initialElementAspectRatios = new Map()
		manager.transformSessionElementStates = new Map()
		manager.initialAspectRatio = null
		manager.isAnchorTransformActive = false
		manager.isProxyInteractionActive = false
		manager.isTransformIntentActive = true
		manager.transformingElementIds = new Set(["element-1"])

		manager.handleTransformerTransformstart()

		expect(manager.isTransformInteractionActive()).toBe(true)
		expect(manager.isAnchorTransformActive).toBe(true)
		expect(manager.isTransformIntentActive).toBe(false)
		expect(emit).toHaveBeenCalledWith({
			type: "elements:transform:anchorDragStart",
			data: { elementIds: ["element-1"], activeAnchor: "top-left" },
		})
	})

	it("clears anchor transform active state after transformend", () => {
		const emit = vi.fn()
		const update = vi.fn()
		const applyTransform = vi.fn((updates: Partial<LayerElement>) => updates)
		const schedulePendingTransformerUpdate = vi.fn()
		const node = new Konva.Group({
			id: "element-1",
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			scaleX: 1,
			scaleY: 1,
		})
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.canvas = {
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			eventEmitter: { emit },
			runtimeScheduler: { requestLayerDraw: vi.fn() },
			isKeepRatioModifierPressed: () => false,
			historyManager: {
				disable: vi.fn(),
				enable: vi.fn(),
				recordHistoryImmediate: vi.fn(),
			},
			elementManager: {
				getElementInstance: vi.fn(() => ({
					applyTransform,
					shouldKeepRatio: () => false,
				})),
				update,
			},
		}
		manager.transformer = {
			getActiveAnchor: vi.fn(() => "top-left"),
			nodes: vi.fn(() => [node]),
			forceUpdate: vi.fn(),
		}
		manager.multiSelectionProxy = null
		manager.initialElementAspectRatios = new Map([["element-1", 2]])
		manager.transformSessionElementStates = new Map()
		manager.initialAspectRatio = 2
		manager.isAnchorTransformActive = true
		manager.isProxyInteractionActive = false
		manager.isTransformIntentActive = false
		manager.pendingTransformerElementIds = null
		manager.pendingTransformerUpdateRafId = null
		manager.transformingElementIds = new Set(["element-1"])
		;(
			manager as unknown as {
				schedulePendingTransformerUpdate: ReturnType<typeof vi.fn>
			}
		).schedulePendingTransformerUpdate = schedulePendingTransformerUpdate

		manager.handleTransformerTransformend()

		expect(manager.isTransformInteractionActive()).toBe(false)
		expect(manager.isAnchorTransformActive).toBe(false)
		expect(schedulePendingTransformerUpdate).toHaveBeenCalledTimes(1)
		expect(emit).toHaveBeenCalledWith({
			type: "elements:transform:anchorDragend",
			data: { elementIds: ["element-1"], activeAnchor: "top-left" },
		})
		expect(update).toHaveBeenCalled()
	})

	it("distinguishes transformer attachment from active transform interaction", () => {
		const manager = Object.create(TransformManager.prototype) as TransformManagerPrivate
		manager.transformingElementIds = new Set(["element-1"])
		manager.isAnchorTransformActive = false
		manager.isProxyInteractionActive = false
		manager.isTransformIntentActive = false
		;(manager as unknown as { isDragging: boolean }).isDragging = false

		expect(manager.isTransforming("element-1")).toBe(true)
		expect(manager.isElementInActiveTransformInteraction("element-1")).toBe(false)

		manager.isAnchorTransformActive = true

		expect(manager.isElementInActiveTransformInteraction("element-1")).toBe(true)
		expect(manager.isElementInActiveTransformInteraction("element-2")).toBe(false)
	})
})
