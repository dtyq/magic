import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTouchPinchZoom } from "../useTouchPinchZoom"
import { usePPTSwipeNavigation } from "@/pages/superMagic/components/Detail/components/PPTRender/hooks/usePPTSwipeNavigation"
import type { PinchPoint } from "../../utils/touch-pinch"

function touch(target: EventTarget, type: string, distance: number, count = 2, center = 400) {
	const event = new Event(type, { cancelable: true })
	Object.defineProperty(event, "touches", {
		value: Array.from({ length: count }, (_, id) => ({
			identifier: id,
			clientX: center + (id - 0.5) * distance,
			clientY: 300,
		})),
	})
	act(() => target.dispatchEvent(event))
	return event
}

function setup() {
	const container = document.createElement("div")
	const iframe = document.createElement("iframe")
	document.body.appendChild(iframe)
	Object.defineProperties(iframe, { clientWidth: { value: 1920 }, clientHeight: { value: 1080 } })
	let visualScale = 0.5
	vi.spyOn(iframe, "getBoundingClientRect").mockImplementation(
		() =>
			({
				left: 20,
				top: 40,
				width: 1920 * visualScale,
				height: 1080 * visualScale,
			}) as DOMRect,
	)
	const frameWindow = iframe.contentWindow
	if (!frameWindow) throw new Error("Missing iframe window")
	const onScaleChange = vi.fn()
	const config = {
		containerRef: { current: container },
		iframeRef: { current: iframe },
		enabled: true,
		iframeReady: true,
		scale: 0.5,
		onScaleChange,
	}
	return {
		container,
		iframe,
		frameWindow,
		onScaleChange,
		config,
		setVisualScale: (scale: number) => {
			visualScale = scale
		},
	}
}

beforeEach(() => {
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		callback(0)
		return 0
	})
	vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	document.body.innerHTML = ""
})

describe("useTouchPinchZoom", () => {
	it("anchors the content under the fingers while their center moves", () => {
		const { container, config, onScaleChange } = setup()
		renderHook(() => useTouchPinchZoom(config))
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 200)
		expect(onScaleChange).toHaveBeenCalledWith(1, {
			contentX: 760,
			contentY: 520,
			clientX: 400,
			clientY: 300,
		})
	})

	it("uses live iframe geometry rather than compounding each move with the new scale", () => {
		const { frameWindow, config, onScaleChange, setVisualScale } = setup()
		const hook = renderHook((props) => useTouchPinchZoom(props), { initialProps: config })
		touch(frameWindow, "touchstart", 200)
		touch(frameWindow, "touchmove", 320)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
		setVisualScale(0.8)
		hook.rerender({ ...config, scale: 0.8 })
		// The same physical 160px distance now spans 200 iframe CSS pixels.
		touch(frameWindow, "touchmove", 200)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
		touch(frameWindow, "touchmove", 100)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.4)
	})

	it.each(["touchcancel", "third-finger", "finger-lift"])(
		"ends the gesture on %s until all fingers lift",
		(reason) => {
			const { container, config, onScaleChange } = setup()
			renderHook(() => useTouchPinchZoom(config))
			touch(container, "touchstart", 100)
			if (reason === "third-finger") touch(container, "touchstart", 100, 3)
			else touch(container, reason === "touchcancel" ? "touchcancel" : "touchend", 100, 1)
			touch(container, "touchmove", 200)
			expect(onScaleChange).not.toHaveBeenCalled()
			touch(container, "touchend", 0, 0)
			touch(container, "touchstart", 100)
			touch(container, "touchmove", 200)
			expect(onScaleChange).toHaveBeenCalledTimes(1)
		},
	)

	it("leaves single-finger gestures alone and removes listeners when disabled/unmounted", () => {
		const { container, config, onScaleChange } = setup()
		const hook = renderHook((props) => useTouchPinchZoom(props), { initialProps: config })
		expect(touch(container, "touchstart", 100, 1).defaultPrevented).toBe(false)
		expect(touch(container, "touchmove", 200, 1).defaultPrevented).toBe(false)
		hook.rerender({ ...config, enabled: false })
		expect(touch(container, "touchstart", 100).defaultPrevented).toBe(false)
		hook.unmount()
		touch(container, "touchmove", 200)
		expect(onScaleChange).not.toHaveBeenCalled()
	})

	it("accepts only the current iframe and exact origin, validates points, and replies to ready", () => {
		const { iframe, config, onScaleChange } = setup()
		iframe.setAttribute("src", "https://sandbox.example.test/slide")
		const frameWindow = iframe.contentWindow
		if (!frameWindow) throw new Error("Missing iframe window")
		const post = vi.spyOn(frameWindow, "postMessage").mockImplementation(() => undefined)
		const hook = renderHook((props) => useTouchPinchZoom(props), { initialProps: config })
		const message = (
			phase: string,
			distance = 200,
			origin = "https://sandbox.example.test",
			source: Window | null = iframe.contentWindow,
			points?: PinchPoint[],
		) => {
			act(() =>
				window.dispatchEvent(
					new MessageEvent("message", {
						source,
						origin,
						data: {
							type: "magic-preview-pinch",
							phase,
							points: points ?? [
								{ id: 0, x: 400 - distance / 2, y: 300 },
								{ id: 1, x: 400 + distance / 2, y: 300 },
							],
						},
					}),
				),
			)
		}
		message("start", 200, "https://other.example.test")
		message("move", 400)
		message("start", 200, undefined, window)
		message("move", 400)
		message("start", 200, undefined, undefined, [
			{ id: 0, x: NaN, y: 1 },
			{ id: 1, x: 1, y: 1 },
		])
		message("move", 400)
		expect(onScaleChange).not.toHaveBeenCalled()
		message("start")
		message("move", 320)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
		hook.rerender({ ...config, enabled: false })
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframe.contentWindow,
					origin: "https://sandbox.example.test",
					data: { type: "magic-preview-pinch-ready" },
				}),
			),
		)
		expect(post).toHaveBeenLastCalledWith(
			{ type: "magic-preview-pinch-state", enabled: false },
			"https://sandbox.example.test",
		)
		message("start")
		message("move", 400)
		expect(onScaleChange).toHaveBeenCalledTimes(1)
		hook.unmount()
	})
	it.each(["host", "iframe"])(
		"coexists with PPT swipe navigation in the %s without flipping on pinch",
		(realm) => {
			const { container, iframe, config, onScaleChange } = setup()
			const onSwipe = vi.fn()
			renderHook(() => {
				useTouchPinchZoom(config)
				usePPTSwipeNavigation({
					containerRef: config.containerRef,
					iframe,
					enabled: true,
					onSwipe,
				})
			})
			const target = realm === "host" ? container : iframe.contentDocument
			if (!target) throw new Error("Missing touch target")
			const point = (id: number, x: number) => ({ identifier: id, clientX: x, clientY: 100 })
			const gesture = (
				type: string,
				touches: ReturnType<typeof point>[],
				changedTouches: ReturnType<typeof point>[] = [],
			) => {
				const event = new Event(type, { bubbles: true, cancelable: true })
				Object.defineProperties(event, {
					touches: { value: touches },
					changedTouches: { value: changedTouches },
				})
				act(() => target.dispatchEvent(event))
				return event
			}
			gesture("touchstart", [point(1, 100)])
			gesture("touchstart", [point(1, 100), point(2, 200)])
			gesture("touchmove", [point(1, 0), point(2, 300)])
			gesture("touchend", [point(2, 300)], [point(1, 0)])
			gesture("touchend", [], [point(2, 300)])
			expect(onScaleChange).toHaveBeenCalledTimes(1)
			expect(onSwipe).not.toHaveBeenCalled()
			expect(gesture("touchstart", [point(1, 200)]).defaultPrevented).toBe(false)
			gesture("touchend", [], [point(1, 100)])
			expect(onSwipe).toHaveBeenCalledWith("next")
		},
	)
	it("does not amplify a delayed iframe move when the fingers stay at the same screen positions", () => {
		const { iframe, config, onScaleChange, setVisualScale } = setup()
		iframe.src = "https://sandbox.example.test/slide"
		const frame = iframe.contentWindow
		if (!frame) throw new Error("Missing frame")
		vi.spyOn(frame, "postMessage").mockImplementation(() => undefined)
		const hook = renderHook((props) => useTouchPinchZoom(props), { initialProps: config })
		const message = (phase: string, distance: number) => {
			const points = [0, 1].map((id) => ({
				id,
				x: 400 + (id - 0.5) * distance,
				y: 300,
				screenX: 220 + (id - 0.5) * distance * 0.5,
				screenY: 190,
			}))
			act(() =>
				window.dispatchEvent(
					new MessageEvent("message", {
						source: frame,
						origin: "https://sandbox.example.test",
						data: { type: "magic-preview-pinch", phase, points },
					}),
				),
			)
		}
		message("start", 200)
		message("move", 320)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
		setVisualScale(0.8)
		hook.rerender({ ...config, scale: 0.8 })
		// A queued move retains old iframe CSS coordinates, but the physical fingers did not move.
		message("move", 320)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
	})

	it("ignores finger jitter instead of repainting on every tiny movement", () => {
		const { container, config, onScaleChange } = setup()
		renderHook(() => useTouchPinchZoom(config))
		touch(container, "touchstart", 100)
		for (let i = 0; i < 30; i += 1) touch(container, "touchmove", 100 + (i % 2 ? 1 : -1))
		expect(onScaleChange).not.toHaveBeenCalled()
	})

	it("coalesces rapid samples into one update per frame and keeps only the latest sample", () => {
		const { container, config, onScaleChange } = setup()
		const frames: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback)
			return frames.length
		})
		renderHook(() => useTouchPinchZoom(config))
		touch(container, "touchstart", 100)
		for (const distance of [120, 130, 150, 160]) touch(container, "touchmove", distance)
		expect(onScaleChange).not.toHaveBeenCalled()
		expect(frames).toHaveLength(1)
		act(() => frames.shift()?.(16))
		expect(onScaleChange).toHaveBeenCalledTimes(1)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
	})

	it("discards queued movement on cancellation or disable, but retains the last valid move on release", () => {
		const { container, config, onScaleChange } = setup()
		const frames: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback)
			return frames.length
		})
		const hook = renderHook((props) => useTouchPinchZoom(props), { initialProps: config })
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 160)
		touch(container, "touchcancel", 0, 0)
		act(() => frames.shift()?.(16))
		expect(onScaleChange).not.toHaveBeenCalled()
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 160)
		hook.rerender({ ...config, enabled: false })
		act(() => frames.shift()?.(32))
		expect(onScaleChange).not.toHaveBeenCalled()
		hook.rerender(config)
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 160)
		touch(container, "touchend", 0, 0)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.8)
		act(() => frames.shift()?.(48))
		expect(onScaleChange).toHaveBeenCalledTimes(1)
	})
	it("cannot apply an old cancelled frame to a new gesture", () => {
		const { container, config, onScaleChange } = setup()
		const frames: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback)
			return frames.length
		})
		renderHook(() => useTouchPinchZoom(config))
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 160)
		touch(container, "touchcancel", 0, 0)
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 120)
		act(() => frames.shift()?.(16))
		expect(onScaleChange).not.toHaveBeenCalled()
		act(() => frames.shift()?.(32))
		expect(onScaleChange).toHaveBeenCalledTimes(1)
		expect(onScaleChange.mock.lastCall?.[0]).toBeCloseTo(0.6)
	})
	it("keeps scale noise out of intentional two-finger panning", () => {
		const { container, config, onScaleChange } = setup()
		renderHook(() => useTouchPinchZoom(config))
		touch(container, "touchstart", 100)
		touch(container, "touchmove", 101, 2, 410)
		touch(container, "touchmove", 99, 2, 420)
		expect(onScaleChange.mock.calls.map(([scale]) => scale)).toEqual([0.5, 0.5])
		expect(onScaleChange.mock.lastCall?.[1].clientX).toBe(420)
	})
})
