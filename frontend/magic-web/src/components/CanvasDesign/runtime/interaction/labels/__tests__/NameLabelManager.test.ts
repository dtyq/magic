import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Konva from "konva"
import { ElementTypeEnum, type ElementType } from "../../../document/types"
import { NameLabelManager } from "../NameLabelManager"
import { SizeLabelManager } from "../SizeLabelManager"
import { BaseLabelManager, type LabelLayoutSyncContext } from "../BaseLabelManager"
import { invalidateMediaLabelLayouts } from "../mediaLabelLayout"
import type { NameLabelIconResolver } from "../nameLabelTypes"
import type { NameLabelContent } from "../../../elements/core/BaseElement"

vi.mock("../../../resources/asset/assetComplianceState", () => ({
	getMediaAssetId: (content?: { assetId?: string }) => content?.assetId,
	resolveMediaComplianceStatus: (_canvas: unknown, content?: { complianceStatus?: string }) =>
		content?.complianceStatus,
	resolveMediaComplianceFailedReason: (
		_canvas: unknown,
		content?: { complianceFailedReason?: string | null },
	) => content?.complianceFailedReason ?? undefined,
}))

type TestElement = {
	getData: () => { id: string; type: ElementType; zIndex?: number }
	getBoundingRect?: () => { x: number; y: number; width: number; height: number }
	getNameLabelText?: () => string
	getNameLabelContent?: () => NameLabelContent
	getNode?: () => object
	supportsSizeEditing?: () => boolean
	getSizeLabelText?: () => string
}

class TestNameLabelManager extends NameLabelManager {
	protected override reorderAllLabels(skipBatchDraw = false): void {
		void skipBatchDraw
	}

	public createOrUpdateLabelForTest(elementId: string): boolean {
		return this.createOrUpdateLabel(elementId)
	}

	public getCanvasForTest() {
		return this.canvas
	}

	public refreshVisibility(): void {
		this.updateAllLabelsVisibility()
	}

	public hasLabel(elementId: string): boolean {
		return this.labelMap.has(elementId)
	}

	public isLabelVisible(elementId: string): boolean | undefined {
		return this.labelMap.get(elementId)?.visible()
	}

	public getLabelScale(elementId: string): number | undefined {
		return this.labelMap.get(elementId)?.scaleX()
	}

	public getLabelTextMetrics(
		elementId: string,
	): { width: number; naturalWidth: number; ellipsis: boolean } | null {
		const textNode = this.labelMap.get(elementId)?.findOne("Text") as Konva.Text | null
		if (!textNode) return null
		return {
			width: textNode.width(),
			naturalWidth: textNode.measureSize(textNode.text()).width,
			ellipsis: textNode.ellipsis(),
		}
	}

	public getTextNodeForTest(elementId: string): Konva.Text | null {
		return this.labelMap.get(elementId)?.findOne(".name-label-text") as Konva.Text | null
	}

	public getRenderedTextWidthForTest(elementId: string): number | undefined {
		const textNode = this.getTextNodeForTest(elementId)
		return textNode?.textArr.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0)
	}

	public getIconNodeForTest(elementId: string): Konva.Node | null {
		return this.labelMap.get(elementId)?.findOne(".name-label-icon") as Konva.Node | null
	}

	public getRenameHitNodeForTest(elementId: string): Konva.Rect | null {
		return this.labelMap.get(elementId)?.findOne(".name-label-rename-hit") as Konva.Rect | null
	}

	public getLabelHitNodeForTest(elementId: string): Konva.Rect | null {
		return this.labelMap.get(elementId)?.findOne(".name-label-hit") as Konva.Rect | null
	}

	public getRenameIconNodeForTest(elementId: string): Konva.Path | null {
		return this.labelMap.get(elementId)?.findOne(".name-label-rename-icon") as Konva.Path | null
	}

	public getComplianceHitNodeForTest(elementId: string): Konva.Rect | null {
		return this.labelMap
			.get(elementId)
			?.findOne(".name-label-compliance-hit") as Konva.Rect | null
	}

	public getSuffixNodeForTest(elementId: string): Konva.Text | null {
		return (
			(this.labelMap.get(elementId)?.findOne(".name-label-suffix") as Konva.Text | null) ??
			null
		)
	}

	public getSuffixBackgroundForTest(elementId: string): Konva.Rect | null {
		return (
			(this.labelMap
				.get(elementId)
				?.findOne(".name-label-status-background") as Konva.Rect | null) ?? null
		)
	}

	public updateLabelPositionForTest(elementId: string): boolean {
		return this.updateLabelPosition(elementId, true)
	}

	public updateLabelPositionWithContextForTest(
		elementId: string,
		context: LabelLayoutSyncContext,
	): boolean {
		return this.updateLabelPosition(elementId, true, context)
	}

	public getLabelPositionForTest(
		boundingRect: { x: number; y: number; width: number; height: number },
		labelSize: { width: number; height: number },
		inverseScale: number,
	): { x: number; y: number } {
		return this.calculateLabelPosition(boundingRect, labelSize, inverseScale)
	}

	public shouldSuppressSizeLabelForTest(elementId: string): boolean {
		return this.shouldSuppressSizeLabel(elementId)
	}

	public isLabelVisibleByDefault(elementId: string): boolean | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return this.calculateBaseVisibility(elementId, element)
	}

	public getTooWideLabelVisibility(elementId: string): boolean | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return this.calculateCustomVisibility(
			elementId,
			element,
			{
				findOne: () => ({ width: () => 200 }),
				scaleX: () => 1,
				x: () => 0,
			} as never,
			true,
		)
	}
}

class TestSizeLabelManager extends SizeLabelManager {
	public createForTest(id: string): void {
		this.canvas.sizeLabelManager = this
		this.createOrUpdateLabel(id)
	}

	public refreshForTest(): void {
		this.updateAllLabelsVisibility()
	}

	public visibleForTest(id: string): boolean {
		return this.labelMap.get(id)?.visible() ?? false
	}

	public updateLabelPositionWithContextForTest(
		elementId: string,
		context: LabelLayoutSyncContext,
	): boolean {
		return this.updateLabelPosition(elementId, true, context)
	}
}

function createManager(
	elements: Map<string, TestElement>,
	options: {
		selectedElementId?: string
		hoveredElementId?: string
		viewportScale?: number
		viewportPosition?: { x: number; y: number }
		candidateIds?: string[]
		parents?: Map<string, string>
		iconResolver?: NameLabelIconResolver
		canRename?: boolean
		mediaLabelsAlwaysVisible?: boolean
		sizeLabelManager?: {
			isLabelVisibleForElement?: (elementId: string) => boolean
			isLabelEligibleForNamePriority?: (elementId: string) => boolean
			refreshVisibilityForNamePriority?: (
				elementId: string,
				skipBatchDraw?: boolean,
			) => boolean
			getLabelSizeForElement: (elementId: string) => { width: number; height: number } | null
		}
	} = {},
): TestNameLabelManager {
	const runtimeElements = new Map<
		string,
		{ source: TestElement; element: TestElement & { supportsSizeEditing: () => boolean } }
	>()
	const getRuntimeElement = (elementId: string) => {
		const source = elements.get(elementId)
		if (!source) return undefined
		const cached = runtimeElements.get(elementId)
		if (cached?.source === source) return cached.element
		const element = {
			...source,
			getNode: () => source.getNode?.() ?? {},
			supportsSizeEditing: () => source.supportsSizeEditing?.() ?? false,
		}
		runtimeElements.set(elementId, { source, element })
		return element
	}
	const eventHandlers = new Map<string, Set<(event: { data?: unknown }) => void>>()
	const eventEmitter = {
		on: vi.fn((eventType: string, handler: (event: { data?: unknown }) => void) => {
			const handlers = eventHandlers.get(eventType) ?? new Set()
			handlers.add(handler)
			eventHandlers.set(eventType, handlers)
			return () => {
				handlers.delete(handler)
				if (handlers.size === 0) eventHandlers.delete(eventType)
			}
		}),
		emit: vi.fn((event: { type: string; data?: unknown }) => {
			eventHandlers.get(event.type)?.forEach((handler) => handler(event))
		}),
	}

	const manager = new TestNameLabelManager({
		iconResolver: options.iconResolver,
		canvas: {
			cropManager: { getCroppingElementId: () => null },
			cursorManager: {
				restoreToolCursor: vi.fn(),
				setTemporary: vi.fn(),
			},
			elementRenameManager: {
				canRename: () => options.canRename ?? true,
				startRename: vi.fn(),
			},
			elementManager: {
				getElementData: (elementId: string) => elements.get(elementId)?.getData(),
				getElementInstance: getRuntimeElement,
				getAllElementIds: () => Array.from(elements.keys()),
				findParentIdForElement: (id: string) => options.parents?.get(id),
				isElementVisibleInDataTree: () => true,
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) =>
					getRuntimeElement(elementId)?.getBoundingRect?.() ?? null,
				getRevision: () => 1,
				queryElementIdsByExpandedRect: () => options.candidateIds ?? [],
			},
			eraserManager: { getErasingElementId: () => null },
			eventEmitter,
			extendManager: { getExtendingElementId: () => null },
			hoverManager: {
				getHoveredElementId: () => options.hoveredElementId ?? null,
			},
			overlayLayer: { add: vi.fn() },
			permissionManager: {
				canRename: () => options.canRename ?? true,
				canSelect: () => true,
			},
			sizeLabelManager: options.sizeLabelManager,
			runtimeScheduler: { requestLayerDraw: vi.fn() },
			selectionManager: {
				isSelected: (elementId: string) => options.selectedElementId === elementId,
				getSelectionCount: () => (options.selectedElementId ? 1 : 0),
				replaceSelection: vi.fn(),
			},
			stage: {
				position: () => options.viewportPosition ?? { x: 0, y: 0 },
				scaleX: () => options.viewportScale ?? 1,
			},
			textEditingManager: { isEditing: () => false },
			toolManager: (() => {
				const selectionTool = {}
				return {
					getSelectionTool: () => selectionTool,
					getActiveTool: () => selectionTool,
				}
			})(),
			viewportQueryCoordinator: {
				getSnapshot: () => ({ generation: 0, labelElementIds: [] }),
			},
		} as never,
	})
	const managerCanvas = manager.getCanvasForTest()
	managerCanvas.nameLabelManager = manager
	managerCanvas.sizeLabelManager =
		(options.sizeLabelManager as never) ??
		({
			labelConfig: { fontSize: 12, offsetTop: 5 },
			getIntrinsicLabelSize: (elementId: string) => {
				const sizeText = elements.get(elementId)?.getSizeLabelText?.() ?? ""
				return { width: sizeText.length * 8, height: 12 }
			},
		} as never)
	if (options.mediaLabelsAlwaysVisible ?? true) {
		// Layout tests opt into the explicit always-visible mode; production defaults to hover/select.
		manager.setMediaLabelsAlwaysVisible(true)
	}
	return manager
}

describe("NameLabelManager visibility", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			save: vi.fn(),
			restore: vi.fn(),
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
			measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
		} as unknown as CanvasRenderingContext2D)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps the label above the top-left control point clearance", () => {
		const manager = createManager(
			new Map([
				[
					"image-1",
					{
						getBoundingRect: () => ({ x: 10, y: 100, width: 100, height: 80 }),
						getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					},
				],
			]),
		)

		expect(
			manager.getLabelPositionForTest(
				{ x: 10, y: 100, width: 100, height: 80 },
				{ width: 80, height: 16 },
				1,
			),
		).toEqual({ x: 10, y: 75 })
		expect(
			manager.getLabelPositionForTest(
				{ x: 10, y: 100, width: 100, height: 80 },
				{ width: 80, height: 16 },
				0.5,
			),
		).toEqual({ x: 10, y: 87.5 })

		manager.destroy()
	})

	it("keeps audio labels visible without hover or selection", () => {
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
				},
			],
			[
				"image-1",
				{
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
				},
			],
		])
		const manager = createManager(elements, { mediaLabelsAlwaysVisible: false })

		expect(manager.isLabelVisibleByDefault("audio-1")).toBe(true)
		expect(manager.isLabelVisibleByDefault("image-1")).toBe(false)

		manager.destroy()
	})

	it("keeps a narrow audio label visible and truncates its rendered text", () => {
		const getBoundingRect = () => ({ x: 0, y: 0, width: 100, height: 100 })
		const labelText = "A deliberately long audio name"
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect,
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => labelText,
					getNode: () => ({}),
				},
			],
			[
				"image-1",
				{
					getBoundingRect,
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
				},
			],
		])
		const manager = createManager(elements)

		// A foreign label group without cached layout state still takes the defensive width path.
		expect(manager.getTooWideLabelVisibility("audio-1")).toBe(false)
		expect(manager.getTooWideLabelVisibility("image-1")).toBeNull()
		expect(manager.createOrUpdateLabelForTest("audio-1")).toBe(true)
		expect(manager.isLabelVisible("audio-1")).toBe(true)

		const textNode = manager.getTextNodeForTest("audio-1")
		expect(textNode?.text()).toBe(labelText)
		expect(textNode?.width()).toBeLessThanOrEqual(100)
		expect(textNode?.textArr[0]?.text.endsWith("…")).toBe(true)

		manager.destroy()
	})

	it("truncates only the primary name and keeps the state suffix complete", () => {
		const labelContent: NameLabelContent = {
			primaryText: "A deliberately long audio name",
			suffix: { text: "(生成中)" },
		}
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelContent: () => labelContent,
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements)

		manager.createOrUpdateLabelForTest("audio-1")

		const primaryNode = manager.getTextNodeForTest("audio-1")
		const suffixNode = manager.getSuffixNodeForTest("audio-1")
		expect(primaryNode?.text()).toBe(labelContent.primaryText)
		expect(primaryNode?.textArr[0]?.text.endsWith("…")).toBe(true)
		expect(suffixNode?.text()).toBe("(生成中)")
		const renderedTextWidth = primaryNode?.textArr.reduce(
			(maxWidth, line) => Math.max(maxWidth, line.width),
			0,
		)
		expect(renderedTextWidth).toBeLessThan(primaryNode?.width() ?? 0)
		expect(suffixNode?.x()).toBe((renderedTextWidth ?? 0) + 8)
		expect((primaryNode?.width() ?? 0) + (suffixNode?.width() ?? 0)).toBeLessThanOrEqual(100)

		manager.destroy()
	})

	it("updates and removes a suffix when runtime label state changes", () => {
		let suffix: string | undefined = "(生成中)"
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelContent: () => ({
						primaryText: "Audio name",
						suffix: suffix ? { text: suffix } : undefined,
					}),
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements)
		manager.createOrUpdateLabelForTest("audio-1")
		expect(manager.getSuffixNodeForTest("audio-1")?.text()).toBe("(生成中)")

		suffix = "(失败)"
		manager.refreshIcons(["audio-1"])
		expect(manager.getSuffixNodeForTest("audio-1")?.text()).toBe("(失败)")

		suffix = undefined
		manager.refreshIcons(["audio-1"])
		expect(manager.getSuffixNodeForTest("audio-1")).toBeNull()

		manager.destroy()
	})

	it("resolves optional icons only at discrete state changes", () => {
		const getBoundingRect = vi.fn(() => ({ x: 10, y: 20, width: 100, height: 80 }))
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect,
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "Audio name",
					getNode: () => ({}),
				},
			],
		])
		const iconResolver = vi.fn<NameLabelIconResolver>(({ selected }) => ({
			key: selected ? "audio-selected" : "audio-status",
			width: 12,
			height: 12,
			create: () => new Konva.Rect({ width: 12, height: 12 }),
		}))
		const options: { selectedElementId?: string; iconResolver?: NameLabelIconResolver } = {
			iconResolver,
		}
		const manager = createManager(elements, options)

		manager.createOrUpdateLabelForTest("audio-1")
		const initialResolverCalls = iconResolver.mock.calls.length
		const textNode = manager.getTextNodeForTest("audio-1")
		const iconNode = manager.getIconNodeForTest("audio-1")

		expect(iconNode).toBeInstanceOf(Konva.Rect)
		expect(iconNode?.listening()).toBe(false)
		expect(iconNode?.x()).toBe(0)
		expect(textNode?.x()).toBe(14)
		expect(textNode?.width()).toBeLessThanOrEqual(82)

		manager.updateLabelPositionForTest("audio-1")
		expect(iconResolver).toHaveBeenCalledTimes(initialResolverCalls)
		const layoutCallsBeforeStableRefresh = getBoundingRect.mock.calls.length
		manager.refreshIcons(["audio-1"])
		expect(getBoundingRect).toHaveBeenCalledTimes(layoutCallsBeforeStableRefresh)
		expect(iconResolver).toHaveBeenCalledTimes(initialResolverCalls + 1)

		options.selectedElementId = "audio-1"
		manager.refreshIcons(["audio-1"])
		expect(iconResolver).toHaveBeenLastCalledWith(
			expect.objectContaining({ selected: true, elementId: "audio-1" }),
		)

		manager.destroy()
	})

	it("hides the optional icon before dropping mandatory text", () => {
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 0, y: 0, width: 22, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "Audio name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			iconResolver: () => ({
				key: "audio-status",
				width: 12,
				height: 12,
				create: () => new Konva.Rect({ width: 12, height: 12 }),
			}),
		})

		manager.createOrUpdateLabelForTest("audio-1")

		expect(manager.getIconNodeForTest("audio-1")?.visible()).toBe(false)
		expect(manager.getTextNodeForTest("audio-1")?.x()).toBe(0)
		expect(manager.isLabelVisible("audio-1")).toBe(true)

		manager.destroy()
	})

	it("renders the primary name, suffix and rename action inside Konva", () => {
		const primaryText = "Image title"
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: 200, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelContent: () => ({
						primaryText,
						suffix: { text: "(生成中)" },
					}),
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			canRename: true,
			iconResolver: () => ({
				key: "image-status",
				width: 12,
				height: 12,
				create: () => new Konva.Rect({ width: 12, height: 12 }),
			}),
		})

		manager.createOrUpdateLabelForTest("image-1")

		const primaryNode = manager.getTextNodeForTest("image-1")
		const suffixNode = manager.getSuffixNodeForTest("image-1")
		const suffixBackground = manager.getSuffixBackgroundForTest("image-1")
		const renderedTextWidth = primaryNode?.textArr.reduce(
			(maxWidth, line) => Math.max(maxWidth, line.width),
			0,
		)

		expect(primaryNode?.text()).toBe(primaryText)
		expect(suffixNode?.text()).toBe("(生成中)")
		expect(suffixBackground).toBeInstanceOf(Konva.Rect)
		const renameHit = manager.getRenameHitNodeForTest("image-1")
		const renderedNameEnd = (primaryNode?.x() ?? 0) + (renderedTextWidth ?? 0)
		const statusBackgroundEnd = (suffixBackground?.x() ?? 0) + (suffixBackground?.width() ?? 0)
		expect(suffixBackground?.x()).toBe(renderedNameEnd + 4)
		expect(suffixNode?.x()).toBe((suffixBackground?.x() ?? 0) + 4)
		expect(renameHit).toBeInstanceOf(Konva.Rect)
		expect(renameHit?.x()).toBe(statusBackgroundEnd + 4)
		expect((suffixNode?.x() ?? 0) - renderedNameEnd).toBe(8)
		expect((renameHit?.x() ?? 0) - ((suffixNode?.x() ?? 0) + (suffixNode?.width() ?? 0))).toBe(
			8,
		)
		expect(renameHit?.listening()).toBe(true)
		expect(manager.getRenameIconNodeForTest("image-1")?.visible()).toBe(false)
		expect(manager.getIconNodeForTest("image-1")?.x()).toBe(0)

		manager.destroy()
	})

	it("renders a meta suffix without a status background", () => {
		const elements = new Map<string, TestElement>([
			[
				"frame-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: 200, height: 80 }),
					getData: () => ({ id: "frame-1", type: ElementTypeEnum.Frame }),
					getNameLabelContent: () => ({
						primaryText: "画框",
						suffix: { text: " (2)", showBackground: false },
					}),
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements)

		manager.createOrUpdateLabelForTest("frame-1")

		expect(manager.getTextNodeForTest("frame-1")?.text()).toBe("画框")
		expect(manager.getSuffixNodeForTest("frame-1")?.text()).toBe(" (2)")
		expect(manager.getSuffixBackgroundForTest("frame-1")).toBeNull()

		manager.destroy()
	})

	it("reveals the rename icon as a button only while hovering its hit area", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			canRename: true,
			selectedElementId: "image-1",
		})
		manager.createOrUpdateLabelForTest("image-1")

		const text = manager.getTextNodeForTest("image-1")
		const renameHit = manager.getRenameHitNodeForTest("image-1")
		const renameIcon = manager.getRenameIconNodeForTest("image-1")
		const renderedTextWidth = text?.textArr.reduce(
			(maxWidth, line) => Math.max(maxWidth, line.width),
			0,
		)
		expect(renameHit?.x()).toBe((text?.x() ?? 0) + (renderedTextWidth ?? 0) + 4)
		expect(renameHit?.fill()).toBe("rgba(0, 0, 0, 0.001)")
		expect(renameIcon?.visible()).toBe(false)

		renameHit?.fire("mouseenter")
		expect(renameHit?.fill()).toBe("#F2F2F2")
		expect(renameIcon?.visible()).toBe(true)

		renameHit?.fire("mouseleave")
		expect(renameHit?.fill()).toBe("rgba(0, 0, 0, 0.001)")
		expect(renameIcon?.visible()).toBe(false)

		manager.destroy()
	})

	it("reveals the rename icon while hovering the canvas element", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { canRename: true })
		manager.createOrUpdateLabelForTest("image-1")

		const canvas = manager.getCanvasForTest()
		const renameHit = manager.getRenameHitNodeForTest("image-1")
		const renameIcon = manager.getRenameIconNodeForTest("image-1")
		expect(renameIcon?.visible()).toBe(false)

		canvas.eventEmitter.emit({
			type: "element:hover",
			data: { elementId: "image-1" },
		})
		expect(renameIcon?.visible()).toBe(true)
		expect(renameHit?.fill()).toBe("rgba(0, 0, 0, 0.001)")

		canvas.eventEmitter.emit({
			type: "element:hover",
			data: { elementId: null },
		})
		expect(renameIcon?.visible()).toBe(false)

		manager.destroy()
	})

	it("renders a Konva compliance hit area without a DOM overlay", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: 200, height: 80 }),
					getData: () =>
						({
							id: "image-1",
							type: ElementTypeEnum.Image,
							activeContentId: "content-1",
							contents: [
								{
									contentId: "content-1",
									complianceStatus: "FAILED",
									complianceFailedReason: "素材审核未通过",
								},
							],
						}) as never,
					getNameLabelText: () => "Image name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			iconResolver: ({ complianceStatus }) =>
				complianceStatus === "FAILED"
					? {
							key: "failure",
							width: 16,
							height: 16,
							create: () => new Konva.Rect({ width: 16, height: 16 }),
						}
					: null,
		})

		manager.createOrUpdateLabelForTest("image-1")

		expect(manager.getComplianceHitNodeForTest("image-1")).toBeInstanceOf(Konva.Rect)
		expect(manager.getComplianceHitNodeForTest("image-1")?.width()).toBe(16)
		expect(manager.getComplianceHitNodeForTest("image-1")?.height()).toBe(16)

		manager.destroy()
	})

	it("refreshes an existing media label immediately when the setting changes", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 100, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image 1",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements)

		expect(manager.createOrUpdateLabelForTest("image-1")).toBe(true)
		expect(manager.isLabelVisible("image-1")).toBe(true)

		manager.setMediaLabelsAlwaysVisible(false)

		expect(manager.hasLabel("image-1")).toBe(false)
		manager.destroy()
	})

	it("shares one media layout between name and size updates in a transaction", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image 1",
					getSizeLabelText: () => "160 x 80",
					getNode: () => ({}),
					supportsSizeEditing: () => true,
				},
			],
		])
		const manager = createManager(elements)
		const canvas = manager.getCanvasForTest()
		const queryElementIdsByExpandedRect = vi.fn(() => ["image-1"])
		canvas.geometryCacheManager.queryElementIdsByExpandedRect = queryElementIdsByExpandedRect
		const sizeManager = new TestSizeLabelManager({ canvas })
		canvas.nameLabelManager = manager
		canvas.sizeLabelManager = sizeManager

		manager.createOrUpdateLabelForTest("image-1")
		sizeManager.createForTest("image-1")
		queryElementIdsByExpandedRect.mockClear()
		invalidateMediaLabelLayouts(canvas, ["image-1"])

		const context = BaseLabelManager.createLabelLayoutSyncContext()
		manager.updateLabelPositionWithContextForTest("image-1", context)
		sizeManager.updateLabelPositionWithContextForTest("image-1", context)

		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(1)

		sizeManager.destroy()
		manager.destroy()
	})

	it("keeps the shared screen scale at tiny viewport scales", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 40, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image 1",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { viewportScale: 0.1 })

		manager.createOrUpdateLabelForTest("image-1")

		expect(manager.getLabelScale("image-1")).toBeCloseTo(10)
		expect(manager.getLabelScale("image-1")).toBeGreaterThan(0)
		manager.destroy()
	})

	it("keeps short names at the shared font size and ellipsizes long names", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 40, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "A very long generated image title",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements)

		manager.createOrUpdateLabelForTest("image-1")
		const metrics = manager.getLabelTextMetrics("image-1")

		expect(metrics).not.toBeNull()
		expect(metrics?.ellipsis).toBe(true)
		expect(metrics?.width).toBeLessThanOrEqual(40)
		manager.destroy()
	})

	it("reserves an optional icon slot and resolves it outside layout-only updates", () => {
		const getBoundingRect = vi.fn(() => ({ x: 10, y: 20, width: 100, height: 80 }))
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect,
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "Audio name",
					getNode: () => ({}),
				},
			],
		])
		const iconResolver = vi.fn<NameLabelIconResolver>(({ selected }) => ({
			key: selected ? "audio-selected" : "audio-status",
			width: 12,
			height: 12,
			create: () => new Konva.Rect({ width: 12, height: 12 }),
		}))
		const options: { iconResolver?: NameLabelIconResolver; selectedElementId?: string } = {
			iconResolver,
		}
		const manager = createManager(elements, options)

		manager.createOrUpdateLabelForTest("audio-1")
		const initialResolverCalls = iconResolver.mock.calls.length
		const textNode = manager.getTextNodeForTest("audio-1")
		const iconNode = manager.getIconNodeForTest("audio-1")

		expect(iconNode).toBeInstanceOf(Konva.Rect)
		expect(iconNode?.listening()).toBe(false)
		expect(iconNode?.x()).toBe(0)
		expect(textNode?.x()).toBe(14)
		expect(textNode?.width()).toBeLessThanOrEqual(84)

		manager.updateLabelPositionForTest("audio-1")
		expect(iconResolver).toHaveBeenCalledTimes(initialResolverCalls)
		const layoutCallsBeforeStableRefresh = getBoundingRect.mock.calls.length
		manager.refreshIcons(["audio-1"])
		expect(getBoundingRect).toHaveBeenCalledTimes(layoutCallsBeforeStableRefresh)
		expect(iconResolver).toHaveBeenCalledTimes(initialResolverCalls + 1)

		options.selectedElementId = "audio-1"
		manager.refreshIcons(["audio-1"])
		expect(iconResolver).toHaveBeenLastCalledWith(
			expect.objectContaining({ selected: true, elementId: "audio-1" }),
		)

		manager.destroy()
	})

	it("starts rename from the Konva pencil hit area", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "Image name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			canRename: true,
			selectedElementId: "image-1",
		})
		manager.createOrUpdateLabelForTest("image-1")

		const renameHit = manager.getRenameHitNodeForTest("image-1")
		expect(renameHit).toBeInstanceOf(Konva.Rect)
		expect(renameHit?.zIndex()).toBeGreaterThan(
			manager.getLabelHitNodeForTest("image-1")?.zIndex() ?? -1,
		)
		renameHit?.fire("click")

		expect(
			manager.getCanvasForTest().elementRenameManager.startRename as ReturnType<typeof vi.fn>,
		).toHaveBeenCalledWith("image-1")

		manager.destroy()
	})

	it("anchors the rename button to the rendered ellipsis width", () => {
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 100, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => "A deliberately long image title",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			canRename: true,
			selectedElementId: "image-1",
		})

		manager.createOrUpdateLabelForTest("image-1")

		const textNode = manager.getTextNodeForTest("image-1")
		const renameHit = manager.getRenameHitNodeForTest("image-1")
		const renderedTextWidth = textNode?.textArr.reduce(
			(maxWidth, line) => Math.max(maxWidth, line.width),
			0,
		)

		expect(textNode?.textArr[0]?.text.endsWith("…")).toBe(true)
		expect(renderedTextWidth).toBeLessThan(textNode?.width() ?? 0)
		expect(renameHit?.x()).toBe((textNode?.x() ?? 0) + (renderedTextWidth ?? 0) + 4)
		// The button must not inherit the unused tail of the constrained text box.
		expect(renameHit?.x()).toBeLessThan((textNode?.x() ?? 0) + (textNode?.width() ?? 0) + 4)
		const labelSize = manager.getLabelSizeForElement("image-1")
		expect(labelSize?.width).toBe(
			(textNode?.x() ?? 0) + (renderedTextWidth ?? 0) + 4 + (renameHit?.width() ?? 0),
		)
		expect(labelSize?.width).toBeLessThan(
			(textNode?.x() ?? 0) + (textNode?.width() ?? 0) + 4 + (renameHit?.width() ?? 0),
		)

		manager.destroy()
	})

	it.each([
		ElementTypeEnum.Video,
		ElementTypeEnum.Audio,
		ElementTypeEnum.Frame,
		ElementTypeEnum.Storyboard,
		ElementTypeEnum.VideoEdit,
		ElementTypeEnum.Group,
		ElementTypeEnum.Text,
		ElementTypeEnum.Rectangle,
		ElementTypeEnum.Ellipse,
		ElementTypeEnum.Triangle,
		ElementTypeEnum.Star,
	])("uses the menu rename capability for %s labels", (type) => {
		const elementId = `${type}-1`
		const elements = new Map<string, TestElement>([
			[
				elementId,
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: elementId, type }),
					getNameLabelText: () => `${type} name`,
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			selectedElementId: elementId,
		})

		manager.createOrUpdateLabelForTest(elementId)

		expect(manager.getRenameHitNodeForTest(elementId)).toBeInstanceOf(Konva.Rect)
		manager.destroy()
	})

	it("keeps the rename action when a narrow element cannot fit the full label", () => {
		const elements = new Map<string, TestElement>([
			[
				"rectangle-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 10, height: 80 }),
					getData: () => ({ id: "rectangle-1", type: ElementTypeEnum.Rectangle }),
					getNameLabelText: () => "A long rectangle name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, {
			canRename: true,
			selectedElementId: "rectangle-1",
		})

		manager.createOrUpdateLabelForTest("rectangle-1")

		expect(manager.isLabelVisible("rectangle-1")).toBe(true)
		expect(manager.getRenameHitNodeForTest("rectangle-1")).toBeInstanceOf(Konva.Rect)
		manager.destroy()
	})

	it("does not render the rename action when the shared rename capability is denied", () => {
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 160, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "Audio name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { canRename: false })

		manager.createOrUpdateLabelForTest("audio-1")

		expect(manager.getRenameHitNodeForTest("audio-1")).toBeUndefined()
		manager.destroy()
	})

	it("suppresses the size label when it would truncate the name", () => {
		const sizeLabelManager = {
			isLabelVisibleForElement: vi.fn(() => true),
			refreshVisibilityForNamePriority: vi.fn(() => true),
			getLabelSizeForElement: vi.fn(() => ({ width: 30, height: 12 })),
		}
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: 100, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "A deliberately long audio name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { sizeLabelManager })

		manager.createOrUpdateLabelForTest("audio-1")
		expect(manager.shouldSuppressSizeLabelForTest("audio-1")).toBe(true)
		expect(sizeLabelManager.refreshVisibilityForNamePriority).toHaveBeenCalledWith(
			"audio-1",
			true,
		)
		expect(manager.getRenderedTextWidthForTest("audio-1")).toBeLessThan(
			manager.getTextNodeForTest("audio-1")?.width() ?? 0,
		)
		expect(manager.getTextNodeForTest("audio-1")?.textArr[0]?.text.endsWith("…")).toBe(true)

		manager.destroy()
	})

	it("includes the complete suffix when deciding whether size must yield", () => {
		const sizeLabelManager = {
			isLabelVisibleForElement: vi.fn(() => true),
			getLabelSizeForElement: vi.fn(() => ({ width: 30, height: 12 })),
		}
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelContent: () => ({
						primaryText: "Long name",
						suffix: { text: "(生成中)" },
					}),
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { sizeLabelManager })

		manager.createOrUpdateLabelForTest("audio-1")
		expect(manager.shouldSuppressSizeLabelForTest("audio-1")).toBe(true)
		expect(manager.getSuffixNodeForTest("audio-1")?.text()).toBe("(生成中)")

		manager.destroy()
	})

	it("restores the size label decision after the full name fits beside it", () => {
		let elementWidth = 100
		const sizeLabelManager = {
			isLabelVisibleForElement: vi.fn(() => true),
			getLabelSizeForElement: vi.fn(() => ({ width: 30, height: 12 })),
		}
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: elementWidth, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "Long name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { sizeLabelManager })

		manager.createOrUpdateLabelForTest("audio-1")
		expect(manager.shouldSuppressSizeLabelForTest("audio-1")).toBe(true)

		elementWidth = 136
		manager.updateLabelPositionForTest("audio-1")
		expect(manager.shouldSuppressSizeLabelForTest("audio-1")).toBe(false)
		expect(manager.getRenderedTextWidthForTest("audio-1")).toBe(72)

		manager.destroy()
	})

	it("does not suppress size when it is independently hidden", () => {
		const sizeLabelManager = {
			isLabelVisibleForElement: vi.fn(() => false),
			getLabelSizeForElement: vi.fn(() => ({ width: 30, height: 12 })),
		}
		const elements = new Map<string, TestElement>([
			[
				"audio-1",
				{
					getBoundingRect: () => ({ x: 10, y: 20, width: 100, height: 80 }),
					getData: () => ({ id: "audio-1", type: ElementTypeEnum.Audio }),
					getNameLabelText: () => "A deliberately long audio name",
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, { sizeLabelManager })

		manager.createOrUpdateLabelForTest("audio-1")
		expect(manager.shouldSuppressSizeLabelForTest("audio-1")).toBe(false)
		expect(manager.getRenderedTextWidthForTest("audio-1")).toBeLessThan(
			manager.getTextNodeForTest("audio-1")?.width() ?? 0,
		)

		manager.destroy()
	})

	it("restores the available title width after zooming out and back in", () => {
		let width = 320
		let title = "A long title that must expand again"
		const options = { viewportScale: 1 }
		const elements = new Map<string, TestElement>([
			[
				"image-1",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width, height: 80 }),
					getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
					getNameLabelText: () => title,
					getNode: () => ({}),
				},
			],
		])
		const manager = createManager(elements, options)
		manager.createOrUpdateLabelForTest("image-1")
		const fullWidth = manager.getLabelTextMetrics("image-1")?.width
		options.viewportScale = 0.15
		manager.createOrUpdateLabelForTest("image-1")
		expect(manager.getLabelTextMetrics("image-1")?.width).toBeLessThan(fullWidth ?? 0)
		options.viewportScale = 1
		manager.createOrUpdateLabelForTest("image-1")
		expect(manager.getLabelTextMetrics("image-1")?.width).toBe(fullWidth)
		for (let i = 0; i < 8; i++) manager.createOrUpdateLabelForTest("image-1")
		expect(manager.getLabelTextMetrics("image-1")?.width).toBe(fullWidth)
		width = 80
		manager.createOrUpdateLabelForTest("image-1")
		title = "Changed title"
		width = 320
		manager.createOrUpdateLabelForTest("image-1")
		expect(manager.getLabelTextMetrics("image-1")?.width).toBe(title.length * 8)
		manager.destroy()
	})

	it("hides covered labels and restores them after moving, hiding or lowering the upper image", () => {
		let x = 0
		let zIndex = 2
		let visible = true
		const options = { candidateIds: ["upper"], parents: new Map<string, string>() }
		const elements = new Map<string, TestElement>([
			[
				"lower",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: 320, height: 80 }),
					getData: () => ({ id: "lower", type: ElementTypeEnum.Image, zIndex: 1 }),
					getNameLabelText: () => "Lower image",
					getNode: () => ({}),
				},
			],
			[
				"upper",
				{
					getBoundingRect: () => ({ x, y: 0, width: 320, height: 80 }),
					getData: () => ({ id: "upper", type: ElementTypeEnum.Image, zIndex }),
					getNode: () => ({ isVisible: () => visible, getAbsoluteOpacity: () => 1 }),
				},
			],
		])
		const manager = createManager(elements, options)
		manager.createOrUpdateLabelForTest("lower")
		expect(manager.isLabelVisible("lower")).toBe(false)
		x = 500
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(true)
		x = 0
		visible = false
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(true)
		visible = true
		zIndex = 0
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(true)
		zIndex = 2
		options.parents.set("upper", "other-frame")
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(true)
		options.parents.clear()
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(false)
		elements.delete("upper")
		manager.refreshVisibility()
		expect(manager.isLabelVisible("lower")).toBe(true)
		manager.destroy()
	})
	it("prioritizes the title, hides both labels when covered, and restores size after growth", () => {
		let upperX = 500
		let lowerWidth = 320
		const title = "A long image title that needs enough available space"
		const options = { candidateIds: ["upper"], viewportScale: 1 }
		const elements = new Map<string, TestElement>([
			[
				"lower",
				{
					getBoundingRect: () => ({ x: 0, y: 20, width: lowerWidth, height: 80 }),
					getData: () => ({ id: "lower", type: ElementTypeEnum.Image, zIndex: 1 }),
					getNameLabelText: () => title,
					getSizeLabelText: () => "2560 x 1440",
					supportsSizeEditing: () => true,
					getNode: () => ({}),
				},
			],
			[
				"upper",
				{
					getBoundingRect: () => ({ x: upperX, y: 0, width: 100, height: 80 }),
					getData: () => ({ id: "upper", type: ElementTypeEnum.Image, zIndex: 2 }),
					getNode: () => ({ isVisible: () => true, getAbsoluteOpacity: () => 1 }),
				},
			],
		])
		const name = createManager(elements, options)
		const canvas = name.getCanvasForTest()
		const size = new TestSizeLabelManager({ canvas })
		canvas.nameLabelManager = name
		canvas.sizeLabelManager = size
		size.setMediaLabelsAlwaysVisible(true)
		name.createOrUpdateLabelForTest("lower")
		size.createForTest("lower")
		// The resolution yields first; the remaining 28px includes the rename gap and button.
		expect(name.getLabelTextMetrics("lower")?.width).toBe(292)
		expect(size.visibleForTest("lower")).toBe(false)
		options.viewportScale = 0.25
		name.createOrUpdateLabelForTest("lower")
		size.createForTest("lower")
		options.viewportScale = 1
		name.createOrUpdateLabelForTest("lower")
		size.createForTest("lower")
		expect(name.getLabelTextMetrics("lower")?.width).toBe(292)
		expect(size.visibleForTest("lower")).toBe(false)
		upperX = 260
		name.refreshVisibility()
		size.refreshForTest()
		expect(name.isLabelVisible("lower")).toBe(false)
		expect(size.visibleForTest("lower")).toBe(false)
		upperX = 500
		name.refreshVisibility()
		size.refreshForTest()
		expect(name.isLabelVisible("lower")).toBe(true)
		expect(size.visibleForTest("lower")).toBe(false)
		lowerWidth = 600
		name.createOrUpdateLabelForTest("lower")
		size.refreshForTest()
		expect(size.visibleForTest("lower")).toBe(true)
		name.destroy()
		size.destroy()
	})
})
