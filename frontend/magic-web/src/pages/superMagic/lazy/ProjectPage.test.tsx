import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "../pages/Workspace/types"
import ProjectPage from "./ProjectPage"

const mockState = vi.hoisted(() => ({
	projectId: "project-1",
	isMobile: true,
	projectStore: {
		selectedProject: null as {
			id: string
			workspace_id: string
			project_mode: TopicMode | ""
			user_role?: string
		} | null,
	},
	topicStore: {
		selectedTopic: null,
		topics: [],
	},
	getProjectDetail: vi.fn(),
	fetchTopics: vi.fn(),
	getCachedChatWorkspaceId: vi.fn<() => string | null>(),
	ensureChatWorkspaceId: vi.fn<() => Promise<string | null>>(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("react-router", () => ({
	useParams: () => ({
		projectId: mockState.projectId,
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mockState.isMobile,
}))

vi.mock("@/routes/components/Navigate", () => ({
	__esModule: true,
	default: ({ name, params }: { name: string; params?: { projectId?: string } }) => (
		<div data-testid="navigate-target">{`${name}:${params?.projectId ?? ""}`}</div>
	),
}))

vi.mock("../stores/core", () => ({
	projectStore: mockState.projectStore,
	topicStore: mockState.topicStore,
}))

vi.mock("../services", () => ({
	__esModule: true,
	default: {
		project: {
			getProjectDetail: mockState.getProjectDetail,
		},
		topic: {
			fetchTopics: mockState.fetchTopics,
		},
	},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	getCachedChatWorkspaceId: () => mockState.getCachedChatWorkspaceId(),
	ensureChatWorkspaceId: () => mockState.ensureChatWorkspaceId(),
}))

vi.mock("../utils/permission", () => ({
	isOwner: () => false,
	isReadOnlyProject: () => false,
}))

vi.mock("./skeleton/ProjectPageDesktopSkeleton", () => ({
	__esModule: true,
	default: () => <div data-testid="desktop-skeleton" />,
}))

vi.mock("./skeleton/ProjectPageMobileSkeleton", () => ({
	__esModule: true,
	default: () => <div data-testid="mobile-skeleton" />,
}))

vi.mock("@/pages/superMagic/pages/ProjectPage/index.desktop", () => ({
	__esModule: true,
	default: () => <div data-testid="desktop-project-page" />,
}))

vi.mock("@/pages/superMagicMobile/pages/ProjectPage", () => ({
	__esModule: true,
	default: () => <div data-testid="mobile-project-page" />,
}))

describe("ProjectPage", () => {
	beforeEach(() => {
		mockState.projectId = "project-1"
		mockState.isMobile = true
		mockState.projectStore.selectedProject = null
		mockState.topicStore.selectedTopic = null
		mockState.topicStore.topics = []
		mockState.getProjectDetail.mockReset()
		mockState.fetchTopics.mockReset()
		mockState.getCachedChatWorkspaceId.mockReset()
		mockState.ensureChatWorkspaceId.mockReset()
		mockState.getCachedChatWorkspaceId.mockReturnValue("chat-workspace-1")
		mockState.ensureChatWorkspaceId.mockResolvedValue("chat-workspace-1")
	})

	it("redirects mobile chat projects from project route to chat route when workspace_id matches chat workspace", () => {
		mockState.projectStore.selectedProject = {
			id: "project-1",
			workspace_id: "chat-workspace-1",
			project_mode: TopicMode.General,
		}

		render(<ProjectPage />)

		expect(screen.getByTestId("navigate-target")).toHaveTextContent(
			"SuperChatProjectState:project-1",
		)
		expect(mockState.fetchTopics).not.toHaveBeenCalled()
		expect(mockState.ensureChatWorkspaceId).not.toHaveBeenCalled()
	})

	it("renders the mobile project page for non-chat projects", async () => {
		mockState.projectStore.selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
			project_mode: TopicMode.General,
		}

		render(<ProjectPage />)

		expect(await screen.findByTestId("mobile-project-page")).toBeInTheDocument()
	})

	it("resolves chat workspace id once when cache is empty before redirecting", async () => {
		mockState.getCachedChatWorkspaceId.mockReturnValue(null)
		mockState.ensureChatWorkspaceId.mockResolvedValue("chat-workspace-1")
		mockState.projectStore.selectedProject = {
			id: "project-1",
			workspace_id: "chat-workspace-1",
			project_mode: TopicMode.General,
		}

		render(<ProjectPage />)

		expect(await screen.findByTestId("navigate-target")).toHaveTextContent(
			"SuperChatProjectState:project-1",
		)
		expect(mockState.ensureChatWorkspaceId).toHaveBeenCalledTimes(1)
		expect(mockState.fetchTopics).not.toHaveBeenCalled()
	})
})
