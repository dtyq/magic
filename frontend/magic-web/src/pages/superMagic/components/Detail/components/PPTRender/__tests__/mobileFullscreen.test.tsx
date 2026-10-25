import { useEffect, useRef } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useFullscreen } from "../hooks/useFullscreen"

const viewport = vi.hoisted(() => ({ md: false, coarse: false }))
vi.mock("ahooks", async (importOriginal) => ({
	...(await importOriginal<typeof import("ahooks")>()),
	useResponsive: () => ({ md: viewport.md }),
}))
vi.mock("@/utils/devices", () => ({ isMagicApp: false, isMobile: true }))
vi.mock("@/stores/interface", () => ({ interfaceStore: { setIsMobile: vi.fn() } }))
vi.mock("@/providers/MagicWidgetProvider/context", () => ({
	useMagicWidgetConfig: () => ({ config: {}, embedContext: null }),
}))

let fullscreenElement: Element | null = null
let presentation: ReturnType<typeof useFullscreen>
const unmounted = vi.fn()

function MobilePreview() {
	const containerRef = useRef<HTMLDivElement>(null)
	presentation = useFullscreen({ containerRef, preserveMobileLayout: true })
	useEffect(() => unmounted, [])
	return (
		<div ref={containerRef} data-testid="mobile-preview">
			<span>slide 7</span>
			<button onClick={() => void presentation.toggleFullscreen()}>present</button>
		</div>
	)
}

// Mirrors the responsive route and preview wrappers that otherwise replace the whole PPT tree.
function ResponsivePage() {
	return useIsMobile() ? <MobilePreview /> : <div>desktop page</div>
}

describe("mobile PPT fullscreen across responsive layout changes", () => {
	beforeEach(() => {
		viewport.md = false
		viewport.coarse = false
		fullscreenElement = null
		unmounted.mockClear()
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query === "(pointer: coarse)" && viewport.coarse,
		}))
		Object.defineProperty(document, "fullscreenElement", {
			configurable: true,
			get: () => fullscreenElement,
		})
		Object.defineProperty(document, "webkitFullscreenElement", {
			configurable: true,
			get: () => null,
		})
	})

	it("keeps the same mobile preview when native entry rotates before resolving", async () => {
		const view = render(<ResponsivePage />)
		const preview = screen.getByTestId("mobile-preview")
		preview.requestFullscreen = vi.fn(async () => {
			fullscreenElement = preview
			viewport.md = true
			view.rerender(<ResponsivePage />)
			document.dispatchEvent(new Event("fullscreenchange"))
		})
		await act(async () => {
			await presentation.toggleFullscreen()
		})
		expect(screen.getByTestId("mobile-preview")).toBe(preview)
		expect(unmounted).not.toHaveBeenCalled()
		expect(presentation.isFullscreen).toBe(true)
		act(() => {
			fullscreenElement = null
			document.dispatchEvent(new Event("fullscreenchange"))
		})
		expect(screen.getByText("desktop page")).toBeInTheDocument()
	})

	it("keeps Safari CSS presentation on rotation and ignores unrelated native events", async () => {
		viewport.coarse = true
		const view = render(<ResponsivePage />)
		const preview = screen.getByTestId("mobile-preview")
		await act(async () => {
			fireEvent.click(screen.getByText("present"))
		})
		act(() => {
			viewport.md = true
			view.rerender(<ResponsivePage />)
			document.dispatchEvent(new Event("webkitfullscreenchange"))
		})
		expect(screen.getByTestId("mobile-preview")).toBe(preview)
		expect(presentation.isFullscreen).toBe(true)
		await act(async () => {
			await presentation.exitFullscreen()
		})
		expect(screen.getByText("desktop page")).toBeInTheDocument()
	})

	it("releases the responsive lock when native entry fails", async () => {
		const view = render(<ResponsivePage />)
		const preview = screen.getByTestId("mobile-preview")
		preview.requestFullscreen = vi.fn(async () => {
			throw new Error("denied")
		})
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
		await act(async () => {
			await presentation.toggleFullscreen()
		})
		act(() => {
			viewport.md = true
			view.rerender(<ResponsivePage />)
		})
		expect(screen.getByText("desktop page")).toBeInTheDocument()
		error.mockRestore()
	})

	it("releases CSS presentation on unmount so later pages remain responsive", async () => {
		viewport.coarse = true
		const view = render(<ResponsivePage />)
		await act(async () => {
			await presentation.toggleFullscreen()
		})
		view.unmount()
		viewport.md = true
		render(<ResponsivePage />)
		expect(screen.getByText("desktop page")).toBeInTheDocument()
	})
})
