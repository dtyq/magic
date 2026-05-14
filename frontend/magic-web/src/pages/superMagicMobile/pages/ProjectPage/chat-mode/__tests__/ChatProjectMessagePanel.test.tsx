import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatProjectMessagePanel } from "../ChatProjectMessagePanel"

const mockState = vi.hoisted(() => ({
	initialMessagesLoading: false,
	initialMessagesReady: true,
	projectStore: {
		selectedProject: {
			id: "project-1",
			project_name: "项目一",
		},
	},
	topicStore: {
		selectedTopic: {
			id: "topic-1",
			chat_topic_id: "chat-topic-1",
			topic_name: "会话一",
		},
	},
	superMagicStore: {
		messages: new Map<string, unknown[]>(),
	},
}))

vi.mock("react-i18next", async () => {
	const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next")

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: mockState.projectStore,
	topicStore: mockState.topicStore,
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: mockState.superMagicStore,
}))

vi.mock("@/stores/globalConfig", () => ({
	globalConfigStore: {
		globalConfig: {
			minimal_logo: "",
		},
	},
}))

vi.mock("@/styles/font", () => ({
	usePoppinsFont: () => undefined,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/pages/superMagicMobile/pages/shared/topicPageCapabilities", () => ({
	MobileTopicPageKind: {
		SingleTopicChat: "single-topic-chat",
	},
	getMobileTopicPageCapabilities: () => ({
		resolveBackTarget: () => "/super/chats",
	}),
}))

vi.mock("@/pages/superMagicMobile/pages/TopicPage", async () => {
	const React = await import("react")
	const MockTopicPage = ({
		onInitialMessagesLoadingChange,
		onInitialMessagesReadyChange,
	}: {
		onInitialMessagesLoadingChange?: (isLoading: boolean) => void
		onInitialMessagesReadyChange?: (isReady: boolean) => void
	}) => {
		React.useEffect(() => {
			onInitialMessagesLoadingChange?.(mockState.initialMessagesLoading)
			onInitialMessagesReadyChange?.(mockState.initialMessagesReady)
		}, [onInitialMessagesLoadingChange, onInitialMessagesReadyChange])

		return <div data-testid="mock-topic-page" />
	}

	return {
		__esModule: true,
		default: MockTopicPage,
	}
})

describe("ChatProjectMessagePanel", () => {
	beforeEach(() => {
		mockState.initialMessagesLoading = false
		mockState.initialMessagesReady = true
		mockState.projectStore.selectedProject = {
			id: "project-1",
			project_name: "项目一",
		}
		mockState.topicStore.selectedTopic = {
			id: "topic-1",
			chat_topic_id: "chat-topic-1",
			topic_name: "会话一",
		}
		mockState.superMagicStore.messages = new Map([["chat-topic-1", []]])
	})

	it("does not show the empty hero while initial history messages are loading", async () => {
		mockState.initialMessagesLoading = true
		mockState.initialMessagesReady = false

		render(<ChatProjectMessagePanel onOpenActions={vi.fn()} />)

		await waitFor(() => {
			expect(screen.queryByTestId("chat-project-empty-hero")).not.toBeInTheDocument()
		})
	})

	it("does not show the empty hero before initial history readiness is confirmed", async () => {
		mockState.initialMessagesLoading = false
		mockState.initialMessagesReady = false

		render(<ChatProjectMessagePanel onOpenActions={vi.fn()} />)

		await waitFor(() => {
			expect(screen.queryByTestId("chat-project-empty-hero")).not.toBeInTheDocument()
		})
	})

	it("shows the empty hero after initial loading finishes with no messages", async () => {
		mockState.initialMessagesReady = true

		render(<ChatProjectMessagePanel onOpenActions={vi.fn()} />)

		await waitFor(() => {
			expect(screen.getByTestId("chat-project-empty-hero")).toBeInTheDocument()
		})
	})
})
