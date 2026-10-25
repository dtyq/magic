import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NameLabelTooltipController } from "../NameLabelTooltipController"

const hosts: HTMLDivElement[] = []

function createController() {
	const host = document.createElement("div")
	host.style.position = "relative"
	Object.defineProperties(host, {
		clientWidth: { configurable: true, value: 800 },
		clientHeight: { configurable: true, value: 600 },
	})
	const stageHost = document.createElement("div")
	Object.defineProperties(stageHost, {
		clientWidth: { configurable: true, value: 800 },
		clientHeight: { configurable: true, value: 600 },
	})
	host.appendChild(stageHost)
	document.body.appendChild(host)
	hosts.push(host)

	const runtimeScheduler = { requestLayerDraw: vi.fn() }
	const canvas = {
		container: stageHost,
		runtimeScheduler,
		stage: {
			container: () => stageHost,
			width: () => 800,
			height: () => 600,
		},
	} as never

	return {
		controller: new NameLabelTooltipController(canvas),
		host,
		stageHost,
		runtimeScheduler,
	}
}

function getTooltip(host: HTMLDivElement): HTMLDivElement {
	return host.querySelector("[data-name-label-tooltip]") as HTMLDivElement
}

describe("NameLabelTooltipController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		for (const host of hosts.splice(0)) host.remove()
	})

	it("mounts one DOM tooltip only after the hover delay", () => {
		const { controller, host, runtimeScheduler } = createController()
		const tooltip = getTooltip(host)

		controller.schedule(
			{ key: "image-1", title: "文件名", text: "a-very-long-file-name.png" },
			{ x: 120, y: 160, width: 40, height: 16 },
		)

		expect(host.querySelectorAll("[data-name-label-tooltip]")).toHaveLength(1)
		expect(tooltip.style.display).toBe("none")
		expect(tooltip.parentElement).toBe(host)
		expect(tooltip.style.zIndex).toBe("4")

		vi.advanceTimersByTime(699)
		expect(controller.isVisible()).toBe(false)

		vi.advanceTimersByTime(1)

		expect(controller.isVisible()).toBe(true)
		expect(tooltip.style.display).toBe("block")
		expect(tooltip.getAttribute("aria-hidden")).toBe("false")
		expect(tooltip.querySelector(".canvas-design-name-label-tooltip-title")?.textContent).toBe(
			"文件名",
		)
		expect(tooltip.querySelector(".canvas-design-name-label-tooltip-text")?.textContent).toBe(
			"a-very-long-file-name.png",
		)
		expect(runtimeScheduler.requestLayerDraw).not.toHaveBeenCalled()

		controller.destroy()
		expect(host.querySelector("[data-name-label-tooltip]")).toBeNull()
	})

	it("replaces stale content without creating another DOM node", () => {
		const { controller, host } = createController()
		const tooltip = getTooltip(host)

		controller.schedule(
			{ key: "image-1", text: "old.png" },
			{ x: 40, y: 60, width: 20, height: 12 },
		)
		vi.advanceTimersByTime(700)
		expect(tooltip.textContent).toContain("old.png")

		controller.schedule(
			{ key: "image-2", text: "new.png" },
			{ x: 100, y: 160, width: 20, height: 12 },
		)
		expect(controller.isVisible()).toBe(false)
		vi.advanceTimersByTime(700)

		expect(host.querySelectorAll("[data-name-label-tooltip]")).toHaveLength(1)
		expect(tooltip.textContent).toContain("new.png")
		controller.destroy()
	})

	it("positions the DOM tooltip relative to the stage container", () => {
		const { controller, host, stageHost } = createController()
		const tooltip = getTooltip(host)
		vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
			top: 0,
			right: 800,
			bottom: 600,
			left: 0,
			toJSON: () => ({}),
		} as DOMRect)
		vi.spyOn(stageHost, "getBoundingClientRect").mockReturnValue({
			x: 20,
			y: 30,
			width: 800,
			height: 600,
			top: 30,
			right: 820,
			bottom: 630,
			left: 20,
			toJSON: () => ({}),
		} as DOMRect)
		vi.spyOn(tooltip, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			width: 120,
			height: 40,
			top: 0,
			right: 120,
			bottom: 40,
			left: 0,
			toJSON: () => ({}),
		} as DOMRect)

		controller.schedule(
			{ key: "image-1", text: "file.png" },
			{ x: 120, y: 160, width: 40, height: 16 },
		)
		vi.advanceTimersByTime(700)

		expect(tooltip.style.left).toBe("140px")
		expect(tooltip.style.top).toBe("141px")
		controller.destroy()
	})

	it("cancels pending content and hides the DOM node", () => {
		const { controller, host } = createController()
		const tooltip = getTooltip(host)

		controller.schedule(
			{ key: "image-1", text: "file.png" },
			{ x: 40, y: 60, width: 20, height: 12 },
		)

		expect(controller.hide()).toBe(true)
		vi.advanceTimersByTime(700)

		expect(controller.isVisible()).toBe(false)
		expect(tooltip.style.display).toBe("none")
		expect(tooltip.getAttribute("aria-hidden")).toBe("true")
		controller.destroy()
	})
})
