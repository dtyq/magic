import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import InterviewConversation from "../components/InterviewConversation"

const { chat } = vi.hoisted(() => ({
	chat: {
		storageKey: "test-chat",
		draft: "a follow-up",
		pending: undefined as { question: string; id: string } | undefined,
		status: "queued",
		failed: false,
		canRetry: false,
		submitting: false,
		send: vi.fn(),
		setDraft: vi.fn(),
	},
}))
vi.mock("../hooks/useInterviewChat", () => ({ useInterviewChat: () => chat }))
vi.mock("../components/PersonaAvatar", () => ({ default: () => <span /> }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const props = {
	transcript: {
		schema_version: 1 as const,
		persona_id: "p1",
		status: "done" as const,
		rounds: [],
	},
	name: "Respondent",
	isMobile: false,
	onSend: vi.fn(),
	onShowProgress: vi.fn(),
	children: <p>Existing interview</p>,
}

beforeEach(() => {
	chat.pending = undefined
	chat.send.mockClear()
	sessionStorage.clear()
})

describe("interview chat input", () => {
	it("sends Enter but preserves IME confirmation and Shift+Enter", () => {
		render(<InterviewConversation {...props} />)
		const input = screen.getByRole("textbox", { name: "interviewChat.label" })
		fireEvent.keyDown(input, { key: "Enter", isComposing: true })
		fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
		expect(chat.send).not.toHaveBeenCalled()
		fireEvent.keyDown(input, { key: "Enter" })
		expect(chat.send).toHaveBeenCalledTimes(1)
	})
	it("uses the send button on mobile and leaves Enter available for new lines", () => {
		render(<InterviewConversation {...props} isMobile />)
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
		expect(chat.send).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole("button", { name: "interviewChat.send" }))
		expect(chat.send).toHaveBeenCalledTimes(1)
	})
	it("keeps the submitted question visible and prevents another send while awaiting its answer", () => {
		chat.pending = { id: "request", question: "submitted question" }
		render(<InterviewConversation {...props} />)
		expect(screen.getByText("submitted question")).toBeTruthy()
		expect(
			screen.getByRole("button", { name: "interviewChat.send" }).hasAttribute("disabled"),
		).toBe(true)
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
		expect(chat.send).not.toHaveBeenCalled()
	})
})
