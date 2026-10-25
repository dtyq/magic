import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageElement } from "../../../runtime/document/types"
import ContentVersionPanel from "./index"

const mocks = vi.hoisted(() => ({
	closeVersionPanel: vi.fn(),
	element: null as ImageElement | null,
	effectiveContentId: "version-2",
	handleWheel: vi.fn(),
	operations: {
		switchActiveContent: vi.fn((contentId: string) => {
			mocks.effectiveContentId = contentId
			return true
		}),
		setMainContent: vi.fn(() => true),
		deleteActiveContent: vi.fn(() => true),
	},
}))

vi.mock("../../../app/providers/CanvasUIProvider", () => ({
	useCanvasPanelUI: () => ({
		versionPanelElementId: "image-1",
		closeVersionPanel: mocks.closeVersionPanel,
	}),
}))

vi.mock("../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			getEffectiveContentId: () => mocks.effectiveContentId,
			elementManager: { getElementInstance: () => mocks.operations },
			permissionManager: { can: () => true },
			setPreviewContent: vi.fn(),
			viewportController: { handleWheelFromFloating: mocks.handleWheel },
		},
	}),
}))

vi.mock("../../../app/hooks/canvas", () => ({
	useCanvasElement: () => mocks.element,
}))

vi.mock("../../../app/hooks/layout/useCanvasSelectionFloatingPanel", () => ({
	default: () => ({ setRefs: vi.fn() }),
}))

vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback?: string | { defaultValue?: string; number?: number }) => {
			if (typeof fallback === "string") return fallback
			return (fallback?.defaultValue ?? "").replace(
				"{{number}}",
				String(fallback?.number ?? ""),
			)
		},
	}),
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("./ContentVersionMedia", () => ({
	default: () => <span data-testid="version-media" />,
}))

function createElement(): ImageElement {
	return {
		id: "image-1",
		type: "image",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: "version-2",
		mainContentId: "version-2",
		contents: [
			{ contentId: "version-1", src: "one.png", status: "completed" },
			{ contentId: "version-2", src: "two.png", status: "completed" },
		],
	}
}

describe("ContentVersionPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.element = createElement()
		mocks.effectiveContentId = "version-2"
	})

	it("switches the active Content from a card", () => {
		render(<ContentVersionPanel />)

		fireEvent.click(screen.getByRole("button", { name: "切换到 V1" }))
		expect(mocks.operations.switchActiveContent).toHaveBeenCalledWith("version-1")
	})

	it("applies set-main and hover deletion to the requested card", async () => {
		render(<ContentVersionPanel />)

		fireEvent.click(screen.getByRole("button", { name: "将 V1 设为主版本" }))
		expect(mocks.operations.switchActiveContent).toHaveBeenCalledWith("version-1")
		expect(mocks.operations.setMainContent).toHaveBeenCalledWith("version-1")

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "删除 V1" }))
			await Promise.resolve()
		})
		expect(mocks.operations.deleteActiveContent).toHaveBeenCalledOnce()
		expect(mocks.operations.switchActiveContent).toHaveBeenCalledOnce()
	})

	it("routes panel wheel input to the canvas before local scroll handling", () => {
		render(<ContentVersionPanel />)
		const panel = screen.getByRole("dialog")
		const event = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			deltaY: 20,
		})

		act(() => {
			panel.dispatchEvent(event)
		})

		expect(mocks.handleWheel).toHaveBeenCalledWith(event)
		expect(event.defaultPrevented).toBe(true)
	})

	it("restores the previous active version when setting main fails", () => {
		mocks.operations.setMainContent.mockReturnValueOnce(false)
		render(<ContentVersionPanel />)

		fireEvent.click(screen.getByRole("button", { name: "将 V1 设为主版本" }))

		expect(mocks.operations.switchActiveContent).toHaveBeenNthCalledWith(1, "version-1")
		expect(mocks.operations.switchActiveContent).toHaveBeenNthCalledWith(2, "version-2")
		expect(mocks.effectiveContentId).toBe("version-2")
	})
})
