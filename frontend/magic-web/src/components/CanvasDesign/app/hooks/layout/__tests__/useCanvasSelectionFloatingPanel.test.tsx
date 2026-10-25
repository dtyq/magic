import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import useCanvasSelectionFloatingPanel from "../useCanvasSelectionFloatingPanel"

const mocks = vi.hoisted(() => ({
	selectedElementIds: ["image-1"] as string[],
	positionRef: { current: null as HTMLDivElement | null },
	floatingRef: { current: null as HTMLDivElement | null },
	positionOptions: undefined as
		| {
				position: string
				offset: number
				verticalAlign: string
				shouldShow?: (boundingRect: null) => boolean
		  }
		| undefined,
	floatingOptions: undefined as
		| {
				id: string
				interactive: boolean
				enableWheelForwarding: boolean
				enablePointerPanForwarding: boolean
		  }
		| undefined,
	closeOnElementClick: vi.fn(),
}))

vi.mock("../../../providers/CanvasUIProvider", () => ({
	useCanvasSelectionUI: () => ({ selectedElementIds: mocks.selectedElementIds }),
}))

vi.mock("../../canvas/useCloseOnCanvasElementClick", () => ({
	default: (...args: unknown[]) => mocks.closeOnElementClick(...args),
}))

vi.mock("../useElementPositionEffect", () => ({
	default: (options: typeof mocks.positionOptions) => {
		mocks.positionOptions = options
		return { containerRef: mocks.positionRef }
	},
}))

vi.mock("../useFloatingComponent", () => ({
	useFloatingComponent: (options: typeof mocks.floatingOptions) => {
		mocks.floatingOptions = options
		return { containerRef: mocks.floatingRef }
	},
}))

describe("useCanvasSelectionFloatingPanel", () => {
	beforeEach(() => {
		mocks.selectedElementIds = ["image-1"]
		mocks.positionRef.current = null
		mocks.floatingRef.current = null
		mocks.positionOptions = undefined
		mocks.floatingOptions = undefined
		mocks.closeOnElementClick.mockClear()
	})

	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("shares history panel positioning, forwarding, and close wiring", () => {
		const onClose = vi.fn()
		const { result, rerender } = renderHook(() =>
			useCanvasSelectionFloatingPanel({
				id: "image-message-history",
				elementId: "image-1",
				onClose,
			}),
		)

		expect(mocks.positionOptions).toMatchObject({
			position: "right",
			offset: 8,
			verticalAlign: "top",
		})
		expect(mocks.positionOptions?.shouldShow?.(null)).toBe(true)
		expect(mocks.floatingOptions).toEqual({
			id: "image-message-history",
			interactive: true,
			enableWheelForwarding: true,
			enablePointerPanForwarding: true,
		})
		expect(mocks.closeOnElementClick).toHaveBeenCalledWith("image-1", onClose)

		const node = document.createElement("div")
		act(() => result.current.setRefs(node))
		expect(mocks.positionRef.current).toBe(node)
		expect(mocks.floatingRef.current).toBe(node)

		mocks.selectedElementIds = ["other-image"]
		rerender()
		expect(mocks.positionOptions?.shouldShow?.(null)).toBe(false)
	})

	it("closes on a selection change and waits while close is blocked", () => {
		const onClose = vi.fn()
		const { rerender } = renderHook(
			({ blocked }: { blocked: boolean }) =>
				useCanvasSelectionFloatingPanel({
					id: "element-rename-overlay",
					elementId: "image-1",
					onClose,
					closeOnSelectionChange: true,
					isCloseBlocked: blocked,
				}),
			{ initialProps: { blocked: true } },
		)

		mocks.selectedElementIds = ["other-image"]
		rerender({ blocked: true })
		expect(onClose).not.toHaveBeenCalled()

		rerender({ blocked: false })
		expect(onClose).toHaveBeenCalledTimes(1)
	})
})
