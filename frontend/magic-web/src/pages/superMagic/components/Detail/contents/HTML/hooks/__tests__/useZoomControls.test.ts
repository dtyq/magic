import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useZoomControls } from "../useZoomControls"

describe("useZoomControls", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserver {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 0
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		document.body.innerHTML = ""
	})

	it("handles trackpad pinch gestures dispatched inside the PPT iframe", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
			clientWidth: { value: 960 },
			clientHeight: { value: 800 },
		})
		container.scrollTo = vi.fn()

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		const { result } = renderHook(() =>
			useZoomControls({
				containerRef: { current: container },
				iframeRef: { current: iframe },
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)

		await waitFor(() => {
			expect(result.current.scaleRatio).toBeCloseTo(0.5, 5)
		})

		const wheelEvent = new WheelEvent("wheel", {
			ctrlKey: true,
			deltaY: -50,
			cancelable: true,
		})
		act(() => {
			iframe.contentWindow?.dispatchEvent(wheelEvent)
		})

		await waitFor(() => {
			expect(result.current.scaleRatio).toBeCloseTo(0.6, 5)
		})
		expect(wheelEvent.defaultPrevented).toBe(true)
	})
	it("zooms a PPT with two fingers across consecutive renders", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
			clientWidth: { value: 960 },
			clientHeight: { value: 800 },
		})
		container.scrollTo = vi.fn()
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const containerRef = { current: container }
		const iframeRef = { current: iframe }
		const { result } = renderHook(() =>
			useZoomControls({
				containerRef,
				iframeRef,
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)
		await waitFor(() => expect(result.current.scaleRatio).toBeCloseTo(0.5))
		const touch = (type: string, distance: number) => {
			const event = new Event(type, { cancelable: true })
			Object.defineProperty(event, "touches", {
				value: [
					{ identifier: 1, clientX: 400 - distance / 2, clientY: 300 },
					{ identifier: 2, clientX: 400 + distance / 2, clientY: 300 },
				],
			})
			act(() => container.dispatchEvent(event))
			return event
		}
		touch("touchstart", 100)
		expect(result.current.getIframeStyle(true).transition).toBe("none")
		expect(touch("touchmove", 160).defaultPrevented).toBe(true)
		await waitFor(() => expect(result.current.scaleRatio).toBeCloseTo(0.8))
		touch("touchmove", 60)
		await waitFor(() => expect(result.current.scaleRatio).toBeCloseTo(0.3))
	})
	it.each([{ isEditMode: true }, { isFullscreen: true }, { isVisible: false }])(
		"does not consume pinch gestures outside visible preview: %o",
		async (mode) => {
			const container = document.createElement("div")
			Object.defineProperties(container, {
				offsetWidth: { value: 960 },
				offsetHeight: { value: 800 },
				clientWidth: { value: 960 },
				clientHeight: { value: 800 },
			})
			container.scrollTo = vi.fn()
			const iframe = document.createElement("iframe")
			document.body.appendChild(iframe)
			const containerRef = { current: container },
				iframeRef = { current: iframe }
			renderHook(() =>
				useZoomControls({
					containerRef,
					iframeRef,
					isPptRender: true,
					iframeLoaded: true,
					contentInjected: true,
					scaleContentDimensions: { width: 1920, height: 1080 },
					...mode,
				}),
			)
			const event = new Event("touchstart", { cancelable: true })
			Object.defineProperty(event, "touches", {
				value: [
					{ identifier: 1, clientX: 1, clientY: 1 },
					{ identifier: 2, clientX: 100, clientY: 1 },
				],
			})
			act(() => container.dispatchEvent(event))
			expect(event.defaultPrevented).toBe(false)
		},
	)

	it("clamps scale and applies only the newest scroll correction using updated iframe geometry", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
			clientWidth: { value: 960 },
			clientHeight: { value: 800 },
		})
		container.scrollTo = vi.fn()
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const containerRef = { current: container },
			iframeRef = { current: iframe }
		const { result } = renderHook(() =>
			useZoomControls({
				containerRef,
				iframeRef,
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)
		await waitFor(() => expect(result.current.scaleRatio).toBeCloseTo(0.5))
		const callbacks: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		})
		act(() => {
			result.current.handleScaleChange(100)
			result.current.handleScaleChange(0.01)
		})
		expect(result.current.scaleRatio).toBe(0.1)
		vi.spyOn(iframe, "getBoundingClientRect").mockReturnValue({
			left: 1000,
			top: 1000,
		} as DOMRect)
		act(() => {
			while (callbacks.length) callbacks.shift()?.(0)
		})
		expect(container.scrollTo).toHaveBeenCalledTimes(1)
		expect(container.scrollTo).toHaveBeenCalledWith({
			left: 616,
			top: 680,
			behavior: "instant",
		})
	})
	it("cancels an outstanding scroll correction when zoom is reset", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
			clientWidth: { value: 960 },
			clientHeight: { value: 800 },
		})
		container.scrollTo = vi.fn()
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const containerRef = { current: container },
			iframeRef = { current: iframe }
		const { result } = renderHook(() =>
			useZoomControls({
				containerRef,
				iframeRef,
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)
		await waitFor(() => expect(result.current.scaleRatio).toBeCloseTo(0.5))
		const callbacks: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callbacks.push(callback)
			return callbacks.length
		})
		act(() => {
			result.current.handleScaleChange(1)
			result.current.handleResetZoom()
		})
		act(() => {
			while (callbacks.length) callbacks.shift()?.(0)
		})
		expect(result.current.scaleRatio).toBe(0.5)
		expect(container.scrollTo).not.toHaveBeenCalled()
	})
	it("lets touch own zoom before its first frame and prevents wheel/legacy deltas from stacking", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
			clientWidth: { value: 960 },
			clientHeight: { value: 800 },
		})
		container.scrollTo = vi.fn()
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const containerRef = { current: container },
			iframeRef = { current: iframe }
		const { result } = renderHook(() =>
			useZoomControls({
				containerRef,
				iframeRef,
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)
		await waitFor(() => expect(result.current.scaleRatio).toBe(0.5))
		const frames: FrameRequestCallback[] = []
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback)
			return frames.length
		})
		const pinch = (type: string, distance: number) => {
			const event = new Event(type, { cancelable: true })
			Object.defineProperty(event, "touches", {
				value: [0, 1].map((id) => ({
					identifier: id,
					clientX: 400 + (id - 0.5) * distance,
					clientY: 300,
				})),
			})
			act(() => container.dispatchEvent(event))
		}
		pinch("touchstart", 100)
		const wheel = new WheelEvent("wheel", { ctrlKey: true, deltaY: -100, cancelable: true })
		act(() => {
			iframe.contentWindow?.dispatchEvent(wheel)
			result.current.handleScaleChange(1)
		})
		expect(result.current.scaleRatio).toBe(0.5)
		expect(wheel.defaultPrevented).toBe(true)
		pinch("touchmove", 160)
		act(() => frames.shift()?.(16))
		expect(result.current.scaleRatio).toBeCloseTo(0.8)
		// The scroll origin is corrected in layout, without two extra queued RAF callbacks.
		expect(container.scrollTo).toHaveBeenCalledTimes(1)
		expect(frames).toHaveLength(0)
	})
})
