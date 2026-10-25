import { render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectsPanel } from "../../ProjectsPanel"

const { getCollaborationProjects, viewModeState } = vi.hoisted(() => ({
	getCollaborationProjects: vi.fn(),
	viewModeState: { value: "grid" },
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"workspace.collaborationProjectsTitle": "共享工作区",
				"workspace.collaborationProjectsDesc": "共享工作区说明",
				"workspace.teamSharedWithMe": "共享给我",
				"workspace.sharedByMe": "我共享的",
				"workspace.projects": "项目",
				"project.searchProject": "搜索项目",
				"project.noProjects": "暂无项目",
			}
			return map[key] ?? key
		},
	}),
}))

vi.mock("antd", () => ({
	Tabs: ({
		items,
		"data-testid": dataTestId,
	}: {
		items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }>
		"data-testid"?: string
	}) => (
		<div data-testid={dataTestId}>
			{items.map((item) => (
				<section
					key={item.key}
					data-testid={`shared-workspace-dialog-tab-pane-${item.key}`}
				>
					<button type="button">{item.label}</button>
					{item.children}
				</section>
			))}
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/dialog", () => ({
	DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
		open ? <div>{children}</div> : null,
	DialogContent: ({
		children,
		className,
		"data-testid": dataTestId,
	}: React.HTMLAttributes<HTMLDivElement> & {
		"data-testid"?: string
		showCloseButton?: boolean
		onInteractOutside?: () => void
		onEscapeKeyDown?: () => void
	}) => (
		<div data-testid={dataTestId} className={className}>
			{children}
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({
		onClick,
		"data-testid": dataTestId,
	}: {
		onClick?: React.MouseEventHandler<HTMLButtonElement>
		"data-testid"?: string
	}) => (
		<button type="button" onClick={onClick} data-testid={dataTestId}>
			icon
		</button>
	),
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicEmpty", () => ({
	default: ({ description }: { description: React.ReactNode }) => <div>{description}</div>,
}))

vi.mock("@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem", () => ({
	default: ({
		project,
		"data-testid": dataTestId,
	}: {
		project: { id: string; project_name: string }
		"data-testid"?: string
	}) => <div data-testid={dataTestId}>{project.project_name}</div>,
	SortType: {
		PROJECT_UPDATE_TIME: "updated_at",
		MY_LAST_ACTIVE_TIME: "last_active_at",
		PROJECT_CREATE_TIME: "created_at",
	},
	ViewMode: {
		GRID: "grid",
		LIST: "list",
	},
}))

vi.mock(
	"@/pages/superMagic/components/WorkspacesMenu/components/CollaborationProjectsPanel/components",
	() => ({
		CreatorFilter: () => <button type="button">creator filter</button>,
		SortSelector: () => <button type="button">sort</button>,
		ViewToggle: () => <button type="button">view</button>,
	}),
)

vi.mock(
	"@/pages/superMagic/components/WorkspacesMenu/components/CollaborationProjectsPanel/components/ViewToggle/hooks",
	() => ({
		useViewTogglePersistValue: () => ({
			viewMode: viewModeState.value,
			setViewMode: vi.fn(),
		}),
	}),
)

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getCollaborationProjects,
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			isPersonalOrganization: false,
		},
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		project: {
			pinProject: vi.fn(),
			cancelWorkspaceShortcut: vi.fn(),
		},
	},
}))

vi.mock("@/pages/superMagic/services/routeManageService", () => ({
	default: {
		navigateToState: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel", () => ({
	default: () => ({
		openManageModal: vi.fn(),
		CollaboratorUpdatePanel: null,
	}),
}))

vi.mock(
	"@/pages/superMagic/components/WorkspacesMenu/components/AddCollaborationToWorkspaceModal/hooks/useAddCollaborationToWorkspaceModal",
	() => ({
		default: () => ({
			AddCollaborationToWorkspaceModal: null,
			onOpen: vi.fn(),
		}),
	}),
)

vi.mock("@/pages/superMagic/pages/Assistant/components/TopicPanel/hooks/useSearchValue", () => ({
	default: () => ({
		searchValue: "",
		onSearchValueChange: vi.fn(),
		debouncedSearchValue: "",
		setSearchValue: vi.fn(),
	}),
}))

describe("CollaborationProjectsPanel", () => {
	beforeEach(() => {
		getCollaborationProjects.mockReset()
		viewModeState.value = "grid"
	})

	it("adds stable data-testid attributes to the PC shared workspace dialog", async () => {
		const { default: CollaborationProjectsPanel } = await import("../index")

		getCollaborationProjects.mockResolvedValue({
			list: [{ id: "project-1", project_name: "项目一", is_pinned: false }],
		})

		render(
			<ProjectsPanel
				open
				title="项目管理器"
				searchValue=""
				onSearchValueChange={vi.fn()}
				onClose={vi.fn()}
			>
				<CollaborationProjectsPanel
					searchValue=""
					open
					workspaces={[]}
					selectedWorkspace={null}
					fetchProjects={vi.fn()}
					fetchWorkspaces={vi.fn()}
					onCollaborationProjectClick={vi.fn()}
					onClose={vi.fn()}
				/>
			</ProjectsPanel>,
		)

		await waitFor(() => expect(getCollaborationProjects).toHaveBeenCalled())

		expect(screen.getByTestId("shared-workspace-dialog")).not.toBeNull()
		expect(screen.getByTestId("shared-workspace-dialog-title")).toHaveTextContent("项目管理器")
		expect(screen.getByTestId("shared-workspace-dialog-search-input")).not.toBeNull()
		expect(screen.getByTestId("shared-workspace-dialog-close-button")).not.toBeNull()
		expect(screen.getByTestId("shared-workspace-dialog-tabs")).not.toBeNull()
		const projectLists = screen.getAllByTestId("shared-workspace-dialog-project-list")
		expect(projectLists).toHaveLength(2)

		const receivedList = projectLists.find(
			(list) => list.getAttribute("data-tab-type") === "received",
		)
		expect(receivedList).toBeTruthy()

		const row = within(receivedList as HTMLElement)
			.getAllByTestId("shared-workspace-dialog-project-item")
			.find((item) => item.getAttribute("data-project-id") === "project-1")

		expect(row).toBeTruthy()
		expect(within(row as HTMLElement).getByText("项目一")).not.toBeNull()
	})

	it("keeps breakpoint-based adaptive grid columns without horizontal overflow", async () => {
		const { default: CollaborationProjectsPanel } = await import("../index")

		getCollaborationProjects.mockResolvedValue({
			list: [{ id: "project-1", project_name: "项目一", is_pinned: false }],
		})

		render(
			<ProjectsPanel
				open
				title="项目管理器"
				searchValue=""
				onSearchValueChange={vi.fn()}
				onClose={vi.fn()}
			>
				<CollaborationProjectsPanel
					searchValue=""
					open
					workspaces={[]}
					selectedWorkspace={null}
					fetchProjects={vi.fn()}
					fetchWorkspaces={vi.fn()}
					onCollaborationProjectClick={vi.fn()}
					onClose={vi.fn()}
				/>
			</ProjectsPanel>,
		)

		await waitFor(() => expect(getCollaborationProjects).toHaveBeenCalled())

		const layout = screen.getAllByTestId("shared-workspace-dialog-project-list-layout")[0]
		expect(layout).toHaveAttribute("data-view-mode", "grid")
		expect(layout.className).toContain("repeat(auto-fill,minmax(min(100%,240px),1fr))")
		expect(layout.className).not.toContain("repeat(6,1fr)")
	})

	it("keeps the adaptive grid wrapper in list view", async () => {
		viewModeState.value = "list"
		const { default: CollaborationProjectsPanel } = await import("../index")

		getCollaborationProjects.mockResolvedValue({
			list: [{ id: "project-1", project_name: "项目一", is_pinned: false }],
		})

		render(
			<ProjectsPanel
				open
				title="项目管理器"
				searchValue=""
				onSearchValueChange={vi.fn()}
				onClose={vi.fn()}
			>
				<CollaborationProjectsPanel
					searchValue=""
					open
					workspaces={[]}
					selectedWorkspace={null}
					fetchProjects={vi.fn()}
					fetchWorkspaces={vi.fn()}
					onCollaborationProjectClick={vi.fn()}
					onClose={vi.fn()}
				/>
			</ProjectsPanel>,
		)

		await waitFor(() => expect(getCollaborationProjects).toHaveBeenCalled())

		const layout = screen.getAllByTestId("shared-workspace-dialog-project-list-layout")[0]
		expect(layout).toHaveAttribute("data-view-mode", "list")
		expect(layout.className).toContain("grid")
		expect(layout.className).toContain("grid-cols-1")
	})
})
