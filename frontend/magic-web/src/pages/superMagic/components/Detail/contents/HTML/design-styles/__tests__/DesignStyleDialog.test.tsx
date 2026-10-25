import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleDialog from "../DesignStyleDialog"
import { designStyleFixture } from "./fixtures"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ i18n: { language: "zh_CN" }, t: (key: string) => key }),
	}
})
vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({
		userInfo: { organization_code: "org_1", user_id: "user_1" },
	}),
}))
vi.mock("../DesignStyleThumbnail", () => ({ default: () => <div /> }))
vi.mock("../DesignStylePreview", () => ({
	default: ({ style, mode }: { style: { code: string }; mode: "details" | "raw" }) => (
		<div data-testid="design-style-preview" data-preview-mode={mode}>
			{style.code}
		</div>
	),
}))
vi.mock("../catalog", async (importOriginal) => ({
	...(await importOriginal<typeof import("../catalog")>()),
	loadDesignStyleCatalog: vi.fn(async () => ({
		styles: [
			designStyleFixture,
			{ ...designStyleFixture, code: "second-style", title: "Second Style", featured: false },
		],
	})),
}))

describe("DesignStyleDialog", () => {
	it("starts in the featured gallery and applies only the opened detail", async () => {
		const onApply = vi.fn()
		render(<DesignStyleDialog open onOpenChange={vi.fn()} onApply={onApply} canApply />)
		expect(screen.getByTestId("design-style-dialog")).toHaveClass("overflow-visible")
		expect(screen.getByTestId("design-style-dialog-header")).toHaveAttribute(
			"data-dialog-drag-handle",
		)
		expect(screen.getByTestId("design-style-dialog-header")).toHaveClass("cursor-grab")
		expect(screen.getByTestId("design-style-restore-size-button")).toBeInTheDocument()
		expect(screen.getByTestId("design-style-resize-grip")).toBeInTheDocument()
		const card = await screen.findByTestId(`design-style-card-${designStyleFixture.code}`)
		const grid = screen.getByTestId("design-style-grid")
		expect(grid).toHaveClass("grid", "gap-x-6", "gap-y-7", "pt-5")
		expect(grid.className).toContain("repeat(auto-fill,minmax(min(100%,280px),1fr))")
		expect(grid).not.toHaveClass("lg:grid-cols-3")
		expect(screen.queryByTestId("design-style-preview")).not.toBeInTheDocument()
		expect(screen.queryByTestId("design-style-apply-button")).not.toBeInTheDocument()
		expect(screen.queryByTestId("design-style-card-second-style")).not.toBeInTheDocument()
		fireEvent.click(card)
		expect(screen.getByTestId("design-style-detail-scroll")).toHaveClass(
			"px-4",
			"pb-4",
			"sm:px-6",
			"sm:pb-6",
		)
		expect(screen.getByTestId("design-style-detail-scroll")).not.toHaveClass("pt-4", "sm:pt-6")
		expect(screen.getByTestId("design-style-back")).toHaveFocus()
		expect(screen.getByTestId("design-style-detail-header")).toHaveTextContent(
			designStyleFixture.title,
		)
		expect(screen.getByTestId("design-style-detail-header")).not.toHaveTextContent(
			"htmlEditor.designStyle.gallery.styleExample",
		)
		expect(screen.queryByText("htmlEditor.designStyle.title")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.designStyle.rawMode" }))
		expect(screen.getByTestId("design-style-preview")).toHaveAttribute(
			"data-preview-mode",
			"raw",
		)
		fireEvent.click(screen.getByTestId("design-style-apply-button"))
		expect(onApply).toHaveBeenCalledWith(designStyleFixture)
	})

	it("restores search, gallery position and focus when returning from detail", async () => {
		render(<DesignStyleDialog open onOpenChange={vi.fn()} onApply={vi.fn()} canApply />)
		const card = await screen.findByTestId(`design-style-card-${designStyleFixture.code}`)
		const search = screen.getByRole("textbox")
		fireEvent.change(search, { target: { value: designStyleFixture.title } })
		const gallery = screen.getByTestId("design-style-gallery")
		gallery.scrollTop = 320
		fireEvent.click(card)
		fireEvent.click(screen.getByTestId("design-style-back"))
		expect(gallery.scrollTop).toBe(320)
		expect(search).toHaveValue(designStyleFixture.title)
		expect(card).toHaveFocus()
		expect(screen.queryByTestId("design-style-preview")).not.toBeInTheDocument()
	})

	it("uses Escape to return before closing the dialog", async () => {
		const onOpenChange = vi.fn()
		render(<DesignStyleDialog open onOpenChange={onOpenChange} onApply={vi.fn()} canApply />)
		fireEvent.click(await screen.findByTestId(`design-style-card-${designStyleFixture.code}`))
		fireEvent.keyDown(document, { key: "Escape" })
		await waitFor(() =>
			expect(screen.queryByTestId("design-style-preview")).not.toBeInTheDocument(),
		)
		expect(onOpenChange).not.toHaveBeenCalled()
		fireEvent.keyDown(document, { key: "Escape" })
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("renders resize guide and dismisses it when requested", async () => {
		render(<DesignStyleDialog open onOpenChange={vi.fn()} onApply={vi.fn()} canApply />)
		expect(screen.getByTestId("design-style-resize-guide")).toBeInTheDocument()
		expect(screen.getByText("sidebarPanels.resizeGuideTitle")).toBeInTheDocument()
		expect(screen.getByText("sidebarPanels.resizeGuideDescription")).toBeInTheDocument()

		const dismissButton = screen.getByRole("button", {
			name: "sidebarPanels.resizeGuideDismiss",
		})
		fireEvent.click(dismissButton)
		expect(screen.queryByTestId("design-style-resize-guide")).not.toBeInTheDocument()
	})
})
