import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { ToolCallViewModel } from "../../../types"
import { sendAskUserToolReply } from "@/pages/superMagic/services/askUserToolReplyService"
import AskUserToolCall from ".."

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("@/models/user", () => ({
	userStore: {
		user: { i18n: "zh_CN", userInfo: { magic_id: "user", organization_code: "org" } },
	},
}))
vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({ isShareRoute: false }),
}))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { warning: vi.fn(), error: vi.fn(), destroy: vi.fn() },
}))
vi.mock(
	"@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/hooks/useToolTooltip",
	() => ({
		useToolTooltip: () => ({ renderTooltip: () => null }),
	}),
)
vi.mock(
	"@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext",
	async () => {
		const { useState } = await import("react")
		return { useMessageViewState: (_key: string, initial: boolean) => useState(initial) }
	},
)
vi.mock("@/pages/superMagic/services/askUserToolReplyService", () => ({
	sendAskUserToolReply: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/pages/superMagic/services/askUserBrowserNotificationService", () => ({
	clearAskUserV2BrowserNotification: vi.fn(),
}))
vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map([["topic", [{ super_message_id: "message" }]]]),
		getMessageNode: () => ({ task_id: "task", tool_calls: [{ id: "ask-call" }] }),
		subscribe: () => () => undefined,
	},
}))
vi.mock("@/pages/superMagic/components/MessageList/utils/AskUserMarkdownText", () => ({
	AskUserQuestionMarkdownTitle: ({ content }: { content: string }) => <span>{content}</span>,
}))

const topic = { chat_topic_id: "topic", chat_conversation_id: "conversation" } as Topic
const question = {
	sub_id: "bound-question-uuid",
	question: "Publish the reviewed skill?",
	interaction_type: "confirm",
	options: null,
	placeholder: null,
	min_select: null,
	max_select: null,
	default_value: null,
}
const tool: ToolCallViewModel = {
	id: "ask-call",
	name: "ask_user",
	action: "向用户提问",
	attachments: [],
	rawArguments: JSON.stringify({ prepared_tool_call_id: "prepare-call" }),
	detail: {
		type: "ask_user",
		data: { question_id: "ask-call", questions: [question], status: "pending", expires_at: 0 },
	},
}

describe("AskUserToolCall structured confirmation", () => {
	beforeEach(() => {
		localStorage.clear()
		vi.clearAllMocks()
	})

	it("renders a prepared confirmation and submits the bound question ID", async () => {
		render(<AskUserToolCall toolData={tool} selectedTopic={topic} loading />)

		expect(screen.getByText(question.question)).toBeInTheDocument()
		expect(screen.getAllByRole("radio")[0]).not.toBeChecked()
		expect(sendAskUserToolReply).not.toHaveBeenCalled()
		fireEvent.click(screen.getByText("是"))
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))

		await waitFor(() => expect(sendAskUserToolReply).toHaveBeenCalledOnce())
		expect(sendAskUserToolReply).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.objectContaining({
					question_id: "ask-call",
					answer: JSON.stringify({ "bound-question-uuid": "是" }),
				}),
			}),
		)
	})

	it("uses the server question instead of model text while preserving XML answer keys", async () => {
		const withXml = {
			...tool,
			rawArguments: JSON.stringify({
				questions: '<question type="input">Unreviewed text</question>',
			}),
		}
		render(<AskUserToolCall toolData={withXml} selectedTopic={topic} loading />)

		expect(screen.getByText(question.question)).toBeInTheDocument()
		expect(screen.queryByText("Unreviewed text")).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("是"))
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))
		await waitFor(() => expect(sendAskUserToolReply).toHaveBeenCalledOnce())
		expect(sendAskUserToolReply).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.objectContaining({ answer: JSON.stringify({ "q-0": "是" }) }),
			}),
		)
	})

	it("keeps XML streaming before the structured detail arrives", () => {
		const xml = '<question type="confirm">Continue with the draft?'
		const { rerender } = render(
			<AskUserToolCall
				toolData={{
					...tool,
					detail: undefined,
					rawArguments: JSON.stringify({ questions: xml }),
				}}
				loading
			/>,
		)
		expect(screen.getByText("Continue with the draft?")).toBeInTheDocument()
		expect(screen.getAllByRole("radio")[0]).toBeDisabled()
		rerender(
			<AskUserToolCall
				toolData={{
					...tool,
					detail: undefined,
					rawArguments: JSON.stringify({ questions: xml + "</question>" }),
				}}
				loading
			/>,
		)
		expect(screen.getAllByRole("radio")[0]).not.toBeDisabled()
	})

	it.each(["prepared", "xml"])(
		"renders %s history with UUID answers without sending again",
		(mode) => {
			render(
				<AskUserToolCall
					toolData={{
						...tool,
						rawArguments:
							mode === "xml"
								? JSON.stringify({
										questions:
											'<question type="confirm">Publish the reviewed skill?</question>',
									})
								: tool.rawArguments,
						detail: {
							...tool.detail,
							data: {
								...tool.detail?.data,
								status: "answered",
								answers: { "bound-question-uuid": "是" },
							},
						},
					}}
					selectedTopic={topic}
				/>,
			)
			expect(screen.getByText(question.question)).toBeInTheDocument()
			expect(screen.getAllByRole("radio")[0]).toBeChecked()
			expect(screen.queryByTestId("ask-user-v2-card-submit-button")).not.toBeInTheDocument()
			expect(sendAskUserToolReply).not.toHaveBeenCalled()
		},
	)

	it("preserves a draft entered through XML when structured questions arrive", () => {
		const inputTool = {
			...tool,
			rawArguments: JSON.stringify({
				questions:
					'<question type="input" placeholder="Details">Describe the task</question>',
			}),
		}
		const { rerender } = render(
			<AskUserToolCall
				toolData={{
					...inputTool,
					detail: { ...tool.detail, data: { ...tool.detail?.data, questions: [] } },
				}}
				selectedTopic={topic}
				loading
			/>,
		)
		fireEvent.change(screen.getByPlaceholderText("Details"), {
			target: { value: "Existing draft" },
		})
		rerender(
			<AskUserToolCall
				toolData={{
					...inputTool,
					detail: {
						...tool.detail,
						data: {
							...tool.detail?.data,
							questions: [
								{
									...question,
									question: "Describe the task",
									interaction_type: "input",
									placeholder: "Details",
								},
							],
						},
					},
				}}
				selectedTopic={topic}
				loading
			/>,
		)
		expect(screen.getByPlaceholderText("Details")).toHaveValue("Existing draft")
	})

	it("respects options and selection limits in structured questions", () => {
		render(
			<AskUserToolCall
				toolData={{
					...tool,
					detail: {
						...tool.detail,
						data: {
							...tool.detail?.data,
							questions: [
								{
									...question,
									interaction_type: "multi_select",
									options: ["A", "B", "C"],
									min_select: 2,
									max_select: 2,
								},
							],
						},
					},
				}}
				selectedTopic={topic}
				loading
			/>,
		)
		fireEvent.click(screen.getByText("A"))
		expect(
			screen.getByTestId("ask-user-v2-card-multi-select-hint-bound-question-uuid"),
		).toHaveTextContent(/2.*2/)
		fireEvent.click(screen.getByText("B"))
		expect(screen.getAllByRole("checkbox")[2]).toBeDisabled()
	})
	it("preserves input and remark when the first detail and cache key arrive", () => {
		const preview = {
			...tool,
			detail: undefined,
			rawArguments: JSON.stringify({
				questions:
					'<question type="input" placeholder="Details">Describe the task</question>',
			}),
		}
		const { rerender } = render(
			<AskUserToolCall toolData={preview} selectedTopic={topic} loading />,
		)
		fireEvent.change(screen.getByPlaceholderText("Details"), {
			target: { value: "Unsaved draft" },
		})
		fireEvent.change(screen.getByTestId("ask-user-v2-card-remark-input"), {
			target: { value: "Draft remark" },
		})
		rerender(
			<AskUserToolCall
				toolData={{
					...preview,
					detail: {
						...tool.detail,
						data: {
							...tool.detail?.data,
							questions: [
								{
									...question,
									question: "Describe the task",
									interaction_type: "input",
									placeholder: "Details",
								},
							],
						},
					},
				}}
				selectedTopic={topic}
				loading
			/>,
		)
		expect(screen.getByPlaceholderText("Details")).toHaveValue("Unsaved draft")
		expect(screen.getByTestId("ask-user-v2-card-remark-input")).toHaveValue("Draft remark")
	})

	it("renders all repaired questions and submits all position answers", async () => {
		const questions = [
			question,
			{
				...question,
				sub_id: "choice-a",
				question: "First choice",
				interaction_type: "select",
				options: ["A", "B", "Other"],
			},
			{
				...question,
				sub_id: "choice-b",
				question: "Second choice",
				interaction_type: "select",
				options: ["C", "D", "Other"],
			},
		]
		render(
			<AskUserToolCall
				toolData={{
					...tool,
					rawArguments: JSON.stringify({
						questions:
							'<question type="confirm">Continue?</question><question type="select">First choice<option>A</option><option>B</option></select><question type="select">Second choice<option>C</option><option>D</option></select></questions>',
					}),
					detail: { ...tool.detail, data: { ...tool.detail?.data, questions } },
				}}
				selectedTopic={topic}
				loading
			/>,
		)
		expect(screen.getByText("Second choice")).toBeInTheDocument()
		fireEvent.click(screen.getByText("D"))
		fireEvent.click(screen.getByText("是"))
		fireEvent.click(screen.getByText("B"))
		expect(screen.getByTestId("ask-user-v2-card-submit-button")).not.toBeDisabled()
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))
		await waitFor(() => expect(sendAskUserToolReply).toHaveBeenCalledOnce())
		expect(sendAskUserToolReply).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.objectContaining({
					answer: JSON.stringify({ "q-0": "是", "q-1": "B", "q-2": "D" }),
				}),
			}),
		)
	})

	it.each(["select", "multi_select"])(
		"normalizes reserved Other for %s defaults and answer display",
		(type) => {
			render(
				<AskUserToolCall
					toolData={{
						...tool,
						detail: {
							...tool.detail,
							data: {
								...tool.detail?.data,
								status: "answered",
								questions: [
									{
										...question,
										interaction_type: type,
										options: ["A", "Other"],
										default_value: "Other",
									},
								],
								answers: {
									"bound-question-uuid":
										type === "select"
											? "Custom answer"
											: ["A", "Custom answer"],
								},
							},
						},
					}}
					selectedTopic={topic}
				/>,
			)
			expect(screen.queryByText("Other")).not.toBeInTheDocument()
			expect(screen.getByDisplayValue("Custom answer")).toBeInTheDocument()
		},
	)

	it("hides answer controls for an input error text detail", () => {
		render(
			<AskUserToolCall
				toolData={{
					...tool,
					status: "error",
					rawArguments: JSON.stringify({
						questions: '<question type="confirm">Preview?</question>',
					}),
					detail: {
						type: "text",
						data: { message: "Mock localized input failure" },
					},
				}}
				selectedTopic={topic}
			/>,
		)
		expect(screen.getByText("Mock localized input failure")).toBeInTheDocument()
		expect(screen.queryByTestId("ask-user-v2-card-submit-button")).not.toBeInTheDocument()
	})
	it.each(["select", "multi_select"])(
		"uses one Other input and submits custom %s text",
		async (type) => {
			render(
				<AskUserToolCall
					toolData={{
						...tool,
						detail: {
							...tool.detail,
							data: {
								...tool.detail?.data,
								questions: [
									{
										...question,
										interaction_type: type,
										options: ["A", "Other"],
										default_value: "Other",
									},
								],
							},
						},
					}}
					selectedTopic={topic}
					loading
				/>,
			)
			expect(screen.queryByText("Other")).not.toBeInTheDocument()
			const prefix = type === "select" ? "select" : "multi-select"
			const input = screen.getByTestId(
				`ask-user-v2-card-${prefix}-other-input-bound-question-uuid`,
			)
			fireEvent.focus(input)
			fireEvent.change(input, { target: { value: "Mock custom text" } })
			fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))
			await waitFor(() => expect(sendAskUserToolReply).toHaveBeenCalledOnce())
			expect(sendAskUserToolReply).toHaveBeenCalledWith(
				expect.objectContaining({
					detail: expect.objectContaining({
						answer: JSON.stringify({
							"bound-question-uuid":
								type === "select" ? "Mock custom text" : ["Mock custom text"],
						}),
					}),
				}),
			)
		},
	)
})
