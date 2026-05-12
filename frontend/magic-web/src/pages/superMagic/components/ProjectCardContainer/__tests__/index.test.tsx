import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockFetchProjects, mockGetProjectsByWorkspace, mockProjectCard } = vi.hoisted(() => {
	return {
		mockFetchProjects: vi.fn(),
		mockGetProjectsByWorkspace: vi.fn(),
		mockProjectCard: vi.fn((props: { onProjectMenuOpenChange?: (open: boolean) => void }) => (
			<button
				type="button"
				data-testid="project-card-menu-trigger"
				onClick={() => props.onProjectMenuOpenChange?.(true)}
			>
				open
			</button>
		)),
	}
})

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"collaborators.empty": "No collaborators",
				"workspace.unnamedWorkspace": "Unnamed Workspace",
			}

			return translations[key] ?? key
		},
	}),
}))

vi.mock("ahooks", () => ({
	useResponsive: () => ({
		md: true,
	}),
}))

vi.mock("../../ProjectCard", () => ({
	default: mockProjectCard,
}))

vi.mock("../../../layouts/MainLayout/hooks/useShareProject", () => ({
	useShareProject: () => ({
		openShareModal: vi.fn(),
		closeShareModal: vi.fn(),
		closeSimilarSharesDialog: vi.fn(),
		closeSuccessModal: vi.fn(),
		handleSelectSimilarShare: vi.fn(),
		handleCreateNewShare: vi.fn(),
		handleCancelShare: vi.fn(),
		handleEditShare: vi.fn(),
		shareModalOpen: false,
		defaultSelectedFileIds: [],
		editingResourceId: undefined,
		similarSharesInfo: null,
		shareSuccessInfo: null,
		isCheckingShare: false,
	}),
}))

vi.mock("@/stores/projectFiles", () => ({
	default: {
		workspaceFileTree: [],
		workspaceFilesList: [],
	},
}))

vi.mock("../../../constants", () => ({
	isOtherCollaborationProject: () => false,
}))

vi.mock("../../../utils/permission", () => ({
	isReadOnlyProject: () => true,
}))

vi.mock("../../../stores/core/project", () => ({
	default: {
		getProjectsByWorkspace: mockGetProjectsByWorkspace,
		receivedCollaborationProjects: [],
	},
}))

vi.mock("../../../services", () => ({
	default: {
		project: {
			fetchProjects: mockFetchProjects,
		},
		clearProjectAndTopicSelection: vi.fn(),
		route: {
			navigateToWorkspace: vi.fn(),
			navigateToHome: vi.fn(),
		},
	},
}))

import ProjectCardContainer from "../index"

describe("ProjectCardContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetProjectsByWorkspace.mockImplementation((workspaceId: string) => {
			if (workspaceId !== "ws-current") return []

			return [
				{
					id: "project-1",
					project_name: "Project One",
					workspace_id: "ws-current",
					workspace_name: "Workspace One",
					current_topic_id: "",
				},
			]
		})
	})

	it("falls back to selectedProject workspace when selectedWorkspace is missing", () => {
		render(
			<ProjectCardContainer
				selectedProject={
					{
						id: "project-1",
						project_name: "Project One",
						workspace_id: "ws-current",
						workspace_name: "Workspace One",
						current_topic_id: "",
					} as never
				}
				selectedWorkspace={null}
			/>,
		)

		const props = mockProjectCard.mock.calls.at(-1)?.[0] as {
			projectOptions: Array<{ id: string }>
		}
		expect(props.projectOptions).toEqual([
			expect.objectContaining({
				id: "project-1",
			}),
		])

		fireEvent.click(screen.getByTestId("project-card-menu-trigger"))

		expect(mockFetchProjects).toHaveBeenCalledWith({
			workspaceId: "ws-current",
			clearWhenNoProjects: false,
		})
	})

	it("prefers selectedProject workspace when selectedWorkspace is stale", () => {
		render(
			<ProjectCardContainer
				selectedProject={
					{
						id: "project-1",
						project_name: "Project One",
						workspace_id: "ws-current",
						workspace_name: "Workspace One",
						current_topic_id: "",
					} as never
				}
				selectedWorkspace={
					{
						id: "ws-stale",
						name: "Stale Workspace",
						current_project_id: "other-project",
						current_topic_id: "topic-1",
						is_archived: 0,
						project_count: 99,
						workspace_status: "waiting",
					} as never
				}
			/>,
		)

		const props = mockProjectCard.mock.calls.at(-1)?.[0] as {
			projectOptions: Array<{ id: string }>
		}
		expect(props.projectOptions).toEqual([
			expect.objectContaining({
				id: "project-1",
			}),
		])

		fireEvent.click(screen.getByTestId("project-card-menu-trigger"))

		expect(mockFetchProjects).toHaveBeenCalledWith({
			workspaceId: "ws-current",
			clearWhenNoProjects: false,
		})
	})
})
