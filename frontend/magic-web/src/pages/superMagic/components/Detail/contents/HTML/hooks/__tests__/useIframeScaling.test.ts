import { act, renderHook, waitFor } from "@testing-library/react"
import { useIframeScaling } from "../useIframeScaling"
import { createRef } from "react"
import { afterEach, beforeEach, vi } from "vitest"

describe("useIframeScaling", () => {
	let notifyResize: ResizeObserverCallback
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserver {
				constructor(callback: ResizeObserverCallback) {
					notifyResize = callback
				}
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		document.body.innerHTML = ""
	})

	it.each([null, 0.75])("keeps up with continuous resize at manual scale %s", (manualScale) => {
		vi.useFakeTimers()
		let width = 960
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { get: () => width },
			offsetHeight: { value: 800 },
		})
		// Keep the inputs stable, as in PPTSlide, so rerendering cannot accidentally
		// recalculate the scale and mask a resize callback waiting for an idle gap.
		const config = {
			containerRef: { current: container },
			iframeRef: createRef<HTMLIFrameElement>(),
			isPptRender: true,
			iframeLoaded: true,
			contentInjected: true,
			scaleContentDimensions: { width: 1920, height: 1080 },
			manualScale,
			onManualScaleChange: vi.fn(),
		}
		const { result, unmount } = renderHook(() => useIframeScaling(config))
		act(() => vi.advanceTimersByTime(100))
		for (width of [900, 800, 640, 720, 960]) {
			act(() => {
				notifyResize([], {} as ResizeObserver)
				vi.advanceTimersByTime(8)
			})
			expect(result.current.containerDimensions.width).toBe(width)
			expect(result.current.scaleRatio).toBeCloseTo(manualScale ?? width / 1920)
		}
		expect(config.onManualScaleChange).not.toHaveBeenCalled()
		unmount()
	})

	it("should return default values when not in PPT mode", () => {
		const containerRef = createRef<HTMLDivElement>()
		const iframeRef = createRef<HTMLIFrameElement>()

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef,
				iframeRef,
				isPptRender: false,
			}),
		)

		expect(result.current.scaleRatio).toBe(1)
		expect(result.current.verticalOffset).toBe(0)
		expect(result.current.horizontalOffset).toBe(0)
		expect(result.current.contentWidth).toBe(1920)
		expect(result.current.contentHeight).toBe(1080)
	})

	it("uses provided scale dimensions before iframe body measurements", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
		})

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		const iframeDoc = iframe.contentDocument
		expect(iframeDoc).not.toBeNull()
		if (!iframeDoc) return

		iframeDoc.body.innerHTML = '<div style="width: 2400px; height: 1400px"></div>'
		Object.defineProperties(iframeDoc.body, {
			scrollWidth: { value: 2400 },
			offsetWidth: { value: 2400 },
			clientWidth: { value: 2400 },
			scrollHeight: { value: 1400 },
			offsetHeight: { value: 1400 },
		})

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef: { current: container },
				iframeRef: { current: iframe },
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: {
					width: 1920,
					height: 1080,
				},
			}),
		)

		await waitFor(() => {
			expect(result.current.contentWidth).toBe(1920)
		})

		expect(result.current.contentHeight).toBe(1080)
		expect(result.current.scaleRatio).toBeCloseTo(960 / 1920, 5)
	})

	it("uses the canvas measurement viewport when a side panel is present", async () => {
		const scrollContainer = document.createElement("div")
		Object.defineProperties(scrollContainer, {
			offsetWidth: { value: 1200 },
			offsetHeight: { value: 800 },
		})
		const canvasViewport = document.createElement("div")
		Object.defineProperties(canvasViewport, {
			offsetWidth: { value: 880 },
			offsetHeight: { value: 800 },
		})

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef: { current: scrollContainer },
				measurementRef: { current: canvasViewport },
				iframeRef: { current: iframe },
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: { width: 1920, height: 1080 },
			}),
		)

		await waitFor(() => {
			expect(result.current.scaleRatio).toBeCloseTo(880 / 1920, 5)
		})
	})

	it("reserves vertical space for PPT preview controls during auto-fit", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 1600 },
			offsetHeight: { value: 600 },
		})

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef: { current: container },
				iframeRef: { current: iframe },
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: {
					width: 1920,
					height: 1080,
				},
				autoFitVerticalPadding: 64,
			}),
		)

		await waitFor(() => {
			expect(result.current.scaleRatio).toBeCloseTo((600 - 64 * 2) / 1080, 5)
		})
	})

	it.each([
		[740, 375],
		[1920, 1080],
		[375, 740],
	])(
		"fills the available fullscreen bounds at %s x %s without cropping",
		async (width, height) => {
			const container = document.createElement("div")
			Object.defineProperties(container, {
				offsetWidth: { value: width },
				offsetHeight: { value: height },
			})
			const { result } = renderHook(() =>
				useIframeScaling({
					containerRef: { current: container },
					iframeRef: createRef<HTMLIFrameElement>(),
					isPptRender: true,
					isFullscreen: true,
					iframeLoaded: true,
					contentInjected: true,
					autoFitVerticalPadding: 0,
					manualScale: 0.5,
					scaleContentDimensions: { width: 1920, height: 1080 },
				}),
			)
			await waitFor(() =>
				expect(result.current.scaleRatio).toBeCloseTo(
					Math.min(width / 1920, height / 1080),
					5,
				),
			)
		},
	)

	it("auto-fits PPT fullscreen regardless of the shared manual scale", async () => {
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
		})

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		const { result } = renderHook(() =>
			useIframeScaling({
				containerRef: { current: container },
				iframeRef: { current: iframe },
				isPptRender: true,
				isFullscreen: true,
				iframeLoaded: true,
				contentInjected: true,
				manualScale: 0.65,
				onManualScaleChange: vi.fn(),
				scaleContentDimensions: {
					width: 1920,
					height: 1080,
				},
			}),
		)

		await waitFor(() => {
			expect(result.current.scaleRatio).toBeCloseTo(960 / 1920, 5)
		})
		expect(result.current.isManualZoom).toBe(false)
	})

	it("does not schedule delayed slide-container probes when scale dimensions are available", () => {
		const setTimeoutSpy = vi.spyOn(window, "setTimeout")
		const container = document.createElement("div")
		Object.defineProperties(container, {
			offsetWidth: { value: 960 },
			offsetHeight: { value: 800 },
		})

		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)

		renderHook(() =>
			useIframeScaling({
				containerRef: { current: container },
				iframeRef: { current: iframe },
				isPptRender: true,
				iframeLoaded: true,
				contentInjected: true,
				scaleContentDimensions: {
					width: 1920,
					height: 1080,
				},
			}),
		)

		expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 100)
	})
})
