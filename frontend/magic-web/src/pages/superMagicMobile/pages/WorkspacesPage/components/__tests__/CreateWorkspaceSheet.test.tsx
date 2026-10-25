import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CreateWorkspaceSheet } from "../CreateWorkspaceSheet"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: { maxLength?: number }) => {
				if (key === "workspace.createWorkspaceSheetTitle") return "创建新工作区"
				if (key === "workspace.workspaceNameLabel") return "工作区名称"
				if (key === "workspace.createWorkspaceTip") return "请输入工作区名称"
				if (key === "common.cancel") return "取消"
				if (key === "common.confirm") return "确认"
				if (key === "chat.nameMaxLengthTip") {
					return `名称长度不能超过 ${options?.maxLength || 50} 个字符`
				}
				return key
			},
		}),
	}
})

describe("CreateWorkspaceSheet", () => {
	/**
	 * Verify that the input element has maxLength={50} enforced and char counter is initialized.
	 */
	it("renders an input with maxLength 50 and initial counter", () => {
		render(<CreateWorkspaceSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const input = screen.getByTestId("workspace-create-sheet-input")
		expect(input).toBeInTheDocument()
		expect(input).toHaveAttribute("maxlength", "50")

		const counter = screen.getByTestId("workspace-create-sheet-char-count")
		expect(counter).toHaveTextContent("0/50")
	})

	/**
	 * Verify that typing updates the character counter and displays limit reminder at 50 chars.
	 */
	it("updates character counter on input and shows limit reminder at boundary", () => {
		render(<CreateWorkspaceSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const input = screen.getByTestId("workspace-create-sheet-input")
		fireEvent.change(input, { target: { value: "test-workspace" } })

		const counter = screen.getByTestId("workspace-create-sheet-char-count")
		expect(counter).toHaveTextContent("14/50")

		// Simulate boundary value of 50 characters
		const atLimitText = "w".repeat(50)
		fireEvent.change(input, { target: { value: atLimitText } })
		expect(counter).toHaveTextContent("50/50")
		expect(screen.getByText("名称长度不能超过 50 个字符")).toBeInTheDocument()
	})

	/**
	 * Verify that confirm button is disabled when empty or when input is over limit.
	 */
	it("disables confirm button when empty or over limit", () => {
		render(<CreateWorkspaceSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const confirmButton = screen.getByTestId("workspace-create-sheet-confirm")
		expect(confirmButton).toBeDisabled()

		const input = screen.getByTestId("workspace-create-sheet-input")
		fireEvent.change(input, { target: { value: "   " } })
		expect(confirmButton).toBeDisabled()

		fireEvent.change(input, { target: { value: "w".repeat(51) } })
		expect(confirmButton).toBeDisabled()
	})

	/**
	 * Verify that onCreate is called with the trimmed name on valid submission.
	 */
	it("submits the trimmed workspace name when valid", async () => {
		const handleCreate = vi.fn().mockResolvedValue(undefined)
		render(<CreateWorkspaceSheet isOpen onClose={vi.fn()} onCreate={handleCreate} />)

		const input = screen.getByTestId("workspace-create-sheet-input")
		fireEvent.change(input, { target: { value: "  new-workspace  " } })

		const confirmButton = screen.getByTestId("workspace-create-sheet-confirm")
		expect(confirmButton).not.toBeDisabled()

		await act(async () => {
			fireEvent.click(confirmButton)
		})

		expect(handleCreate).toHaveBeenCalledWith("new-workspace")
	})
})
