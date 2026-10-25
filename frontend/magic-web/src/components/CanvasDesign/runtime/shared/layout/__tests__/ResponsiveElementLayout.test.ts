import { describe, expect, it } from "vitest"
import { ELEMENT_DESIGN_TOKENS } from "../ElementDesignTokens"
import { resolveResponsiveElementLayout } from "../ResponsiveElementLayout"

const SPEC = {
	designSize: { width: 1280, height: 720 },
	baseRem: 16,
	scale: {
		strategy: { type: "weighted" as const, inlineWeight: 0.25 },
		min: 0.6,
		max: 1.35,
	},
	mode: { compactBelow: 0.8, condensedBelow: 0.5 },
}

describe("ResponsiveElementLayout", () => {
	it("resolves element rem values without using viewport scale", () => {
		const layout = resolveResponsiveElementLayout({ width: 1280, height: 720 }, SPEC)

		expect(layout.scale).toBe(1)
		expect(layout.remSize).toBe(16)
		expect(layout.rem(4)).toBe(64)
		expect(layout.designPx(224)).toBe(224)
		expect(layout.mode).toBe("regular")
	})

	it("exposes shared design tokens scaled with the element", () => {
		const layout = resolveResponsiveElementLayout({ width: 1280, height: 720 }, SPEC)

		expect(layout.design.pad.sectionInline).toBe(ELEMENT_DESIGN_TOKENS.pad.sectionInline)
		expect(layout.design.gap.content).toBe(ELEMENT_DESIGN_TOKENS.gap.content)
		expect(layout.design.type).toEqual(ELEMENT_DESIGN_TOKENS.type)
		expect(layout.design.space.lg).toBe(24)
		expect(layout.design.minType(10, "caption")).toBe(28)
		expect(layout.design.minType(32, "caption")).toBe(32)
		expect(layout.design.minType(10, "display")).toBe(48)
	})

	it("scales shared design tokens with the element root scale", () => {
		const layout = resolveResponsiveElementLayout({ width: 640, height: 720 }, SPEC)

		expect(layout.design.type.title).toBeCloseTo(
			ELEMENT_DESIGN_TOKENS.type.title * layout.scale,
		)
		expect(layout.design.pad.sectionInline).toBeCloseTo(
			ELEMENT_DESIGN_TOKENS.pad.sectionInline * layout.scale,
		)
	})

	it("uses one weighted scale so width-only changes cannot deform controls", () => {
		const layout = resolveResponsiveElementLayout({ width: 640, height: 720 }, SPEC)

		expect(layout.scale).toBeCloseTo(Math.pow(0.5, 0.25))
		expect(layout.rem(4) / layout.rem(1)).toBe(4)
		expect(layout.mode).toBe("regular")
	})

	it("clamps readable root scale but lets an indivisible region fit below it", () => {
		const layout = resolveResponsiveElementLayout({ width: 240, height: 120 }, SPEC)
		const fit = layout.fitUniform(
			{ width: 232, height: 114 },
			{ x: 20, y: 0, width: 100, height: 50 },
			{ block: "end" },
		)

		expect(layout.scale).toBe(0.6)
		expect(layout.mode).toBe("condensed")
		expect(fit.scale).toBeLessThan(layout.scale)
		expect(fit.rect.x).toBeGreaterThanOrEqual(20)
		expect(fit.rect.y + fit.rect.height).toBeCloseTo(50)
		expect(fit.rect.width).toBeLessThanOrEqual(100)
		expect(fit.rect.height).toBeLessThanOrEqual(50)
	})

	it("aligns and constrains responsive regions inside the element", () => {
		const layout = resolveResponsiveElementLayout({ width: 1280, height: 720 }, SPEC)
		const centered = layout.alignRect({ width: 1152, height: 224 }, layout.bounds, {
			inline: "center",
			block: "center",
		})
		const constrained = layout.constrainRect(centered, {
			x: 64,
			y: 32,
			width: 1152,
			height: 494,
		})

		expect(centered).toEqual({ x: 64, y: 248, width: 1152, height: 224 })
		expect(constrained).toEqual(centered)
	})
})
