import { describe, expect, it } from "vitest"
import type { LayoutRect } from "../../../shared/layout/ResponsiveElementLayout"
import { STORYBOARD_CONFIG } from "../StoryboardElement.config"
import {
	STORYBOARD_LAYOUT_DESIGN,
	resolveStoryboardElementLayout,
	resolveStoryboardRequiredHeight,
} from "../StoryboardElement.layout"

function expectRectInside(rect: LayoutRect, container: LayoutRect): void {
	expect(rect.x).toBeGreaterThanOrEqual(container.x - 0.0001)
	expect(rect.y).toBeGreaterThanOrEqual(container.y - 0.0001)
	expect(rect.x + rect.width).toBeLessThanOrEqual(container.x + container.width + 0.0001)
	expect(rect.y + rect.height).toBeLessThanOrEqual(container.y + container.height + 0.0001)
}

describe("resolveStoryboardElementLayout", () => {
	it("uses the default size as the regular design scale and keeps shot cards fixed", () => {
		const layout = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			1,
		)
		const [shot] = layout.shotLayouts

		expect(layout.mode).toBe("regular")
		expect(layout.rootScale).toBe(1)
		expect(layout.padding).toBe(32)
		expect(layout.valueFontSize).toBe(28)
		expect(layout.titleFontSize).toBe(28)
		expect(layout.labelFontSize).toBe(28)
		expect(layout.shotFontSize).toBe(28)
		expect(layout.shotSmallFontSize).toBe(28)
		expect(shot?.headerRect.height).toBe(STORYBOARD_LAYOUT_DESIGN.shotHeaderHeight)
		expect(layout.parameterRows.stacked).toBe(false)
		expect(
			layout.parameterRows.aspectRatio.rect.y -
				(layout.parameterRows.model.rect.y + layout.parameterRows.model.rect.height),
		).toBeCloseTo(16)
		expect(layout.visibleShotCount).toBe(1)
		expect(shot?.rect.width).toBe(layout.shotListRect.width)
		expect(shot?.rect.height).toBe(layout.shotMinimumHeight)
		expect(shot?.rect.height).toBeLessThan(layout.shotListRect.height)
		expect(layout.footer.rect.y).toBeGreaterThan(layout.shotListRect.y)
		expect(layout.footer.rect.y + layout.footer.rect.height).toBeCloseTo(
			layout.contentRect.y + layout.contentRect.height,
		)
		const generateAllBottomGap =
			layout.height - (layout.footer.generateAllRect.y + layout.footer.generateAllRect.height)
		const generateAllTopGap =
			layout.footer.generateAllRect.y -
			(layout.footer.addShotRect.y + layout.footer.addShotRect.height)
		expect(generateAllBottomGap).toBeCloseTo(layout.padding)
		expect(generateAllTopGap).toBeCloseTo(layout.padding)
	})

	it("keeps the same shot card height when the list has extra vertical space", () => {
		const twoShots = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			2,
		)
		const fourShots = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			4,
		)

		expect(twoShots.shotLayouts[0]?.rect.height).toBe(fourShots.shotLayouts[0]?.rect.height)
		expect(twoShots.shotLayouts[1]?.rect.height).toBe(fourShots.shotLayouts[1]?.rect.height)
	})

	it("keeps full design gaps in condensed mode and only densifies type/controls", () => {
		const regular = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			1,
		)
		const condensed = resolveStoryboardElementLayout(320, STORYBOARD_CONFIG.DEFAULT_HEIGHT, 1)
		const regularTitleGap =
			regular.shotListRect.y - (regular.titleRect.y + regular.titleRect.height)
		const condensedTitleGap =
			condensed.shotListRect.y - (condensed.titleRect.y + condensed.titleRect.height)

		expect(condensed.mode).toBe("condensed")
		expect(condensedTitleGap / condensed.rootScale).toBeCloseTo(
			regularTitleGap / regular.rootScale,
		)
		expect(condensed.titleFontSize / condensed.rootScale).toBeLessThan(
			regular.titleFontSize / regular.rootScale,
		)
		expect(condensed.parameterRows.model.rect.height / condensed.rootScale).toBeLessThan(
			regular.parameterRows.model.rect.height / regular.rootScale,
		)
	})

	it("switches a narrow element to condensed stacked settings without horizontal overflow", () => {
		const layout = resolveStoryboardElementLayout(320, STORYBOARD_CONFIG.DEFAULT_HEIGHT, 2)

		expect(layout.mode).toBe("condensed")
		expect(layout.parameterRows.stacked).toBe(true)
		expect(layout.parameterRows.model.showLabel).toBe(false)
		expectRectInside(layout.parameterRows.model.rect, layout.contentRect)
		expectRectInside(layout.parameterRows.aspectRatio.rect, layout.contentRect)
		expectRectInside(layout.parameterRows.resolution.rect, layout.contentRect)
		layout.shotLayouts.forEach((shot) => {
			expectRectInside(shot.rect, layout.shotListRect)
			expectRectInside(shot.descriptionRect, shot.rect)
			expectRectInside(shot.controls.generateRect, shot.headerRect)
			expectRectInside(shot.controls.deleteRect, shot.headerRect)
		})
	})

	it("keeps fixed and flexible regions disjoint at the minimum short height", () => {
		const layout = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.MIN_HEIGHT,
			3,
		)

		expect(layout.mode).toBe("condensed")
		expect(layout.shotListRect.height).toBeGreaterThan(0)
		expect(layout.titleRect.y + layout.titleRect.height).toBeLessThanOrEqual(
			layout.shotListRect.y,
		)
		expect(layout.shotListRect.y + layout.shotListRect.height).toBeLessThanOrEqual(
			layout.footer.rect.y,
		)
		expectRectInside(layout.footer.addShotRect, layout.footer.rect)
		expectRectInside(layout.footer.actionsRect, layout.footer.rect)
		expectRectInside(layout.footer.generateAllRect, layout.footer.actionsRect)
	})

	it("uses one uniform scale for indivisible controls instead of separate axis scaling", () => {
		const layout = resolveStoryboardElementLayout(520, 760, 1)
		const controls = layout.shotLayouts[0]?.controls

		expect(controls).toBeTruthy()
		if (!controls) return
		expect(controls.generateRect.width / controls.generateRect.height).toBeCloseTo(
			STORYBOARD_LAYOUT_DESIGN.shotGenerateWidth / STORYBOARD_LAYOUT_DESIGN.shotControlHeight,
		)
		expect(controls.deleteRect.width).toBeCloseTo(controls.deleteRect.height)
		expect(
			layout.footer.generateAllRect.width / layout.footer.generateAllRect.height,
		).toBeCloseTo(
			STORYBOARD_LAYOUT_DESIGN.footerButtonWidth /
				STORYBOARD_LAYOUT_DESIGN.footerButtonHeight,
		)
	})

	it("derives geometry only from logical element dimensions", () => {
		const first = resolveStoryboardElementLayout(1440, 2040, 4)
		const afterViewportZoom = resolveStoryboardElementLayout(1440, 2040, 4)

		expect(afterViewportZoom).toEqual(first)
	})

	it("keeps stale short data clipped safely without rendering an overflow summary", () => {
		const layout = resolveStoryboardElementLayout(720, 760, 20)
		const bounds = { x: 0, y: 0, width: layout.width, height: layout.height }

		expect(layout.visibleShotCount).toBeGreaterThan(0)
		expect(layout.visibleShotCount).toBeLessThan(20)
		expectRectInside(layout.contentRect, bounds)
		expectRectInside(layout.settingsRect, layout.contentRect)
		expectRectInside(layout.shotListRect, layout.contentRect)
		expectRectInside(layout.footer.rect, layout.contentRect)
		layout.shotLayouts.forEach((shot) => expectRectInside(shot.rect, layout.shotListRect))
	})

	it("derives a minimum default height and grows until every shot fits", () => {
		const defaultHeight = resolveStoryboardRequiredHeight(STORYBOARD_CONFIG.DEFAULT_WIDTH, 1)
		const manyShotHeight = resolveStoryboardRequiredHeight(STORYBOARD_CONFIG.DEFAULT_WIDTH, 20)

		expect(defaultHeight).toBe(STORYBOARD_CONFIG.DEFAULT_HEIGHT)
		expect(manyShotHeight).toBeGreaterThan(defaultHeight)
		expect(
			resolveStoryboardElementLayout(STORYBOARD_CONFIG.DEFAULT_WIDTH, manyShotHeight, 20)
				.visibleShotCount,
		).toBe(20)
	})

	it("keeps many reference images in one fixed-height horizontal viewport", () => {
		const withoutReferences = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			1,
		)
		const oneReference = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			1,
			1,
		)
		const manyReferences = resolveStoryboardElementLayout(
			STORYBOARD_CONFIG.DEFAULT_WIDTH,
			STORYBOARD_CONFIG.DEFAULT_HEIGHT,
			1,
			24,
		)

		expect(withoutReferences.reference).toBeUndefined()
		expect(oneReference.reference).toBeDefined()
		expect(manyReferences.reference).toBeDefined()
		expect(manyReferences.reference?.rect.height).toBe(oneReference.reference?.rect.height)
		expect(manyReferences.reference?.viewport.width).toBe(manyReferences.reference?.rect.width)
		expect(manyReferences.reference?.titleCountGap).toBe(
			manyReferences.shotLayouts[0]?.headingGap,
		)
		expect(manyReferences.reference?.thumbnail.width).toBeGreaterThan(0)
		expect(manyReferences.reference?.scrollbar.y).toBeGreaterThan(
			manyReferences.reference?.viewport.y ?? 0,
		)
	})
})
