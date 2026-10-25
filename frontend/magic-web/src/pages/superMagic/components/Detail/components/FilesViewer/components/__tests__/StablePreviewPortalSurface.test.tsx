import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import StablePreviewPortalSurface from "../StablePreviewPortalSurface"
import { ElementContextPanel } from "../../../../contents/HTML/components/ElementContextPanel"
import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"

vi.mock("../../../../contents/HTML/components/StylePanel", () => ({
	StylePanel: () => <div>Style controls</div>,
}))

describe("StablePreviewPortalSurface PPT viewport", () => {
	let anchor: HTMLDivElement
	let notifyResize: ResizeObserverCallback
	beforeEach(() => {
		resetOverlayStackForTest()
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: ResizeObserverCallback) {
					notifyResize = callback
				}
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		anchor = document.createElement("div")
		anchor.style.visibility = "visible"
		document.body.appendChild(anchor)
		vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
			top: 40,
			left: 80,
			width: 600,
			height: 400,
		} as DOMRect)
	})

	it("follows consecutive anchor resizes before paint without recreating the iframe", () => {
		// ResizeObserver runs before paint. An extra animation frame leaves the portal
		// at the previous width while the adjacent conversation has already moved.
		const nextFrame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1)
		render(
			<StablePreviewPortalSurface anchor={anchor} enabled visible isPpt isFullscreen={false}>
				<iframe title="resizing-slide" />
			</StablePreviewPortalSurface>,
		)
		const frame = screen.getByTitle("resizing-slide")
		const host = frame.parentElement
		if (!host) throw new Error("Missing portal host")
		for (const width of [560, 480, 640, 600]) {
			vi.mocked(anchor.getBoundingClientRect).mockReturnValue({
				top: 40,
				left: 80,
				width,
				height: 400,
			} as DOMRect)
			act(() => notifyResize([], {} as ResizeObserver))
			expect(host.style.width).toBe(`${width}px`)
			expect(screen.getByTitle("resizing-slide")).toBe(frame)
		}
		expect(nextFrame).not.toHaveBeenCalled()
	})

	it.each([false, true])(
		"keeps an open editor toolbar above fullscreen and restores it on exit (initial fullscreen=%s)",
		(initialFullscreen) => {
			const view = (isFullscreen: boolean) => (
				<StablePreviewPortalSurface
					anchor={anchor}
					enabled
					visible
					isPpt
					isFullscreen={isFullscreen}
				>
					<iframe title="editable-slide" />
					<ElementContextPanel
						editorRef={{ current: null }}
						anchor={{ top: 80, left: 80, width: 120, height: 40 }}
						selector="h1"
					/>
				</StablePreviewPortalSurface>
			)
			const { rerender } = render(view(initialFullscreen))
			const frame = screen.getByTitle("editable-slide")
			const panel = screen.getByTestId("html-editor-context-panel")
			rerender(view(true))
			expect(Number(panel.style.zIndex)).toBeGreaterThan(1000)
			expect(panel.className).not.toContain("!z-[920]")
			rerender(view(false))
			expect(panel.style.zIndex).toBe("920")
			expect(screen.getByTestId("html-editor-context-panel")).toBe(panel)
			expect(screen.getByTitle("editable-slide")).toBe(frame)
		},
	)
	afterEach(async () => {
		cleanup()
		await Promise.resolve()
		anchor.remove()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it.each([
		["data-presenter-console", "true", true],
		["data-mobile-fullscreen", "landscape", true],
		["data-presenter-console", "true", false],
		["data-mobile-fullscreen", "landscape", false],
	] as const)(
		"promotes the existing host for %s=%s (isPpt=%s) and restores its anchor on exit",
		async (attribute, value, isPpt) => {
			render(
				<StablePreviewPortalSurface
					anchor={anchor}
					enabled
					visible
					isPpt={isPpt}
					isFullscreen={false}
					borderRadius="12px"
				>
					<div data-testid="ppt-root">
						<iframe title="slide" />
					</div>
				</StablePreviewPortalSurface>,
			)
			const root = screen.getByTestId("ppt-root")
			const frame = screen.getByTitle("slide")
			const host = root.parentElement
			if (!host) throw new Error("Missing portal host")
			expect(host).toHaveStyle({
				left: "80px",
				top: "40px",
				width: "600px",
				height: "400px",
				zIndex: "10",
			})
			await act(async () => root.setAttribute(attribute, value))
			expect(host).toHaveStyle({
				left: "0px",
				top: "0px",
				width: `${window.innerWidth}px`,
				height: `${window.innerHeight}px`,
				zIndex: "900",
				borderRadius: "0px",
			})
			await act(async () => root.removeAttribute(attribute))
			expect(host).toHaveStyle({
				left: "80px",
				top: "40px",
				width: "600px",
				height: "400px",
				zIndex: "10",
				borderRadius: "12px",
			})
			expect(screen.getByTitle("slide")).toBe(frame)
			expect(root.parentElement).toBe(host)
		},
	)

	it("detects a presenter subtree mounted or removed after the portal", async () => {
		const view = (presenter: boolean) => (
			<StablePreviewPortalSurface anchor={anchor} enabled visible isPpt isFullscreen>
				<div data-testid="ppt-root">
					{presenter && <div data-presenter-console="true" />}
				</div>
			</StablePreviewPortalSurface>
		)
		const { rerender } = render(view(false))
		const host = screen.getByTestId("ppt-root").parentElement
		if (!host) throw new Error("Missing portal host")
		await act(async () => rerender(view(true)))
		expect(host.style.zIndex).toBe("calc(var(--z-index-detail-fullscreen) + 1)")
		expect(host).toHaveStyle({ left: "0px", width: `${window.innerWidth}px` })
		await act(async () => rerender(view(false)))
		expect(host.style.zIndex).toBe("calc(var(--z-index-detail-fullscreen) + 1)")
		expect(host).toHaveStyle({ left: "80px", width: "600px" })
	})
})
