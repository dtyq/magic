import Konva from "konva"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type ElementType } from "../../../document/types"
import { SizeLabelManager } from "../SizeLabelManager"

type TestElement = {
	getData: () => { id: string; type: ElementType }
	supportsSizeEditing: () => boolean
	getBoundingRect?: () => { x: number; y: number; width: number; height: number }
}

class TestSizeLabelManager extends SizeLabelManager {
	public static create(
		elements: Map<string, TestElement>,
		nameLabelManager?: { shouldSuppressSizeLabel: (elementId: string) => boolean },
	): TestSizeLabelManager {
		const manager = Object.create(TestSizeLabelManager.prototype) as TestSizeLabelManager
		manager.canvas = {
			cropManager: { getCroppingElementId: () => null },
			elementManager: {
				getElementInstance: (elementId: string) => elements.get(elementId),
			},
			eraserManager: { getErasingElementId: () => null },
			extendManager: { getExtendingElementId: () => null },
			hoverManager: { getHoveredElementId: () => null },
			nameLabelManager,
			selectionManager: { isSelected: () => false },
		} as never
		manager.visibilityConfig = {
			elementTypes: new Set([ElementTypeEnum.Image, ElementTypeEnum.Storyboard]),
			alwaysVisibleTypes: new Set([ElementTypeEnum.Image]),
			hoverOrSelectTypes: new Set(),
		}
		manager.labelMap = new Map()
		return manager
	}

	public shouldShowLabelForTest(elementId: string): boolean {
		return this.shouldShowLabel(elementId)
	}

	public setLabelForTest(elementId: string, labelGroup: Konva.Group): void {
		this.labelMap.set(elementId, labelGroup)
	}

	public getCustomVisibilityForTest(elementId: string): boolean | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) return null
		return this.calculateCustomVisibility(elementId, element, labelGroup, true)
	}
}

describe("SizeLabelManager size editing guard", () => {
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

	it("hides labels for elements that do not support size editing", () => {
		const manager = TestSizeLabelManager.create(
			new Map([
				[
					"storyboard-1",
					{
						getData: () => ({
							id: "storyboard-1",
							type: ElementTypeEnum.Storyboard,
						}),
						supportsSizeEditing: () => false,
					},
				],
				[
					"image-1",
					{
						getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
						supportsSizeEditing: () => true,
					},
				],
			]),
		)

		expect(manager.shouldShowLabelForTest("storyboard-1")).toBe(false)
		expect(manager.shouldShowLabelForTest("image-1")).toBe(true)
	})

	it("hides the complete size label when name label has priority", () => {
		const nameLabelManager = {
			shouldSuppressSizeLabel: () => true,
		}
		const manager = TestSizeLabelManager.create(
			new Map([
				[
					"image-1",
					{
						getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
						supportsSizeEditing: () => true,
						getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
					},
				],
			]),
			nameLabelManager,
		)
		const labelGroup = new Konva.Group({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
		labelGroup.add(new Konva.Text({ text: "100 x 100", width: 50, height: 12 }))
		manager.setLabelForTest("image-1", labelGroup)

		expect(manager.getCustomVisibilityForTest("image-1")).toBe(false)
	})

	it("keeps size label eligible after name-priority suppression", () => {
		const manager = TestSizeLabelManager.create(
			new Map([
				[
					"image-1",
					{
						getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
						supportsSizeEditing: () => true,
						getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
					},
				],
			]),
		)
		const labelGroup = new Konva.Group({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
		labelGroup.add(new Konva.Text({ text: "100 x 100", width: 50, height: 12 }))
		manager.setLabelForTest("image-1", labelGroup)

		expect(manager.isLabelEligibleForNamePriority("image-1")).toBe(true)
	})

	it("hides size label when it cannot fit by itself", () => {
		const manager = TestSizeLabelManager.create(
			new Map([
				[
					"image-1",
					{
						getData: () => ({ id: "image-1", type: ElementTypeEnum.Image }),
						supportsSizeEditing: () => true,
						getBoundingRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
					},
				],
			]),
		)
		const labelGroup = new Konva.Group({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
		labelGroup.add(new Konva.Text({ text: "100 x 100", width: 120, height: 12 }))
		manager.setLabelForTest("image-1", labelGroup)

		expect(manager.getCustomVisibilityForTest("image-1")).toBe(false)
	})
})
