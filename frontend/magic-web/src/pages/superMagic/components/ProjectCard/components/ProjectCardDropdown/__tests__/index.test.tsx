import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockFetchWorkspaces, mockLoadProjectsForWorkspace, projectStoreMock, workspaceStoreMock } =
	vi.hoisted(() => {
		const projectsByWorkspace = new Map<string, Array<{ id: string; project_name: string }>>()

		return {
			mockFetchWorkspaces: vi.fn().mockResolvedValue([]),
			mockLoadProjectsForWorkspace: vi.fn(async (workspaceId: string) => {
				if (workspaceId === "ws-2") {
					projectsByWorkspace.set("ws-2", [
						{
							id: "project-2",
							project_name: "Project Two",
						},
					])
				}
			}),
			projectStoreMock: {
				getProjectsByWorkspace: vi.fn((workspaceId: string) => {
					return projectsByWorkspace.get(workspaceId) ?? []
				}),
				isLoadingWorkspace: vi.fn(() => false),
				loadProjectsForWorkspace: vi.fn(async (workspaceId: string) => {
					if (workspaceId === "ws-2") {
						projectsByWorkspace.set("ws-2", [
							{
								id: "project-2",
								project_name: "Project Two",
							},
						] as never[])
					}

					return mockLoadProjectsForWorkspace(workspaceId)
				}),
			},
			workspaceStoreMock: {
				workspaces: [] as Array<{ id: string; name: string }>,
			},
		}
	})

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: Record<string, unknown>) => {
				if (key === "workspace.allWorkspaceTitle") return "All Workspace"

				const translations: Record<string, string> = {
					"assistant.backToWorkspace": "Back to Workspace",
					"common.loading": "Loading",
					"project.addProject": "Add Project",
					"project.noProjects": "No Projects",
					"workspace.addWorkspace": "New Workspace",
					"workspace.createWorkspaceTip": "New Workspace Name",
					"workspace.unnamedWorkspace": "Unnamed Workspace",
					"workspace.workspaceList": "Workspace List",
				}

				return translations[key] ?? key
			},
		}),
	}
})

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
}))

vi.mock("framer-motion", () => ({
	AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
	motion: {
		div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
			<div {...props}>{children}</div>
		),
	},
}))

vi.mock("@/layouts/BaseLayout/components/MagicSidebar/CollapsedWorkspaceProjectRow", () => ({
	default: ({
		project,
		onSelectProject,
	}: {
		project: { id: string; project_name: string }
		onSelectProject: (project: { id: string; project_name: string }) => void
	}) => (
		<button
			type="button"
			onClick={() => onSelectProject(project)}
			data-testid={`collapsed-workspace-project-row-${project.id}`}
		>
			{project.project_name}
		</button>
	),
}))

vi.mock("@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateProjectInput", () => ({
	default: ({ workspaceId }: { workspaceId: string }) => (
		<div data-testid={`create-project-input-${workspaceId}`}>Create Project Input</div>
	),
}))

vi.mock("@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateWorkspaceInput", () => ({
	default: () => <div data-testid="sidebar-create-workspace-input">Create Workspace Input</div>,
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/components/MessageHeader/components/StatusIcon", () => ({
	default: () => <div data-testid="workspace-status-icon" />,
}))

vi.mock("@/pages/superMagic/hooks/useWorkspaceActionMenu", () => ({
	useWorkspaceActionMenu: () => ({
		menuProps: {
			items: [],
			trigger: ["click"],
			placement: "right",
		},
		nodes: null,
	}),
}))

vi.mock("@/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete", () => ({
	useWorkspaceDelete: () => ({
		openDeleteModal: vi.fn(),
		renderDeleteModal: () => null,
	}),
}))

vi.mock("@/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename", () => ({
	useWorkspaceRename: () => ({
		openRenameModal: vi.fn(),
		renderRenameModal: () => null,
	}),
}))

vi.mock("@/pages/superMagic/utils/project", () => ({
	openProjectInNewTab: vi.fn(),
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		workspace: {
			fetchWorkspaces: mockFetchWorkspaces,
		},
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: projectStoreMock,
	workspaceStore: workspaceStoreMock,
}))

import ProjectCardDropdown from "../index"

describe("ProjectCardDropdown", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		workspaceStoreMock.workspaces = [
			{ id: "ws-1", name: "Workspace One" },
			{ id: "ws-2", name: "Workspace Two" },
		] as never[]
		projectStoreMock.getProjectsByWorkspace.mockImplementation((workspaceId: string) => {
			if (workspaceId === "ws-2") {
				return [
					{
						id: "project-2",
						project_name: "Project Two",
					},
				]
			}

			return []
		})
	})

	it("switches workspace view without selecting a project and selects only after project click", async () => {
		const handleProjectClick = vi.fn()
		const onClose = vi.fn()

		render(
			<ProjectCardDropdown
				isExpanded
				enableWorkspaceNavigation
				onClose={onClose}
				selectedProject={
					{
						id: "project-1",
						project_name: "Project One",
						workspace_id: "ws-1",
						workspace_name: "Workspace One",
						current_topic_id: "",
					} as never
				}
				projectOptions={
					[
						{
							id: "project-1",
							project_name: "Project One",
							workspace_id: "ws-1",
							workspace_name: "Workspace One",
							current_topic_id: "",
						},
					] as never[]
				}
				showCreateProject
				actionWorkspace={
					{
						id: "ws-1",
						name: "Workspace One",
						current_project_id: "project-1",
						current_topic_id: "",
						is_archived: 0,
						project_count: 1,
						workspace_status: "waiting",
					} as never
				}
				projectMenuContentRef={{ current: null }}
				handleProjectClick={handleProjectClick}
			/>,
		)

		expect(screen.getByTestId("project-card-dropdown-project-header")).toBeInTheDocument()
		expect(screen.getByText("Workspace One")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("project-card-dropdown-back-button"))

		expect(screen.getByTestId("project-card-dropdown-workspace-view")).toBeInTheDocument()
		expect(screen.getByText("All Workspace")).toBeInTheDocument()

		fireEvent.click(await screen.findByTestId("project-card-dropdown-workspace-item-ws-2"))

		expect(handleProjectClick).not.toHaveBeenCalled()
		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenCalledWith("ws-2")
		expect(screen.getByText("Workspace Two")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("collapsed-workspace-project-row-project-2"))

		expect(handleProjectClick).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "project-2",
			}),
		)
		expect(onClose).toHaveBeenCalled()
	})

	it("renders figma workspace view structure with create entry and workspace actions", async () => {
		render(
			<ProjectCardDropdown
				isExpanded
				enableWorkspaceNavigation
				onClose={vi.fn()}
				selectedProject={
					{
						id: "project-1",
						project_name: "Project One",
						workspace_id: "ws-1",
						workspace_name: "Workspace One",
						current_topic_id: "",
					} as never
				}
				projectOptions={
					[
						{
							id: "project-1",
							project_name: "Project One",
							workspace_id: "ws-1",
							workspace_name: "Workspace One",
							current_topic_id: "",
						},
					] as never[]
				}
				showCreateProject
				actionWorkspace={
					{
						id: "ws-1",
						name: "Workspace One",
						current_project_id: "project-1",
						current_topic_id: "",
						is_archived: 0,
						project_count: 1,
						workspace_status: "waiting",
					} as never
				}
				projectMenuContentRef={{ current: null }}
				handleProjectClick={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("project-card-dropdown-back-button"))

		expect(screen.getByTestId("project-card-dropdown-workspace-view")).toBeInTheDocument()
		expect(
			screen.getByTestId("project-card-dropdown-create-workspace-button"),
		).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("project-card-dropdown-create-workspace-button"))

		expect(screen.getByTestId("sidebar-create-workspace-input")).toBeInTheDocument()
		expect(
			await screen.findByTestId("project-card-dropdown-workspace-action-button-ws-1"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("project-card-dropdown-workspace-action-button-ws-2"),
		).toBeInTheDocument()
	})

	it("renders projects after async workspace cache is populated", async () => {
		const deferredProjectsByWorkspace = new Map<
			string,
			Array<{ id: string; project_name: string }>
		>()
		projectStoreMock.getProjectsByWorkspace.mockImplementation((workspaceId: string) => {
			return deferredProjectsByWorkspace.get(workspaceId) ?? []
		})

		projectStoreMock.loadProjectsForWorkspace.mockResolvedValue(undefined)

		const props = {
			isExpanded: true,
			enableWorkspaceNavigation: true,
			onClose: vi.fn(),
			selectedProject: {
				id: "project-1",
				project_name: "Project One",
				workspace_id: "ws-1",
				workspace_name: "Workspace One",
				current_topic_id: "",
			} as never,
			projectOptions: [
				{
					id: "project-1",
					project_name: "Project One",
					workspace_id: "ws-1",
					workspace_name: "Workspace One",
					current_topic_id: "",
				},
			] as never[],
			showCreateProject: true,
			actionWorkspace: {
				id: "ws-1",
				name: "Workspace One",
				current_project_id: "project-1",
				current_topic_id: "",
				is_archived: 0,
				project_count: 1,
				workspace_status: "waiting",
			} as never,
			projectMenuContentRef: { current: null },
			handleProjectClick: vi.fn(),
		}

		const { rerender } = render(<ProjectCardDropdown {...props} />)

		fireEvent.click(screen.getByTestId("project-card-dropdown-back-button"))
		fireEvent.click(await screen.findByTestId("project-card-dropdown-workspace-item-ws-2"))

		expect(projectStoreMock.loadProjectsForWorkspace).toHaveBeenCalledWith("ws-2")
		expect(screen.getByTestId("project-card-dropdown-projects-empty")).toBeInTheDocument()

		deferredProjectsByWorkspace.set("ws-2", [
			{
				id: "project-2",
				project_name: "Project Two",
			},
		] as never[])
		rerender(<ProjectCardDropdown {...props} />)

		expect(screen.getByTestId("collapsed-workspace-project-row-project-2")).toBeInTheDocument()
	})

	it("renders running status icon for the active workspace in workspace view", async () => {
		workspaceStoreMock.workspaces = [
			{ id: "ws-1", name: "Workspace One", workspace_status: "running" },
			{ id: "ws-2", name: "Workspace Two", workspace_status: "waiting" },
		] as never[]

		render(
			<ProjectCardDropdown
				isExpanded
				enableWorkspaceNavigation
				onClose={vi.fn()}
				selectedProject={
					{
						id: "project-1",
						project_name: "Project One",
						workspace_id: "ws-1",
						workspace_name: "Workspace One",
						current_topic_id: "",
					} as never
				}
				projectOptions={
					[
						{
							id: "project-1",
							project_name: "Project One",
							workspace_id: "ws-1",
							workspace_name: "Workspace One",
							current_topic_id: "",
						},
					] as never[]
				}
				showCreateProject
				actionWorkspace={
					{
						id: "ws-1",
						name: "Workspace One",
						current_project_id: "project-1",
						current_topic_id: "",
						is_archived: 0,
						project_count: 1,
						workspace_status: "running",
					} as never
				}
				projectMenuContentRef={{ current: null }}
				handleProjectClick={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("project-card-dropdown-back-button"))

		expect(
			within(
				await screen.findByTestId("project-card-dropdown-workspace-item-ws-1"),
			).getByTestId("workspace-status-icon"),
		).toBeInTheDocument()
	})
})
