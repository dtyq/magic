import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	DialogRestoreSizeButton,
	DialogResizeGrip,
	DialogResizeGuide,
	DialogWindowDecorations,
} from "../index"
import type { DialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("DialogWindow components", () => {
	const mockFrame: DialogWindowFrame = {
		windowOptions: {
			open: true,
			draggable: true,
			resizable: true,
			defaultSize: { width: 1000, height: 700 },
			minSize: { width: 600, height: 400 },
		},
		resizeGuideVisible: true,
		dismissResizeGuide: vi.fn(),
		restoreRecommendedSize: vi.fn(),
	}

	describe("DialogRestoreSizeButton", () => {
		it("renders restore button when resizable and clicks trigger callback", () => {
			render(<DialogRestoreSizeButton frame={mockFrame} />)
			const button = screen.getByTestId("dialog-restore-size-button")
			expect(button).toBeInTheDocument()
			expect(button).toHaveTextContent("sidebarPanels.restoreRecommendedSize")

			fireEvent.click(button)
			expect(mockFrame.restoreRecommendedSize).toHaveBeenCalled()
		})

		it("does not render when resizable is false", () => {
			const nonResizableFrame = {
				...mockFrame,
				windowOptions: { ...mockFrame.windowOptions, resizable: false },
			}
			render(<DialogRestoreSizeButton frame={nonResizableFrame} />)
			expect(screen.queryByTestId("dialog-restore-size-button")).not.toBeInTheDocument()
		})
	})

	describe("DialogResizeGrip", () => {
		it("renders corner grip with active highlight class when guide is visible", () => {
			render(<DialogResizeGrip frame={mockFrame} />)
			const grip = screen.getByTestId("dialog-resize-grip")
			expect(grip).toBeInTheDocument()
			expect(grip).toHaveClass("text-primary")
		})

		it("renders without highlight when guide is not visible", () => {
			render(<DialogResizeGrip frame={{ ...mockFrame, resizeGuideVisible: false }} />)
			const grip = screen.getByTestId("dialog-resize-grip")
			expect(grip).toBeInTheDocument()
			expect(grip).not.toHaveClass("text-primary")
		})
	})

	describe("DialogResizeGuide", () => {
		it("renders guide alert and triggers dismiss and restore", () => {
			render(<DialogResizeGuide frame={mockFrame} />)
			expect(screen.getByTestId("dialog-resize-guide")).toBeInTheDocument()
			expect(screen.getByText("sidebarPanels.resizeGuideTitle")).toBeInTheDocument()

			const dismissBtn = screen.getByTestId("dialog-resize-guide-dismiss")
			fireEvent.click(dismissBtn)
			expect(mockFrame.dismissResizeGuide).toHaveBeenCalled()

			const restoreBtn = screen.getByTestId("dialog-resize-guide-restore")
			fireEvent.click(restoreBtn)
			expect(mockFrame.restoreRecommendedSize).toHaveBeenCalled()
		})
	})

	describe("DialogWindowDecorations", () => {
		it("renders both guide and grip when resizable", () => {
			render(<DialogWindowDecorations frame={mockFrame} />)
			expect(screen.getByTestId("dialog-resize-guide")).toBeInTheDocument()
			expect(screen.getByTestId("dialog-resize-grip")).toBeInTheDocument()
		})
	})
})
