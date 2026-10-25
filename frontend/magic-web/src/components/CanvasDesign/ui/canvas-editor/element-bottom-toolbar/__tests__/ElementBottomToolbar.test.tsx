import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementBottomToolbar } from "../ElementBottomToolbar"

vi.mock("../../../../app/hooks/layout/useElementPositionEffect", () => ({
	default: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

describe("ElementBottomToolbar", () => {
	it("keeps an empty shell mounted before items become visible", () => {
		const { rerender } = render(
			<ElementBottomToolbar floatingId="test-bottom-toolbar" items={[]} />,
		)

		const toolbar = screen.getByRole("toolbar", { hidden: true })
		expect(toolbar).toHaveAttribute("data-empty", "true")
		expect(toolbar).toHaveAttribute("aria-hidden", "true")

		rerender(
			<ElementBottomToolbar
				floatingId="test-bottom-toolbar"
				items={[{ id: "edit", label: "编辑", onClick: vi.fn() }]}
			/>,
		)

		expect(screen.getByRole("toolbar")).not.toHaveAttribute("data-empty")
		expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument()
	})

	it("filters hidden items and inserts dividers only when the group changes", () => {
		const { container } = render(
			<ElementBottomToolbar
				floatingId="test-bottom-toolbar"
				items={[
					{
						id: "quick-edit",
						group: "quick",
						label: "快捷编辑",
						onClick: vi.fn(),
					},
					null,
					{
						id: "re-edit",
						group: "generation",
						label: "重新编辑",
						onClick: vi.fn(),
					},
					{
						id: "generate-again",
						group: "generation",
						label: "再次生成",
						onClick: vi.fn(),
					},
				]}
			/>,
		)

		expect(screen.getAllByRole("button")).toHaveLength(3)
		expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
	})

	it("renders native button state, loading state, shortcut, and click behavior", () => {
		const onQuickEdit = vi.fn()
		const onGenerateAgain = vi.fn()
		render(
			<ElementBottomToolbar
				floatingId="test-bottom-toolbar"
				items={[
					{
						id: "quick-edit",
						label: "快捷编辑",
						shortcut: "Tab",
						onClick: onQuickEdit,
					},
					{
						id: "generate-again",
						label: "再次生成",
						loading: true,
						onClick: onGenerateAgain,
					},
				]}
			/>,
		)

		const quickEdit = screen.getByRole("button", { name: "快捷编辑 Tab" })
		const generateAgain = screen.getByRole("button", { name: "再次生成" })

		fireEvent.click(quickEdit)
		fireEvent.click(generateAgain)

		expect(onQuickEdit).toHaveBeenCalledTimes(1)
		expect(generateAgain).toBeDisabled()
		expect(generateAgain).toHaveAttribute("aria-busy", "true")
		expect(onGenerateAgain).not.toHaveBeenCalled()
	})

	it("renders custom version controls as a section beside result actions", () => {
		const { container } = render(
			<ElementBottomToolbar
				floatingId="test-bottom-toolbar"
				sections={[
					{
						id: "result-actions",
						group: "result-actions",
						items: [{ id: "edit", label: "重新编辑", onClick: vi.fn() }],
					},
					{
						id: "versions",
						group: "versions",
						content: <span data-testid="version-controls">2/4</span>,
					},
				]}
			/>,
		)

		expect(screen.getByRole("button", { name: "重新编辑" })).toBeInTheDocument()
		expect(screen.getByTestId("version-controls")).toHaveTextContent("2/4")
		expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
	})
})
