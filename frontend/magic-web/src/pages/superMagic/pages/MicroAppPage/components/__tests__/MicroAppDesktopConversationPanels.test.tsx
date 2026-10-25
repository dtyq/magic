import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MicroAppDesktopConversationPanels from "../MicroAppDesktopConversationPanels"

const historyPanelMocks = vi.hoisted(() => ({
	props: null as Record<string, unknown> | null,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/components/MessageHeader", () => ({
	MessageHeaderTopicHistoryPanel: (props: Record<string, unknown>) => {
		historyPanelMocks.props = props
		return <div data-testid="message-header-topic-history-panel" />
	},
}))

vi.mock("../AppConversationPanel", () => ({
	default: () => <div data-testid="app-conversation-panel" />,
}))

vi.mock("@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle", () => ({
	default: () => null,
}))

const panelProps = {
	selectedProject: { id: "project-1", project_name: "Micro App" },
	topicStore: {},
	mentionPanelStore: {},
	projectFilesStore: {},
	topicActions: {},
	isMessagePanelCollapsed: false,
	isMessagePanelDragging: false,
	messagePanelWidthPx: 360,
	isTopicHistoryPanelOpen: true,
	onMessagePanelResizeStart: vi.fn(),
	onTerminalTopicStatusChange: vi.fn(),
	onToggleConversationPanel: vi.fn(),
	onExpandConversationPanel: vi.fn(),
	onToggleHistoryPanel: vi.fn(),
	onCloseHistoryPanel: vi.fn(),
	onSelectDetail: vi.fn(),
	onExpandCollapsedPanel: vi.fn(),
	showConversationLabel: "show",
} as never

describe("MicroAppDesktopConversationPanels", () => {
	it("hides topic mode icons while development is locked to micro-app mode", () => {
		render(<MicroAppDesktopConversationPanels {...panelProps} lockToMicroAppMode />)

		expect(historyPanelMocks.props?.hideTopicListModeIcon).toBe(true)
	})

	it("shows employee icons in the preview topic list", () => {
		render(<MicroAppDesktopConversationPanels {...panelProps} lockToMicroAppMode={false} />)

		expect(historyPanelMocks.props?.hideTopicListModeIcon).toBe(false)
	})
})
