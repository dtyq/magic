import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import ChatHomeEditor from "../ChatHomeEditor"

const { mockEditorLayout, mockChatContext, mockDefaultSelection } = vi.hoisted(() => ({
	mockEditorLayout: vi.fn(),
	mockChatContext: vi.fn(),
	mockDefaultSelection: vi.fn(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("../../../../components/MainInputContainer/scenes/EditorLayout", () => ({
	default: (props: {
		mode?: TopicMode
		editorContext?: { topicMode?: TopicMode; agentCode?: string }
	}) => {
		mockEditorLayout(props)
		return <div data-testid="editor-layout" />
	},
}))

vi.mock("../../useChatHomeContext", () => ({
	useChatHomeContext: () => mockChatContext(),
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveDefaultAgentSelection: () => mockDefaultSelection(),
}))

describe("ChatHomeEditor", () => {
	it("hides employee selection upstream and uses the featured default employee", () => {
		mockChatContext.mockReturnValue({
			selectedProject: null,
			selectedTopic: null,
			topicMode: TopicMode.General,
		})
		mockDefaultSelection.mockReturnValue({
			modeIdentifier: "SMA_DEFAULT",
			topicPattern: TopicMode.CustomAgent,
			agentCode: "SMA_DEFAULT",
		})

		render(<ChatHomeEditor />)

		expect(screen.getByTestId("editor-layout")).toBeInTheDocument()
		expect(mockEditorLayout).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: TopicMode.CustomAgent,
				editorContext: expect.objectContaining({
					topicMode: TopicMode.CustomAgent,
					agentCode: "SMA_DEFAULT",
				}),
			}),
		)
	})
})
