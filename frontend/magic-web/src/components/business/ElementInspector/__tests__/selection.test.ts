import { afterEach, describe, expect, it, vi } from "vitest"
import {
	buildHtmlMultiSelectionRequest,
	createHtmlElementCaptureId,
	createHtmlSelectionTarget,
	getHtmlScreenshotFileName,
	getHtmlSelectionTargetRect,
	upsertHtmlSelectionTarget,
} from "../selection"
import type { InspectedElementInfo } from "../types"

function createInfo(overrides: Partial<InspectedElementInfo> = {}): InspectedElementInfo {
	return {
		selector: "#hero",
		tagName: "section",
		id: "hero",
		classList: ["hero"],
		rect: { top: 10, left: 20, width: 300, height: 120 },
		margin: { top: 0, right: 0, bottom: 0, left: 0 },
		padding: { top: 8, right: 8, bottom: 8, left: 8 },
		border: { top: 0, right: 0, bottom: 0, left: 0 },
		computedStyles: {},
		attributes: { "data-token": "should-not-be-forwarded" },
		textContent: "Hero content",
		...overrides,
	}
}

describe("createHtmlElementCaptureId", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps the selector and a random uuid, not a timestamp or local sequence", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_725_000_000_000)

		const captureId = createHtmlElementCaptureId("#hero")

		expect(captureId).toMatch(
			/^element:#hero:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		)
		expect(captureId).not.toContain("1725000000000")
	})

	it("does not collide for the same selector at the same millisecond", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_725_000_000_000)

		const first = createHtmlElementCaptureId("#hero")
		const second = createHtmlElementCaptureId("#hero")

		expect(first).not.toBe(second)
	})
})

describe("HTML multi-selection payload", () => {
	it("keeps generated screenshot filenames short and deterministic", () => {
		const selector = `section.${"very-long-class-name-".repeat(40)}`
		const fileName = getHtmlScreenshotFileName(selector)

		expect(fileName).toBe(getHtmlScreenshotFileName(selector))
		expect(fileName).toMatch(/^html-screenshot-[0-9a-f]{8}\.png$/)
		expect(fileName.length).toBeLessThanOrEqual(255)
	})

	it("marks element targets explicitly and serializes screenshot targets", () => {
		const elementTarget = createHtmlSelectionTarget(createInfo(), "Update the title")
		const screenshotTarget = {
			id: "screenshot:1",
			kind: "screenshot" as const,
			screenshot: {
				dataUrl: "data:image/png;base64,abc",
				rect: { left: 4, top: 8, width: 120, height: 80 },
			},
			instruction: "Match this visual spacing",
		}

		expect(elementTarget.kind).toBe("element")
		expect(
			buildHtmlMultiSelectionRequest("file-1", [elementTarget, screenshotTarget], ""),
		).toEqual({
			fileId: "file-1",
			instruction: "",
			targets: [
				{
					id: "#hero",
					kind: "element",
					selector: "#hero",
					elementLabel: "section#hero",
					textContent: "Hero content",
					domContext: undefined,
					elementHtml: undefined,
					instruction: "Update the title",
				},
				{
					id: "screenshot:1",
					kind: "screenshot",
					selector: "",
					elementLabel: "Screenshot",
					screenshot: screenshotTarget.screenshot,
					instruction: "Match this visual spacing",
				},
			],
		})
	})

	it("updates an existing selector instead of adding a duplicate target", () => {
		const first = createHtmlSelectionTarget(createInfo(), "Make the heading larger")
		const updated = createHtmlSelectionTarget(createInfo(), "Use a darker background")

		expect(upsertHtmlSelectionTarget([first], updated)).toEqual([updated])
	})

	it("keeps an element screenshot in the structured request", () => {
		const target = createHtmlSelectionTarget(createInfo(), "Match this visual")
		target.screenshot = {
			dataUrl: "data:image/png;base64,abc",
			rect: { left: 20, top: 10, width: 300, height: 120 },
		}

		expect(buildHtmlMultiSelectionRequest("file-1", [target], "").targets[0]).toMatchObject({
			kind: "element",
			id: "#hero",
			screenshot: {
				dataUrl: "data:image/png;base64,abc",
			},
		})
	})

	it("moves screenshot targets with iframe document scrolling", () => {
		const target = {
			id: "screenshot:1",
			kind: "screenshot" as const,
			screenshot: {
				dataUrl: "data:image/png;base64,abc",
				rect: { left: 40, top: 80, width: 240, height: 120 },
				documentRect: { left: 40, top: 780, width: 240, height: 120 },
			},
			instruction: "Keep this area",
		}

		expect(getHtmlSelectionTargetRect(target, { left: 0, top: 700 })).toEqual({
			left: 40,
			top: 80,
			width: 240,
			height: 120,
		})
	})

	it("keeps target instructions separate and bounds large text fragments", () => {
		const longText = "x".repeat(400)
		const longHtml = "<section>" + "x".repeat(1500) + "</section>"
		const request = buildHtmlMultiSelectionRequest(
			"file-1",
			[
				createHtmlSelectionTarget(
					createInfo({ textContent: longText, elementHtml: longHtml }),
					"Change only this section",
				),
			],
			"Keep the existing layout",
		)

		expect(request).toMatchObject({
			fileId: "file-1",
			instruction: "Keep the existing layout",
			targets: [{ selector: "#hero", instruction: "Change only this section" }],
		})
		expect(request.targets[0].textContent).toHaveLength(240)
		expect(request.targets[0].elementHtml).toHaveLength(1200)
		expect(request.targets[0]).not.toHaveProperty("attributes")
	})
})
