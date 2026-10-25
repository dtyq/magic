import { canDeleteRecordingProjects } from "@/services/recordSummary/projectDeletionRecordingNotice"
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
import SuperMagicService from "@/pages/superMagic/services"
import { useWorkspacePage } from "../useWorkspacePage"

vi.hoisted(() => {
	const values = new Map<string, string>()
	const localStorageMock = {
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: (index: number) => Array.from(values.keys())[index] ?? null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
		get length() {
			return values.size
		},
	}

	Object.defineProperty(globalThis, "localStorage", {
		value: localStorageMock,
		configurable: true,
	})
	Object.defineProperty(globalThis.window, "localStorage", {
		value: localStorageMock,
		configurable: true,
	})
})

const getProjectsMock = vi.fn()
const navigateMock = vi.fn()
const deleteProjectMock = vi.fn()
const projectActionsMockState = vi.hoisted(() => ({
	options: null as null | {
		onDeleteProjectConfirmed?: (project: ProjectListItem) => Promise<void>
	},
}))

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

vi.mock("@/utils/manualPerfLogger", () => ({
	manualPerfLogger: {
		count: vi.fn(),
		ensureSession: vi.fn(),
		finishSession: vi.fn(),
		isEnabled: () => false,
		markEnd: vi.fn(),
		markStart: vi.fn(),
		measure: (_name: string, callback: () => unknown) => callback(),
		now: () => 0,
		recordDuration: vi.fn(),
		recordMetric: vi.fn(),
	},
	measureManualPerfOperation: (_name: string, callback: () => unknown) => callback(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getProjectsWithCollaboration: (...args: unknown[]) => getProjectsMock(...args),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		workspace: {
			getWorkspaceDetail: vi.fn().mockResolvedValue(null),
			renameWorkspaceWithRefresh: vi.fn(),
			deleteWorkspace: vi.fn(),
		},
		handleCreateProject: vi.fn(),
		switchProjectInMobile: vi.fn(),
		clearProjectAndTopicSelection: vi.fn(),
		deleteProject: (...args: unknown[]) => deleteProjectMock(...args),
	},
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: (options: NonNullable<typeof projectActionsMockState.options>) => {
		projectActionsMockState.options = options
		return {
			openActionsPopup: vi.fn(),
			openProjectDeleteConfirm: vi.fn(),
			updateCurrentActionItem: vi.fn(),
			handlePinProject: vi.fn(),
			projectActionComponents: null,
		}
	},
}))

describe("useWorkspacePage", () => {
	beforeEach(() => {
		routeWorkspaceId = "workspace-a"
		getProjectsMock.mockReset()
		navigateMock.mockReset()
		deleteProjectMock.mockReset()
		projectActionsMockState.options = null

		runInAction(() => {
			projectStore.setProjects([
				createProject({
					id: "stale-project",
					project_name: "Stale Project",
					workspace_id: "workspace-old",
				}),
			])
		})

		workspaceStore.setWorkspaces([
			createWorkspace({ id: "workspace-a", name: "Workspace A" }),
			createWorkspace({ id: "workspace-b", name: "Workspace B" }),
		])
		workspaceStore.setSelectedWorkspace(
			createWorkspace({ id: "workspace-a", name: "Workspace A" }),
		)
	})

	afterEach(() => {
		vi.clearAllMocks()
		projectStore.reset()
		workspaceStore.reset()
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
			((value: { list: ProjectListItem[]; total: number }) => void) | undefined

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
			((value: { list: ProjectListItem[]; total: number }) => void) | undefined

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

	it("does not optimistically remove a project when its recording blocks deletion", async () => {
		const project = createProject({
			id: "project-1",
			project_name: "Recording",
			workspace_id: "workspace-a",
		})
		getProjectsMock.mockResolvedValueOnce({ list: [project], total: 1 })
		const { result } = renderHook(() => useWorkspacePage())
		await waitFor(() => expect(result.current.projects).toHaveLength(1))
		vi.mocked(canDeleteRecordingProjects).mockReturnValueOnce(false)
		await act(async () => {
			await projectActionsMockState.options?.onDeleteProjectConfirmed?.(project)
		})
		expect(deleteProjectMock).not.toHaveBeenCalled()
		expect(result.current.projects[0]?.id).toBe("project-1")
	})

	it("keeps pagination disabled while project delete refresh is replacing the first page", async () => {
		const firstPageProjects = Array.from({ length: 100 }, (_, index) =>
			createProject({
				id: `project-${index + 1}`,
				project_name: `Project ${index + 1}`,
				workspace_id: "workspace-a",
			}),
		)
		let resolveRefresh:
			((value: { list: ProjectListItem[]; total: number }) => void) | undefined

		getProjectsMock
			.mockResolvedValueOnce({
				list: firstPageProjects,
				total: 100,
			})
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveRefresh = resolve
					}),
			)
		deleteProjectMock.mockImplementation(async (project: ProjectListItem) => {
			// Mirror projectService.deleteProject optimistic store removal before the list refresh.
			projectStore.removeProject(project.id)
			return null
		})

		const { result } = renderHook(() => useWorkspacePage())

		await waitFor(() => {
			expect(result.current.projects).toHaveLength(100)
		})
		expect(result.current.hasMore).toBe(false)

		const firstProject = firstPageProjects[0]
		if (!firstProject) throw new Error("missing mock project")

		let deletePromise!: Promise<void>
		await act(async () => {
			deletePromise = projectActionsMockState.options?.onDeleteProjectConfirmed?.(
				firstProject,
			) as Promise<void>
		})

		await waitFor(() => {
			expect(result.current.projects).toHaveLength(99)
		})
		expect(result.current.hasMore).toBe(false)

		await act(async () => {
			resolveRefresh?.({
				list: firstPageProjects.slice(1),
				total: 99,
			})
			await deletePromise
		})

		expect(getProjectsMock).toHaveBeenCalledTimes(2)
		expect(getProjectsMock).toHaveBeenNthCalledWith(2, {
			workspace_id: "workspace-a",
			page: 1,
			page_size: 100,
		})
		expect(result.current.hasMore).toBe(false)
	})

	it("creates a project in the route workspace after selectedWorkspace was switched by a move", async () => {
		getProjectsMock.mockResolvedValue({ list: [], total: 0 })
		vi.mocked(SuperMagicService.handleCreateProject).mockResolvedValue({
			project: createProject({
				id: "project-new",
				project_name: "New Project",
				workspace_id: "workspace-a",
			}),
			topic: { id: "topic-new" },
		} as never)

		const { result } = renderHook(() => useWorkspacePage())

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		// Simulate moveProject following the last project into the destination workspace.
		workspaceStore.setSelectedWorkspace(
			createWorkspace({ id: "workspace-b", name: "Workspace B" }),
		)

		await act(async () => {
			await result.current.handleCreateProject("New Project")
		})

		expect(SuperMagicService.handleCreateProject).toHaveBeenCalledWith({
			projectMode: TopicMode.Empty,
			isAutoSelect: false,
			projectName: "New Project",
			workspaceId: "workspace-a",
		})
		expect(getProjectsMock).toHaveBeenLastCalledWith({
			workspace_id: "workspace-a",
			page: 1,
			page_size: 100,
		})
	})
})

vi.mock("@/services/recordSummary/projectDeletionRecordingNotice", () => ({
	canDeleteRecordingProjects: vi.fn(() => true),
	handleRecordingProjectDeletionError: vi.fn(() => false),
}))
