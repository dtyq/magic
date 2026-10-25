import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import RenameModal from "../index"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: { maxLength?: number }) => {
				if (key === "chat.nameMaxLengthTip") {
					return `名称长度不能超过 ${options?.maxLength || 100} 个字符`
				}
				return key
			},
		}),
	}
})

const defaultTranslations = {
	workspaceRename: "工作区重命名",
	projectRename: "项目重命名",
	topicRename: "话题重命名",
	inputWorkspaceName: "请输入工作区名称",
	inputProjectName: "请输入项目名称",
	inputTopicName: "请输入话题名称",
	newName: "新名称",
	projectNameLabel: "项目名称",
	cancel: "取消",
	confirm: "确认",
}

describe("RenameModal", () => {
	/**
	 * Verify that topic rename has maxLength 100 and shows character counter.
	 */
	it("enforces maxLength 100 for topic rename and displays character count", () => {
		render(
			<RenameModal
				visible
				currentActionItem={{
					type: "topic",
					topic: { id: "mock-t1", topic_name: "test-topic" } as never,
				}}
				onCancel={vi.fn()}
				onOk={vi.fn()}
				onInputChange={vi.fn()}
				translations={defaultTranslations}
			/>,
		)

		const input = screen.getByPlaceholderText("请输入话题名称")
		expect(input).toBeInTheDocument()
		expect(input).toHaveAttribute("maxlength", "100")

		const counter = screen.getByTestId("rename-modal-char-count")
		expect(counter).toHaveTextContent("10/100")
	})

	/**
	 * Verify that workspace rename has maxLength 50.
	 */
	it("enforces maxLength 50 for workspace rename", () => {
		render(
			<RenameModal
				visible
				currentActionItem={{
					type: "workspace",
					workspace: { id: "mock-w1", name: "test-workspace" } as never,
				}}
				onCancel={vi.fn()}
				onOk={vi.fn()}
				onInputChange={vi.fn()}
				translations={defaultTranslations}
			/>,
		)

		const input = screen.getByPlaceholderText("请输入工作区名称")
		expect(input).toBeInTheDocument()
		expect(input).toHaveAttribute("maxlength", "50")

		const counter = screen.getByTestId("rename-modal-char-count")
		expect(counter).toHaveTextContent("14/50")
	})

	/**
	 * Verify that confirm button is disabled when over limit and tip is rendered.
	 */
	it("disables confirm button and renders tip when input reaches or exceeds limit", () => {
		const handleOk = vi.fn()
		render(
			<RenameModal
				visible
				currentActionItem={{
					type: "topic",
					topic: { id: "mock-t1", topic_name: "a".repeat(100) } as never,
				}}
				onCancel={vi.fn()}
				onOk={handleOk}
				onInputChange={vi.fn()}
				translations={defaultTranslations}
			/>,
		)

		expect(screen.getByText("名称长度不能超过 100 个字符")).toBeInTheDocument()
		const confirmButton = screen.getByText("确认")
		expect(confirmButton).not.toBeDisabled()

		// When over limit
		render(
			<RenameModal
				visible
				currentActionItem={{
					type: "topic",
					topic: { id: "mock-t1", topic_name: "a".repeat(101) } as never,
				}}
				onCancel={vi.fn()}
				onOk={handleOk}
				onInputChange={vi.fn()}
				translations={defaultTranslations}
			/>,
		)

		const allConfirmButtons = screen.getAllByText("确认")
		expect(allConfirmButtons[allConfirmButtons.length - 1]).toBeDisabled()
	})
})
