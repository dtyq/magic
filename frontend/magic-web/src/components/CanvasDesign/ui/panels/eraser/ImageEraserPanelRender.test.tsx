import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ImageEraserPanelRender from "./ImageEraserPanelRender"

const mocks = vi.hoisted(() => ({
	setMode: vi.fn(),
	sessionUpdateHandler: undefined as
		| ((event: {
				data: {
					elementId: string
					radius: number
					canUndo: boolean
					canRedo: boolean
					mode: "erase" | "restore"
				}
		  }) => void)
		| undefined,
}))

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			eraserManager: {
				getRadius: () => 24,
				getRadiusRange: () => ({ min: 8, max: 120 }),
				getMode: () => "erase",
				canUndo: () => false,
				canRedo: () => false,
				setMode: mocks.setMode,
				setRadius: vi.fn(),
				undoLastStroke: vi.fn(),
				redoLastStroke: vi.fn(),
				cancelEraser: vi.fn(),
			},
			elementManager: {
				getElementData: () => null,
				getElementInstance: () => null,
			},
		},
	}),
}))
vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({ t: (_key: string, fallback: string) => fallback }),
}))
vi.mock("../../../app/providers/MagicProvider", () => ({ useMagic: () => ({}) }))
vi.mock("../../../app/providers/CanvasUIProvider", () => ({
	useCanvasModeUI: () => ({ erasingElementId: "image-1" }),
}))
vi.mock("../../../app/hooks/canvas", () => ({
	useCanvasEvent: (_type: string, handler: typeof mocks.sessionUpdateHandler) => {
		mocks.sessionUpdateHandler = handler
	},
}))
vi.mock("../../../app/hooks/layout/useElementPositionEffect", () => ({
	default: () => ({ containerRef: { current: null } }),
}))
vi.mock("../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

describe("ImageEraserPanelRender mode control", () => {
	beforeEach(() => {
		mocks.setMode.mockClear()
		mocks.sessionUpdateHandler = undefined
	})

	it("updates the manager from the checkbox and follows session updates", () => {
		render(<ImageEraserPanelRender />)

		const checkbox = screen.getByRole("checkbox", { name: "反向擦除 (Option/Alt)" })
		fireEvent.click(checkbox)
		expect(mocks.setMode).toHaveBeenCalledWith("restore")

		act(() => {
			mocks.sessionUpdateHandler?.({
				data: {
					elementId: "image-1",
					radius: 24,
					canUndo: false,
					canRedo: false,
					mode: "erase",
				},
			})
		})
		expect(checkbox).not.toBeChecked()
	})
})
