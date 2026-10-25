import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePPTSwipeNavigation } from "../usePPTSwipeNavigation"

function touchEvent(type: "touchstart" | "touchend", x: number, y: number) {
	const event = new Event(type)
	const touch = { clientX: x, clientY: y }
	Object.defineProperty(event, type === "touchstart" ? "touches" : "changedTouches", {
		value: [touch],
	})
	return event
}

describe("usePPTSwipeNavigation", () => {
	it("accepts a swipe from the active cross-origin iframe only", () => {
		const iframe = document.createElement("iframe")
		iframe.src = "https://preview.example.test/shell"
		document.body.appendChild(iframe)
		const onSwipe = vi.fn()
		const { rerender } = renderHook(
			({ enabled }) =>
				usePPTSwipeNavigation({
					containerRef: { current: document.createElement("div") },
					iframe,
					enabled,
					onSwipe,
				}),
			{ initialProps: { enabled: true } },
		)
		const send = (source: MessageEventSource | null, origin: string) =>
			window.dispatchEvent(
				new MessageEvent("message", {
					source,
					origin,
					data: { type: "ppt-slide-swipe", direction: "next" },
				}),
			)
		act(() => {
			send(window, "https://preview.example.test")
			send(iframe.contentWindow, "https://untrusted.example.test")
		})
		expect(onSwipe).not.toHaveBeenCalled()
		act(() => send(iframe.contentWindow, "https://preview.example.test"))
		expect(onSwipe).toHaveBeenCalledExactlyOnceWith("next")
		rerender({ enabled: false })
		act(() => send(iframe.contentWindow, "https://preview.example.test"))
		expect(onSwipe).toHaveBeenCalledTimes(1)
		iframe.remove()
	})

	it("reports a horizontal swipe as the matching slide direction", () => {
		const container = document.createElement("div")
		const onSwipe = vi.fn()
		const { unmount } = renderHook(() =>
			usePPTSwipeNavigation({
				containerRef: { current: container },
				enabled: true,
				onSwipe,
			}),
		)

		act(() => {
			container.dispatchEvent(touchEvent("touchstart", 180, 50))
			container.dispatchEvent(touchEvent("touchend", 80, 55))
		})

		expect(onSwipe).toHaveBeenCalledWith("next")
		unmount()
	})

	it("ignores vertical drags and gestures below the threshold", () => {
		const container = document.createElement("div")
		const onSwipe = vi.fn()
		renderHook(() =>
			usePPTSwipeNavigation({
				containerRef: { current: container },
				enabled: true,
				onSwipe,
			}),
		)

		act(() => {
			container.dispatchEvent(touchEvent("touchstart", 20, 20))
			container.dispatchEvent(touchEvent("touchend", 100, 100))
			container.dispatchEvent(touchEvent("touchstart", 20, 20))
			container.dispatchEvent(touchEvent("touchend", 50, 20))
		})

		expect(onSwipe).not.toHaveBeenCalled()
	})

	it("does not attach listeners while disabled", () => {
		const container = document.createElement("div")
		const onSwipe = vi.fn()
		renderHook(() =>
			usePPTSwipeNavigation({
				containerRef: { current: container },
				enabled: false,
				onSwipe,
			}),
		)

		act(() => {
			container.dispatchEvent(touchEvent("touchstart", 180, 50))
			container.dispatchEvent(touchEvent("touchend", 80, 50))
		})

		expect(onSwipe).not.toHaveBeenCalled()
	})

	it("handles a same-origin iframe gesture once", () => {
		const container = document.createElement("div")
		const iframe = document.createElement("iframe")
		const onSwipe = vi.fn()
		document.body.appendChild(iframe)
		renderHook(
			({ activationKey }: { activationKey: number }) =>
				usePPTSwipeNavigation({
					containerRef: { current: container },
					iframe,
					enabled: true,
					activationKey,
					onSwipe,
				}),
			{ initialProps: { activationKey: 1 } },
		)

		act(() => {
			iframe.contentDocument?.dispatchEvent(touchEvent("touchstart", 180, 40))
			iframe.contentDocument?.dispatchEvent(touchEvent("touchend", 80, 42))
		})

		expect(onSwipe).toHaveBeenCalledTimes(1)
		iframe.remove()
	})
})
