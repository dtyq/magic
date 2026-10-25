import { describe, expect, it } from "vitest"
import { APP_MODAL_Z_INDEX, HTML_EDITOR_Z_INDEX, TAILWIND_Z_INDEX_CLASSES } from "../z-index"

describe("HTML editor z-index contract", () => {
	it("keeps selection chrome below the app modal stack", () => {
		expect(HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.CONTEXT_PANEL).toBeLessThan(APP_MODAL_Z_INDEX)
		expect(HTML_EDITOR_Z_INDEX.BASE.SELECTION_OVERLAY_ROOT).toBeLessThan(APP_MODAL_Z_INDEX)
		expect(HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.DROPDOWN).toBeLessThan(APP_MODAL_Z_INDEX)
		expect(HTML_EDITOR_Z_INDEX.FULLSCREEN.CONTAINER).toBeLessThan(
			HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.CONTEXT_PANEL,
		)
	})

	it("keeps Tailwind classes aligned with the numeric stack", () => {
		expect(TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.CONTEXT_PANEL).toBe(
			`!z-[${HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.CONTEXT_PANEL}]`,
		)
		expect(TAILWIND_Z_INDEX_CLASSES.BASE.SELECTION_OVERLAY_ROOT).toBe(
			`z-[${HTML_EDITOR_Z_INDEX.BASE.SELECTION_OVERLAY_ROOT}]`,
		)
		expect(TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS).toBe(
			`z-[${HTML_EDITOR_Z_INDEX.BASE.SLIDE_CANVAS}]`,
		)
	})

	it("keeps the PPT slide canvas above the sidebar", () => {
		expect(HTML_EDITOR_Z_INDEX.BASE.SLIDE_CANVAS).toBeGreaterThan(
			HTML_EDITOR_Z_INDEX.BASE.SIDEBAR,
		)
		expect(HTML_EDITOR_Z_INDEX.BASE.SELECTION_OVERLAY_ROOT).toBeGreaterThan(
			HTML_EDITOR_Z_INDEX.BASE.SIDEBAR,
		)
	})

	it("keeps the sidebar resize strip below the slide canvas", () => {
		expect(HTML_EDITOR_Z_INDEX.BASE.SIDEBAR_RESIZE).toBeGreaterThanOrEqual(
			HTML_EDITOR_Z_INDEX.BASE.SIDEBAR,
		)
		expect(HTML_EDITOR_Z_INDEX.BASE.SIDEBAR_RESIZE).toBeLessThan(
			HTML_EDITOR_Z_INDEX.BASE.SLIDE_CANVAS,
		)
		expect(TAILWIND_Z_INDEX_CLASSES.BASE.SIDEBAR_RESIZE).toBe(
			`z-[${HTML_EDITOR_Z_INDEX.BASE.SIDEBAR_RESIZE}]`,
		)
	})
})
