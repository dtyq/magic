import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SECTION_PIN_HEIGHT, useSectionPins } from "../hooks/useSectionPins"

const sections = [
	{ id: "templates", title: "Templates" },
	{ id: "studies", title: "Studies" },
]

function rect(top: number, bottom: number): DOMRect {
	return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top } as DOMRect
}

function setup(headingBoxes: Record<string, DOMRect>) {
	const viewport = document.createElement("div")
	viewport.append(document.createElement("div"))
	viewport.getBoundingClientRect = () => rect(100, 700)
	for (const [id, box] of Object.entries(headingBoxes)) {
		const heading = document.createElement("div")
		heading.dataset.pinId = id
		heading.getBoundingClientRect = () => box
		heading.scrollIntoView = vi.fn()
		viewport.append(heading)
	}
	document.body.append(viewport)
	return viewport
}

describe("useSectionPins", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
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
		document.body.innerHTML = ""
	})

	it("classifies headings as passed, on screen or not reached yet", () => {
		const viewport = setup({ templates: rect(20, 60), studies: rect(900, 940) })
		const { result } = renderHook(() => useSectionPins({ current: viewport }, sections, true))
		expect(result.current.positions).toEqual({ templates: "above", studies: "below" })
	})

	it("treats a heading inside the scroller as visible", () => {
		const viewport = setup({ templates: rect(300, 340), studies: rect(900, 940) })
		const { result } = renderHook(() => useSectionPins({ current: viewport }, sections, true))
		expect(result.current.positions.templates).toBe("visible")
	})

	it("stays idle when disabled", () => {
		const viewport = setup({ templates: rect(20, 60), studies: rect(900, 940) })
		const { result } = renderHook(() => useSectionPins({ current: viewport }, sections, false))
		expect(result.current.positions).toEqual({})
	})

	it("jumps below the bars of the sections before the target", () => {
		const viewport = setup({ templates: rect(20, 60), studies: rect(900, 940) })
		const { result } = renderHook(() => useSectionPins({ current: viewport }, sections, true))
		act(() => result.current.jump("studies"))
		const heading = viewport.querySelector<HTMLElement>('[data-pin-id="studies"]')
		if (!heading) throw new Error("Expected the studies heading")
		expect(heading.scrollIntoView).toHaveBeenCalledWith(
			expect.objectContaining({ block: "start" }),
		)
		expect(heading.style.scrollMarginTop).toBe(`${SECTION_PIN_HEIGHT + 8}px`)
	})
})
