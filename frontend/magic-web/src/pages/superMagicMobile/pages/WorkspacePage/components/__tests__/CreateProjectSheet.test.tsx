import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CreateProjectSheet } from "../CreateProjectSheet"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: { maxLength?: number }) => {
				if (key === "project.createNewProject") return "创建新项目"
				if (key === "hierarchicalWorkspacePopup.name") return "名称"
				if (key === "hierarchicalWorkspacePopup.inputProjectName") return "请输入项目名称"
				if (key === "common.cancel") return "取消"
				if (key === "common.confirm") return "确认"
				if (key === "chat.nameMaxLengthTip") {
					return `名称长度不能超过 ${options?.maxLength || 100} 个字符`
				}
				return key
			},
		}),
	}
})

describe("CreateProjectSheet", () => {
	/**
	 * Verify that the input element has maxLength={100} enforced.
	 */
	it("renders an input with maxLength 100 and initial counter", () => {
		render(<CreateProjectSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const input = screen.getByTestId("workspace-project-create-sheet-input")
		expect(input).toBeInTheDocument()
		expect(input).toHaveAttribute("maxlength", "100")

		const counter = screen.getByTestId("workspace-project-create-sheet-char-count")
		expect(counter).toHaveTextContent("0/100")
	})

	/**
	 * Verify that typing updates the character counter and displays limit hint at 100 chars.
	 */
	it("updates character counter on input and shows limit reminder at boundary", () => {
		render(<CreateProjectSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const input = screen.getByTestId("workspace-project-create-sheet-input")
		fireEvent.change(input, { target: { value: "test-project" } })

		const counter = screen.getByTestId("workspace-project-create-sheet-char-count")
		expect(counter).toHaveTextContent("12/100")

		// Simulate boundary value of 100 characters
		const atLimitText = "a".repeat(100)
		fireEvent.change(input, { target: { value: atLimitText } })
		expect(counter).toHaveTextContent("100/100")
		expect(screen.getByText("名称长度不能超过 100 个字符")).toBeInTheDocument()
	})

	/**
	 * Verify that confirm button is disabled when empty or when input is over limit.
	 */
	it("disables confirm button when empty or over limit", () => {
		render(<CreateProjectSheet isOpen onClose={vi.fn()} onCreate={vi.fn()} />)

		const confirmButton = screen.getByTestId("workspace-project-create-sheet-confirm")
		expect(confirmButton).toBeDisabled()

		const input = screen.getByTestId("workspace-project-create-sheet-input")
		fireEvent.change(input, { target: { value: "   " } })
		expect(confirmButton).toBeDisabled()

		fireEvent.change(input, { target: { value: "a".repeat(101) } })
		expect(confirmButton).toBeDisabled()
	})

	/**
	 * Verify that onCreate is called with the trimmed name on valid submission.
	 */
	it("submits the trimmed project name when valid", async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined)
		render(<CreateProjectSheet isOpen onClose={vi.fn()} onCreate={onCreate} />)

		const input = screen.getByTestId("workspace-project-create-sheet-input")
		fireEvent.change(input, { target: { value: "  my-new-project  " } })

		const confirmButton = screen.getByTestId("workspace-project-create-sheet-confirm")
		expect(confirmButton).not.toBeDisabled()

		await act(async () => {
			fireEvent.click(confirmButton)
		})
		expect(onCreate).toHaveBeenCalledWith("my-new-project")
	})
})
