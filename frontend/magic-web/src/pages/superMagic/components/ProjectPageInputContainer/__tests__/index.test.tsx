import { render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneEditorContext } from "../../MainInputContainer/components/editors/types"
import { TopicStore } from "../../../stores/core/topic"
import ProjectPageInputContainer from "../index"

const testState = vi.hoisted(() => ({
	desktopEditorContext: null as SceneEditorContext | null,
}))

vi.mock("@dtyq/magic-admin", () => ({
	AiModel: {
		ServiceProvider: {
			MicrosoftAzure: "microsoft-azure",
			OpenRouter: "open-router",
			DeepSeek: "deep-seek",
			DashScope: "dash-scope",
			Qwen: "qwen",
			Volcengine: "volcengine",
			VolcengineArk: "volcengine-ark",
			Tencent: "tencent",
			Baidu: "baidu",
			SCNet: "sc-net",
			Moonshot: "moonshot",
			BigModel: "big-model",
			MiniMax: "mini-max",
			SiliconFlow: "silicon-flow",
			Gemini: "gemini",
			Google: "google",
		},
		ServiceProviderUrl: {},
	},
	AiManageRoutes: {},
	PlatformPackageRoutes: {},
	RouteName: {
		Admin: "admin",
		AdminPlatformAIModel: "admin-platform-ai-model",
	},
	ServiceIcon: () => null,
	otherRoutes: [],
}))

vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("antd", async (importOriginal) => importOriginal<typeof import("antd")>())

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/models/user", async () => {
	const { observable } = await import("mobx")
	return {
		userStore: {
			user: observable({
				organizationCode: "organization-mock",
				userInfo: { user_id: "user-mock" },
			}),
		},
	}
})

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	default: {},
}))

vi.mock("@/pages/superMagic/components/TaskList", () => ({
	default: () => <div data-testid="task-list" />,
}))

vi.mock("@/pages/superMagic/components/MessagePanel/components/MessageQueue", () => ({
	default: () => <div data-testid="message-queue" />,
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		currentRole: "general",
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useTopicMode", () => ({
	default: () => ({
		topicMode: "general",
		setTopicMode: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue", () => ({
	default: () => ({
		queue: [],
		queueStats: {},
		editingQueueItem: null,
		removeFromQueue: vi.fn(),
		sendQueuedMessage: vi.fn(),
		startEditQueueItem: vi.fn(),
		cancelEditQueueItem: vi.fn(),
		addToQueue: vi.fn(),
		finishEditQueueItem: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/utils/preload", () => ({
	usePreload: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useTaskData", () => ({
	useTaskData: () => ({ taskData: null }),
}))

vi.mock("@/pages/superMagic/hooks/useTaskInterrupt", () => ({
	useTaskInterrupt: () => ({ handleInterrupt: vi.fn() }),
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/hooks", () => ({
	useSceneSelection: () => ({
		currentScene: null,
		shouldShowCurrentSceneBadge: false,
		shouldShowSceneControls: false,
	}),
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/stores", () => ({
	buildTopicInputScopeKey: (topicMode: string, topicId: string, agentCode: string) =>
		`${topicMode}:${topicId}:${agentCode}`,
	createSceneStateStore: () => ({
		resetState: vi.fn(),
		setInputScopeKey: vi.fn(),
	}),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModeConfigWithLegacy: () => ({ mode: { playbooks: [] } }),
		// Treat synthetic project modes as valid so the test only exercises context forwarding.
		isModeValid: () => true,
	},
}))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: () => false,
}))

vi.mock("../DesktopInputContainer", () => ({
	default: ({ editorContext }: { editorContext: SceneEditorContext }) => {
		testState.desktopEditorContext = editorContext
		return <div data-testid="desktop-input-container" />
	},
}))

vi.mock("@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer", () => ({
	default: () => <div data-testid="mobile-input-container" />,
}))

/** Creates isolated synthetic props for the project input context tests. */
function createProps(
	overrides: Partial<ComponentProps<typeof ProjectPageInputContainer>> = {},
): ComponentProps<typeof ProjectPageInputContainer> {
	return {
		messages: [],
		selectedProject: {
			id: "project-mock",
			project_mode: TopicMode.General,
		} as never,
		selectedTopic: {
			id: "topic-mock",
			project_id: "project-mock",
			topic_name: "",
			topic_mode: TopicMode.General,
		} as never,
		setSelectedTopic: vi.fn(),
		...overrides,
	}
}

describe("ProjectPageInputContainer scoped topic store", () => {
	beforeEach(() => {
		testState.desktopEditorContext = null
	})

	it("forwards the caller topic store into the scene editor context", () => {
		const scopedTopicStore = new TopicStore()

		render(<ProjectPageInputContainer {...createProps({ topicStore: scopedTopicStore })} />)

		expect(screen.getByTestId("desktop-input-container")).toBeInTheDocument()
		expect(testState.desktopEditorContext?.topicStore).toBe(scopedTopicStore)
	})

	it("keeps the topic store undefined when the caller relies on the global fallback", () => {
		render(<ProjectPageInputContainer {...createProps()} />)

		expect(screen.getByTestId("desktop-input-container")).toBeInTheDocument()
		expect(testState.desktopEditorContext?.topicStore).toBeUndefined()
	})

	it("forwards the recording-mode restriction into the scene editor context", () => {
		render(<ProjectPageInputContainer {...createProps({ allowRecordingMode: false })} />)

		expect(screen.getByTestId("desktop-input-container")).toBeInTheDocument()
		expect(testState.desktopEditorContext?.allowRecordingMode).toBe(false)
	})

	it("uses an explicit employee override for the editor context", () => {
		render(
			<ProjectPageInputContainer
				{...createProps({
					agentCode: "SMA-default-agent",
					showModeToggle: false,
				})}
			/>,
		)

		expect(testState.desktopEditorContext?.agentCode).toBe("SMA-default-agent")
		expect(testState.desktopEditorContext?.showModeToggle).toBe(false)
	})

	it("allows a locked composer to clear the historical topic employee", () => {
		render(<ProjectPageInputContainer {...createProps({ agentCode: null })} />)

		expect(testState.desktopEditorContext?.agentCode).toBeUndefined()
	})
})
