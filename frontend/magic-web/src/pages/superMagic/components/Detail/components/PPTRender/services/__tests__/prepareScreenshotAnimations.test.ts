import { afterEach, describe, expect, it, vi } from "vitest"
import { prepareScreenshotAnimations } from "../prepareScreenshotAnimations"

afterEach(() => {
	vi.restoreAllMocks()
	Reflect.deleteProperty(document, "getAnimations")
	Reflect.deleteProperty(window, "gsap")
	document.body.innerHTML = ""
})

function createSlide() {
	document.body.innerHTML = "<main><h1>Speaker introduction</h1></main>"
	const target = document.querySelector("main")
	if (!target) throw new Error("Missing slide")
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		top: 0,
		right: 400,
		bottom: 200,
		left: 0,
		toJSON: () => ({}),
	})
	return target
}

function animation(endTime: number, duration = 1000) {
	return {
		effect: {
			getComputedTiming: () => ({ endTime, duration, delay: 500 }),
			updateTiming: vi.fn(),
		},
		pause: vi.fn(),
		commitStyles: vi.fn(),
		currentTime: 0,
	} as unknown as Animation
}

describe("prepareScreenshotAnimations", () => {
	it("does not delay static visible content", async () => {
		const target = createSlide()
		const wait = vi.fn()
		await prepareScreenshotAnimations(document, target, new AbortController().signal, wait)
		expect(wait).not.toHaveBeenCalled()
	})

	it("retains the filled final frame of delayed finite animations", async () => {
		const target = createSlide()
		const enter = animation(1500)
		Object.defineProperty(document, "getAnimations", {
			configurable: true,
			value: vi.fn(() => [enter]),
		})
		await prepareScreenshotAnimations(document, target, new AbortController().signal, vi.fn())
		expect(enter.effect?.updateTiming).toHaveBeenCalledWith({ fill: "both" })
		expect(enter.currentTime).toBe(1500)
		expect(enter.pause).toHaveBeenCalledOnce()
		expect(enter.commitStyles).toHaveBeenCalledOnce()
	})

	it("samples infinite animations without awaiting their finished promise", async () => {
		const target = createSlide()
		const loop = animation(Infinity)
		Object.defineProperty(document, "getAnimations", {
			configurable: true,
			value: () => [loop],
		})
		await prepareScreenshotAnimations(document, target, new AbortController().signal, vi.fn())
		expect(loop.currentTime).toBe(1000)
	})

	it("waits only for the bounded remaining time of running finite effects", async () => {
		const target = createSlide()
		const enter = animation(10000)
		Object.assign(enter, { playState: "running", playbackRate: 2, currentTime: 2000 })
		Object.defineProperty(document, "getAnimations", {
			configurable: true,
			value: () => [enter],
		})
		const wait = vi.fn(async () => undefined)
		await prepareScreenshotAnimations(document, target, new AbortController().signal, wait)
		expect(wait).toHaveBeenCalledOnce()
		expect(wait).toHaveBeenCalledWith(3000, expect.anything())
		expect(enter.currentTime).toBe(10000)
	})

	it("samples GSAP timelines while bounding infinite repeats", async () => {
		const target = createSlide()
		const finite = {
			duration: () => 2,
			totalDuration: () => 5,
			repeat: () => 1,
			pause: vi.fn(),
			totalTime: vi.fn(),
		}
		const infinite = { ...finite, repeat: () => -1, totalTime: vi.fn() }
		Object.defineProperty(window, "gsap", {
			configurable: true,
			value: { globalTimeline: { getChildren: () => [finite, infinite] } },
		})
		await prepareScreenshotAnimations(document, target, new AbortController().signal, vi.fn())
		expect(finite.totalTime).toHaveBeenCalledWith(5, false)
		expect(infinite.totalTime).toHaveBeenCalledWith(1, false)
	})

	it("waits for a script to reveal content hidden by an ancestor", async () => {
		const target = createSlide()
		target.style.opacity = "0"
		const wait = vi.fn(async () => {
			target.style.opacity = "1"
		})
		await prepareScreenshotAnimations(document, target, new AbortController().signal, wait)
		expect(wait).toHaveBeenCalledOnce()
	})

	it("rejects persistently hidden content so it cannot be cached as a successful thumbnail", async () => {
		const target = createSlide()
		target.style.opacity = "0"
		let now = 0
		vi.spyOn(Date, "now").mockImplementation(() => now)
		const wait = vi.fn(async () => {
			now += 1000
		})
		await expect(
			prepareScreenshotAnimations(document, target, new AbortController().signal, wait),
		).rejects.toThrow("Slide content stayed hidden")
		expect(wait).toHaveBeenCalledTimes(3)
	})

	it("cancels while waiting for a script reveal", async () => {
		const target = createSlide()
		target.style.opacity = "0"
		const controller = new AbortController()
		const reason = new DOMException("Cancelled", "AbortError")
		await expect(
			prepareScreenshotAnimations(document, target, controller.signal, async () => {
				controller.abort(reason)
			}),
		).rejects.toBe(reason)
	})
})
