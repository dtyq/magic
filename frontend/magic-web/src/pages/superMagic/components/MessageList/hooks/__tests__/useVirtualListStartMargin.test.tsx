import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	measureVirtualListStartMargin,
	useVirtualListStartMargin,
} from "../useVirtualListStartMargin"

function createLayout() {
	const viewport = document.createElement("div")
	const column = document.createElement("div")
	const canvas = document.createElement("div")
	viewport.appendChild(column)
	column.appendChild(canvas)
	document.body.appendChild(viewport)
	let origin = 10
	Object.defineProperty(viewport, "clientTop", { value: 2 })
	vi.spyOn(viewport, "getBoundingClientRect").mockImplementation(() => ({ top: 100 }) as DOMRect)
	vi.spyOn(canvas, "getBoundingClientRect").mockImplementation(
		() => ({ top: 102 + origin - viewport.scrollTop }) as DOMRect,
	)
	return {
		viewport,
		column,
		canvas,
		setOrigin: (value: number) => {
			origin = value
		},
	}
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	document.body.replaceChildren()
})

describe("useVirtualListStartMargin", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		)
	})
	it("measures content spacing independently of scrolling, viewport placement, and borders", () => {
		const { viewport, canvas } = createLayout()
		expect(measureVirtualListStartMargin(viewport, canvas)).toBe(10)
		viewport.scrollTop = 300
		expect(measureVirtualListStartMargin(viewport, canvas)).toBe(10)
	})

	it("updates on container resize and disconnects its observers on unmount", () => {
		const layout = createLayout()
		let resize = () => {}
		const disconnect = vi.fn()
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: () => void) {
					resize = callback
				}
				observe() {}
				disconnect = disconnect
			},
		)
		const { result, unmount } = renderHook(() =>
			useVirtualListStartMargin(layout.viewport, { current: layout.canvas }),
		)
		expect(result.current).toBe(10)
		act(() => {
			layout.setOrigin(24)
			resize()
		})
		expect(result.current).toBe(24)
		unmount()
		expect(disconnect).toHaveBeenCalled()
	})

	it("updates when host spacing changes without a viewport size change", async () => {
		const layout = createLayout()
		const canvasRef = { current: layout.canvas }
		const { result } = renderHook(() => useVirtualListStartMargin(layout.viewport, canvasRef))
		await act(async () => {
			layout.setOrigin(32)
			layout.column.style.paddingTop = "32px"
		})
		expect(result.current).toBe(32)
		await act(async () => {
			layout.setOrigin(72)
			layout.column.prepend(document.createElement("header"))
		})
		expect(result.current).toBe(72)
	})
})
