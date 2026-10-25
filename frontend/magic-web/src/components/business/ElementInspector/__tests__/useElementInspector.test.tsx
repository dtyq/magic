import { act, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useElementInspector } from "../useElementInspector"
import { INSPECTOR_MSG } from "../types"

describe("useElementInspector", () => {
	const sameOrigin = window.location.origin

	it("updates the selected element rectangle when the iframe scrolls", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const info = {
			selector: ".card",
			tagName: "div",
			id: "",
			classList: ["card"],
			rect: { top: 100, left: 20, width: 200, height: 120 },
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			padding: { top: 0, right: 0, bottom: 0, left: 0 },
			border: { top: 0, right: 0, bottom: 0, left: 0 },
			computedStyles: {},
			attributes: {},
			textContent: "",
		}

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			act(() => result.current.start())
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						source: iframeWindow,
						origin: sameOrigin,
						data: { type: INSPECTOR_MSG.SELECT, elementInfo: info },
					}),
				)
			})
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						source: iframeWindow,
						origin: sameOrigin,
						data: {
							type: INSPECTOR_MSG.RECTS_CHANGED,
							rects: [
								{
									selector: ".card",
									rect: { top: 40, left: 20, width: 200, height: 120 },
								},
							],
						},
					}),
				)
			})

			expect(result.current.selectedElement?.rect.top).toBe(40)
			expect(result.current.trackedRects[".card"]?.top).toBe(40)
		} finally {
			iframe.remove()
		}
	})

	it("accepts cross-origin iframe scroll offsets from the runtime", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const targetOrigin = "https://husky.example.com"

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef, targetOrigin }))
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						source: iframeWindow,
						origin: targetOrigin,
						data: {
							type: INSPECTOR_MSG.SCROLL_CHANGED,
							left: 12,
							top: 640,
						},
					}),
				)
			})

			expect(result.current.iframeScrollOffset).toEqual({ left: 12, top: 640 })
		} finally {
			iframe.remove()
		}
	})

	it("ignores inspector messages from an unexpected iframe origin", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const info = {
			selector: ".card",
			tagName: "div",
			id: "",
			classList: [],
			rect: { top: 10, left: 10, width: 20, height: 20 },
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			padding: { top: 0, right: 0, bottom: 0, left: 0 },
			border: { top: 0, right: 0, bottom: 0, left: 0 },
			computedStyles: {},
			attributes: {},
			textContent: "",
		}

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			act(() => result.current.start())
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						source: iframeWindow,
						origin: "https://attacker.example",
						data: { type: INSPECTOR_MSG.SELECT, elementInfo: info },
					}),
				)
			})

			expect(result.current.selectedElement).toBeNull()
			expect(result.current.active).toBe(false)
		} finally {
			iframe.remove()
		}
	})

	it("uses the configured origin for inspector commands", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const postMessage = vi.spyOn(iframeWindow, "postMessage")
		const targetOrigin = "https://sandbox.example.com"

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef, targetOrigin }))
			act(() => result.current.start())

			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: INSPECTOR_MSG.START }),
				targetOrigin,
			)
		} finally {
			postMessage.mockRestore()
			iframe.remove()
		}
	})

	it("scrolls the iframe to a requested selector", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const postMessage = vi.spyOn(iframeWindow, "postMessage")
		const targetOrigin = "https://husky.example.com"

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef, targetOrigin }))
			act(() => result.current.scrollToSelector("#hero"))

			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: INSPECTOR_MSG.SCROLL_TO_SELECTOR,
					selector: "#hero",
				}),
				targetOrigin,
			)
		} finally {
			postMessage.mockRestore()
			iframe.remove()
		}
	})

	it("clears a stale selection when the iframe document reloads", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const info = {
			selector: ".card",
			tagName: "div",
			id: "",
			classList: [],
			rect: { top: 10, left: 10, width: 20, height: 20 },
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			padding: { top: 0, right: 0, bottom: 0, left: 0 },
			border: { top: 0, right: 0, bottom: 0, left: 0 },
			computedStyles: {},
			attributes: {},
			textContent: "",
		}

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			act(() => result.current.start())
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						source: iframeWindow,
						origin: sameOrigin,
						data: { type: INSPECTOR_MSG.SELECT, elementInfo: info },
					}),
				)
			})
			expect(result.current.selectedElement).not.toBeNull()

			act(() => iframe.dispatchEvent(new Event("load")))
			expect(result.current.selectedElement).toBeNull()
		} finally {
			iframe.remove()
		}
	})

	it("keeps inspection active when a pointer starts on its overlay", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			render(<div data-element-inspector-overlay="true" data-testid="inspector-overlay" />)

			act(() => result.current.start())
			const overlay = screen.getByTestId("inspector-overlay")
			fireEvent.pointerDown(overlay)
			fireEvent.mouseDown(overlay)

			expect(result.current.active).toBe(true)

			fireEvent.mouseDown(document.body)
			expect(result.current.active).toBe(false)
		} finally {
			iframe.remove()
		}
	})

	it("keeps inspection active when a pointer starts on capture authorization UI", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			render(
				<div
					data-element-inspector-capture-authorization="true"
					data-testid="ai-editing-capture-authorization-dialog"
				>
					<button type="button">Allow</button>
				</div>,
			)

			act(() => result.current.start())
			fireEvent.mouseDown(screen.getByRole("button", { name: "Allow" }))

			expect(result.current.active).toBe(true)
		} finally {
			iframe.remove()
		}
	})

	it("keeps inspection active when a pointer starts on the portaled panel", () => {
		const iframe = document.createElement("iframe")
		document.body.appendChild(iframe)
		const iframeRef = { current: iframe }

		try {
			const { result } = renderHook(() => useElementInspector({ iframeRef }))
			render(
				<div
					data-element-inspector-panel-portal="true"
					data-testid="inspector-panel-portal"
				/>,
			)

			act(() => result.current.start())
			fireEvent.mouseDown(screen.getByTestId("inspector-panel-portal"))

			expect(result.current.active).toBe(true)
		} finally {
			iframe.remove()
		}
	})

	it("stops the iframe that was active when the hook unmounted", () => {
		const iframe = document.createElement("iframe")
		const replacement = document.createElement("iframe")
		document.body.append(iframe, replacement)
		const iframeRef = { current: iframe }
		const iframeWindow = iframe.contentWindow
		if (!iframeWindow) throw new Error("iframe contentWindow is unavailable")
		const postMessage = vi.spyOn(iframeWindow, "postMessage")

		try {
			const { result, unmount } = renderHook(() => useElementInspector({ iframeRef }))
			act(() => result.current.start())
			iframeRef.current = replacement

			unmount()

			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: INSPECTOR_MSG.STOP }),
				sameOrigin,
			)
		} finally {
			iframe.remove()
			replacement.remove()
		}
	})
})
