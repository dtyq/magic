import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MobileDeleteConfirmPopup from "../index"

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerLeadingAction,
		headerTrailingAction,
		headerTitle,
	}: {
		visible?: boolean
		children?: React.ReactNode
		headerTitle?: string
		headerLeadingAction?: { onClick: () => void; testId?: string }
		headerTrailingAction?: { onClick: () => void; testId?: string; disabled?: boolean }
	}) =>
		visible ? (
			<div data-testid="magic-popup">
				<h2>{headerTitle}</h2>
				<button
					type="button"
					data-testid={headerLeadingAction?.testId}
					onClick={headerLeadingAction?.onClick}
				>
					cancel
				</button>
				<button
					type="button"
					data-testid={headerTrailingAction?.testId}
					disabled={headerTrailingAction?.disabled}
					onClick={headerTrailingAction?.onClick}
				>
					confirm
				</button>
				{children}
			</div>
		) : null,
}))

describe("MobileDeleteConfirmPopup", () => {
	it("renders bold entity name and description suffix when visible", () => {
		render(
			<MobileDeleteConfirmPopup
				visible
				onClose={vi.fn()}
				title="删除项目"
				entityName="Demo Project"
				descriptionSuffix="将被永久删除，此操作无法撤销。"
				onConfirm={vi.fn()}
				cancelAriaLabel="取消"
				confirmAriaLabel="确认"
			/>,
		)

		const message = screen.getByTestId("mobile-delete-confirm-message")
		expect(message).toHaveTextContent("Demo Project")
		expect(message).toHaveTextContent("将被永久删除，此操作无法撤销。")
		expect(screen.getByText("删除项目")).toBeInTheDocument()
	})

	it("calls onClose when cancel is clicked", () => {
		const onClose = vi.fn()
		render(
			<MobileDeleteConfirmPopup
				visible
				onClose={onClose}
				title="删除工作区"
				entityName="My Workspace"
				descriptionSuffix="将被永久删除。"
				onConfirm={vi.fn()}
				cancelAriaLabel="取消"
				confirmAriaLabel="确认"
				testIdPrefix="mobile-workspace-delete-confirm"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-workspace-delete-confirm-cancel"))
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("calls onConfirm when confirm is clicked", () => {
		const onConfirm = vi.fn()
		render(
			<MobileDeleteConfirmPopup
				visible
				onClose={vi.fn()}
				title="删除项目"
				entityName="Demo"
				descriptionSuffix="后果说明"
				onConfirm={onConfirm}
				cancelAriaLabel="取消"
				confirmAriaLabel="确认"
				testIdPrefix="mobile-project-delete-confirm"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-project-delete-confirm-confirm"))
		expect(onConfirm).toHaveBeenCalledTimes(1)
	})
})
