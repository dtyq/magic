import { renderHook, waitFor } from "@testing-library/react"
import { useIframeScaling } from "../useIframeScaling"
import { createRef } from "react"
import { afterEach, beforeEach, vi } from "vitest"

describe("useIframeScaling", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserver {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		document.body.innerHTML = ""
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
