import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SlidesTemplateSelectionDialog from "../SlidesTemplateSelectionDialog"

const mockUserInfo = {
	organization_code: "org_ppt",
	user_id: "user_ppt",
}

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			i18n: { language: "zh_CN" },
			t: (key: string) => key,
		}),
	}
})

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: mockUserInfo }),
}))

describe("SlidesTemplateSelectionDialog", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("renders draggable and resizable shell with decorations and restore button", () => {
		const onOpenChange = vi.fn()
		render(
			<SlidesTemplateSelectionDialog
				open
				title="选择 PPT 模板"
				description="副标题说明"
				onOpenChange={onOpenChange}
				footer={<button type="button">确定</button>}
			>
				<div data-testid="test-dialog-content">模板内容列表</div>
			</SlidesTemplateSelectionDialog>,
		)

		const dialog = screen.getByTestId("slides-template-selection-dialog")
		expect(dialog).toBeInTheDocument()
		expect(dialog).toHaveClass("overflow-visible")

		const header = screen.getByTestId("slides-template-dialog-header")
		expect(header).toBeInTheDocument()
		expect(header).toHaveAttribute("data-dialog-drag-handle")
		expect(header).toHaveClass("cursor-grab")

		expect(screen.getByText("选择 PPT 模板")).toBeInTheDocument()
		expect(screen.getByText("副标题说明")).toBeInTheDocument()
		expect(screen.getByTestId("test-dialog-content")).toBeInTheDocument()
		expect(screen.getByText("确定")).toBeInTheDocument()

		expect(screen.getByTestId("slides-template-restore-size-button")).toBeInTheDocument()
		expect(screen.getByTestId("slides-template-resize-grip")).toBeInTheDocument()
		expect(screen.getByTestId("slides-template-resize-guide")).toBeInTheDocument()
	})

	it("triggers onOpenChange(false) when clicking the close button", () => {
		const onOpenChange = vi.fn()
		render(
			<SlidesTemplateSelectionDialog open title="选择 PPT 模板" onOpenChange={onOpenChange}>
				<div>内容</div>
			</SlidesTemplateSelectionDialog>,
		)

		const closeButton = screen.getByTestId("slides-template-dialog-close-button")
		expect(closeButton).toBeInTheDocument()
		fireEvent.click(closeButton)
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("dismisses resize guide when user clicks dismiss", () => {
		render(
			<SlidesTemplateSelectionDialog open title="选择 PPT 模板" onOpenChange={vi.fn()}>
				<div>内容</div>
			</SlidesTemplateSelectionDialog>,
		)

		expect(screen.getByTestId("slides-template-resize-guide")).toBeInTheDocument()

		const dismissButton = screen.getByTestId("slides-template-resize-guide-dismiss")
		fireEvent.click(dismissButton)

		expect(screen.queryByTestId("slides-template-resize-guide")).not.toBeInTheDocument()
	})

	it("restores size and dismisses resize guide when clicking restore button", () => {
		render(
			<SlidesTemplateSelectionDialog open title="选择 PPT 模板" onOpenChange={vi.fn()}>
				<div>内容</div>
			</SlidesTemplateSelectionDialog>,
		)

		expect(screen.getByTestId("slides-template-resize-guide")).toBeInTheDocument()

		const restoreButton = screen.getByTestId("slides-template-restore-size-button")
		fireEvent.click(restoreButton)

		expect(screen.queryByTestId("slides-template-resize-guide")).not.toBeInTheDocument()
	})
})
