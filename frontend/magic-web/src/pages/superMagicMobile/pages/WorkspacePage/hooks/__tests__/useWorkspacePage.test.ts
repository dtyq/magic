import { act, renderHook, waitFor } from "@testing-library/react"
import { runInAction } from "mobx"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	ProjectStatus,
	TopicMode,
	type ProjectListItem,
	type Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { useWorkspacePage } from "../useWorkspacePage"

const getProjectsMock = vi.fn()
const navigateMock = vi.fn()

let routeWorkspaceId = "workspace-a"

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_status: overrides.project_status ?? ProjectStatus.WAITING,
		project_mode: overrides.project_mode ?? TopicMode.Empty,
		workspace_id: overrides.workspace_id ?? "workspace-a",
		work_dir: overrides.work_dir ?? "",
		workspace_name: overrides.workspace_name ?? "Workspace A",
		project_name: overrides.project_name ?? "Project A",
		current_topic_id: overrides.current_topic_id ?? "",
		current_topic_status: overrides.current_topic_status ?? "",
		created_at: overrides.created_at ?? "2026-05-29 10:00:00",
		updated_at: overrides.updated_at ?? "2026-05-29 10:05:00",
		last_active_at: overrides.last_active_at ?? "2026-05-29 10:05:00",
		tag: overrides.tag ?? "",
		...overrides,
	}
}

function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
	return {
		id: overrides.id ?? "workspace-a",
		name: overrides.name ?? "Workspace A",
		is_archived: 0,
		current_topic_id: "",
		current_project_id: null,
		workspace_status:
			overrides.workspace_status ?? ("waiting" as Workspace["workspace_status"]),
		project_count: overrides.project_count ?? 0,
		workspace_type: "default",
		...overrides,
	}
}

vi.mock("react-router", () => ({
	useParams: () => ({ workspaceId: routeWorkspaceId }),
	useLocation: () => ({ state: null }),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectsWithCollaboration: (...args: unknown[]) => getProjectsMock(...args),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		workspace: {
			getWorkspaceDetail: vi.fn(),
			renameWorkspaceWithRefresh: vi.fn(),
			deleteWorkspace: vi.fn(),
		},
		handleCreateProject: vi.fn(),
		switchProjectInMobile: vi.fn(),
		clearProjectAndTopicSelection: vi.fn(),
		deleteProject: vi.fn(),
	},
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: () => ({
		openActionsPopup: vi.fn(),
		openProjectDeleteConfirm: vi.fn(),
		updateCurrentActionItem: vi.fn(),
		handlePinProject: vi.fn(),
		projectActionComponents: null,
	}),
}))

describe("useWorkspacePage", () => {
	beforeEach(() => {
		routeWorkspaceId = "workspace-a"
		getProjectsMock.mockReset()
		navigateMock.mockReset()

		runInAction(() => {
			projectStore.setProjects([
				createProject({
					id: "stale-project",
					project_name: "Stale Project",
					workspace_id: "workspace-old",
				}),
			])
		})

		workspaceStore.setSelectedWorkspace(
			createWorkspace({ id: "workspace-a", name: "Workspace A" }),
		)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("shows loading with empty list before the active workspace fetch completes", async () => {
		let resolveFetch: ((value: { list: ProjectListItem[]; total: number }) => void) | undefined
		getProjectsMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve
				}),
		)

		const { result } = renderHook(() => useWorkspacePage())

		expect(result.current.isLoading).toBe(true)
		expect(result.current.projects).toEqual([])
		expect(result.current.filteredProjects).toEqual([])

		await act(async () => {
			resolveFetch?.({
				list: [
					createProject({
						id: "project-a1",
						project_name: "Project A1",
						workspace_id: "workspace-a",
					}),
				],
				total: 1,
			})
		})

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.projects).toHaveLength(1)
		expect(result.current.projects[0]?.project_name).toBe("Project A1")
	})

	it("clears stale global projects when switching workspace before fetch resolves", async () => {
		let resolveWorkspaceB:
			| ((value: { list: ProjectListItem[]; total: number }) => void)
			| undefined

		getProjectsMock.mockImplementation(({ workspace_id }: { workspace_id: string }) => {
			if (workspace_id === "workspace-a") {
				return Promise.resolve({
					list: [
						createProject({
							id: "project-a1",
							project_name: "Project A1",
							workspace_id: "workspace-a",
						}),
					],
					total: 1,
				})
			}

			return new Promise((resolve) => {
				resolveWorkspaceB = resolve
			})
		})

		const { result, rerender } = renderHook(() => useWorkspacePage())

		await waitFor(() => {
			expect(result.current.projects[0]?.project_name).toBe("Project A1")
		})

		routeWorkspaceId = "workspace-b"
		workspaceStore.setSelectedWorkspace(
			createWorkspace({ id: "workspace-b", name: "Workspace B" }),
		)
		rerender()

		expect(result.current.isLoading).toBe(true)
		expect(result.current.projects).toEqual([])
		expect(
			result.current.projects.some((project) => project.project_name === "Stale Project"),
		).toBe(false)

		await act(async () => {
			resolveWorkspaceB?.({
				list: [
					createProject({
						id: "project-b1",
						project_name: "Project B1",
						workspace_id: "workspace-b",
					}),
				],
				total: 1,
			})
		})

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.projects).toHaveLength(1)
		expect(result.current.projects[0]?.project_name).toBe("Project B1")
	})

	it("discards stale fetch results when workspace changes before response returns", async () => {
		let resolveWorkspaceA:
			| ((value: { list: ProjectListItem[]; total: number }) => void)
			| undefined

		getProjectsMock.mockImplementation(({ workspace_id }: { workspace_id: string }) => {
			if (workspace_id === "workspace-a") {
				return new Promise((resolve) => {
					resolveWorkspaceA = resolve
				})
			}

			return Promise.resolve({
				list: [
					createProject({
						id: "project-b1",
						project_name: "Project B1",
						workspace_id: "workspace-b",
					}),
				],
				total: 1,
			})
		})

		const { result, rerender } = renderHook(() => useWorkspacePage())

		expect(result.current.isLoading).toBe(true)
		expect(result.current.projects).toEqual([])

		routeWorkspaceId = "workspace-b"
		workspaceStore.setSelectedWorkspace(
			createWorkspace({ id: "workspace-b", name: "Workspace B" }),
		)
		rerender()

		await waitFor(() => {
			expect(result.current.projects[0]?.project_name).toBe("Project B1")
		})

		await act(async () => {
			resolveWorkspaceA?.({
				list: [
					createProject({
						id: "project-a-late",
						project_name: "Late Project A",
						workspace_id: "workspace-a",
					}),
				],
				total: 1,
			})
		})

		expect(result.current.projects).toHaveLength(1)
		expect(result.current.projects[0]?.project_name).toBe("Project B1")
	})
})
