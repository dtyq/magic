import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PPTBuildMarkers, PPT_BUILD_MARKERS_ATTRIBUTE } from "../PPTBuildMarkers"
import { PPT_BUILD_ATTRIBUTE, writePPTBuild } from "../../utils/pptBuild"
import { ContentCleaner } from "../../utils/ContentCleaner"

describe("PPTBuildMarkers", () => {
	let markers: PPTBuildMarkers
	let resizeCallback: () => void
	const disconnect = vi.fn()
	const observe = vi.fn()
	beforeEach(() => {
		document.documentElement.removeAttribute("data-magic-source-node")
		document.body.innerHTML = '<p id="a">First</p><p id="b">Second</p><p id="c">Together</p>'
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: () => void) {
					resizeCallback = callback
				}
				disconnect = disconnect
				observe = observe
				unobserve = vi.fn()
			},
		)
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			x: 10,
			y: 20,
			left: 10,
			top: 20,
			right: 110,
			bottom: 70,
			width: 100,
			height: 50,
			toJSON: () => ({}),
		})
		for (const [id, step] of [
			["a", 2],
			["b", 9],
			["c", 9],
		] as const)
			writePPTBuild(document.getElementById(id)!, { step, effect: "appear" })
		markers = new PPTBuildMarkers()
	})
	afterEach(() => {
		markers.destroy()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})
	const host = () => document.querySelector(`[${PPT_BUILD_MARKERS_ATTRIBUTE}]`)!
	const labels = () => [...host().shadowRoot!.children].map((element) => element.textContent)
	const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

	it("compresses numeric steps and never serializes markers into clean HTML", () => {
		markers.setVisible(true)
		expect(labels()).toEqual(["1", "2", "2"])
		expect(host().shadowRoot!.firstElementChild!.getAttribute("style")).toContain("left: 10px")
		const clean = ContentCleaner.cleanDocument(document.documentElement.outerHTML)
		expect(clean).not.toContain(PPT_BUILD_MARKERS_ATTRIBUTE)
		expect(clean).toContain(PPT_BUILD_ATTRIBUTE)
		expect(clean).toContain("First")
	})

	it("reacts to content and resize without re-observing unchanged elements", async () => {
		markers.setVisible(true)
		const count = observe.mock.calls.length
		resizeCallback()
		await nextFrame()
		expect(observe.mock.calls.length).toBe(count)
		document.getElementById("a")!.removeAttribute(PPT_BUILD_ATTRIBUTE)
		await Promise.resolve()
		await nextFrame()
		expect(labels()).toEqual(["1", "1"])
	})

	it("cleans observers and scheduled work on close and page teardown", async () => {
		markers.setVisible(true)
		window.dispatchEvent(new Event("scroll"))
		markers.setVisible(false)
		await nextFrame()
		expect(host()).toBeNull()
		expect(disconnect).toHaveBeenCalled()
		markers.setVisible(true)
		window.dispatchEvent(new Event("pagehide"))
		expect(host()).toBeNull()
	})

	it("keeps an open panel's markers across bfcache suspension", async () => {
		markers.setVisible(true)
		window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
		expect(host()).not.toBeNull()
		document.getElementById("a")!.removeAttribute(PPT_BUILD_ATTRIBUTE)
		window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
		await nextFrame()
		expect(labels()).toEqual(["1", "1"])
	})

	it("can be suspended and resumed without tearing the overlay down", () => {
		markers.setVisible(true)
		const host = () => document.querySelector<HTMLElement>(`[${PPT_BUILD_MARKERS_ATTRIBUTE}]`)!
		markers.setSuspended(true)
		expect(host().style.visibility).toBe("hidden")
		markers.setSuspended(false)
		expect(host().style.visibility).toBe("")
		// A suspension requested before the overlay exists still applies when it appears.
		markers.destroy()
		markers.setSuspended(true)
		markers.setVisible(true)
		expect(host().style.visibility).toBe("hidden")
		markers.setSuspended(false)
	})
})
