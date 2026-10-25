import recentProjectsStore from "./recentProjects"
import { makeAutoObservable, observable, runInAction } from "mobx"
import { ProjectStatus, type ProjectListItem } from "../../pages/Workspace/types"
import { CollaborationProjectType, CollaborationJoinMethod } from "../../pages/Workspace/types"
import projectFilesStore from "@/stores/projectFiles"
import { SuperMagicApi } from "@/apis"
import type { SuperAgentScopedStatusItem } from "@/apis/modules/superMagic"

interface ProjectState {
	selectedProject: ProjectListItem | null
	projects: ProjectListItem[]
}

interface WorkspaceProjectPage {
	page: number
	total: number
	hasMore: boolean
	loadingMore: boolean
	error: boolean
	failedRequest?: { firstPage: number; lastPage: number }
}

const WORKSPACE_PROJECT_PAGE_SIZE = 100

class ProjectStore {
	projects = observable.array<ProjectListItem>([], { deep: true })
	selectedProject: ProjectListItem | null = null
	projectStateMap: Map<string, ProjectState> = new Map()
	isFetchingProjects: boolean = false

	// Lazy loading support: store projects by workspace
	projectsByWorkspace = observable.map<string, ProjectListItem[]>(new Map(), { deep: true })
	loadingWorkspaces: Set<string> = new Set()
	loadedWorkspaces: Set<string> = new Set()
	workspacePages = observable.map<string, WorkspaceProjectPage>()
	private workspaceRequests = new Map<
		string,
		{ controller: AbortController; promise: Promise<boolean> }
	>()
	private generation = 0

	// Received collaboration projects (shared by others)
	receivedCollaborationProjects = observable.array<ProjectListItem>([], { deep: true })
	isLoadingReceivedCollaboration: boolean = false
	hasLoadedReceivedCollaboration: boolean = false

	constructor() {
		makeAutoObservable(this, { workspaceRequests: false } as Record<string, false>, {
			autoBind: true,
		})
	}

	setProjects(projects: ProjectListItem[]) {
		this.projects = projects
	}

	/**
	 * 追加项目到列表末尾，用于分页加载后续页时逐步扩充数据，不影响已有项的引用。
	 */
	appendProjects(projects: ProjectListItem[]) {
		this.projects = [...this.projects, ...projects]
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
		projectFilesStore.setSelectedProject(project)
	}

	setFetchingProjects(isFetching: boolean) {
		this.isFetchingProjects = isFetching
	}

	updateProject(project: ProjectListItem) {
		recentProjectsStore.updateProject(project)
		const index = this.projects.findIndex((p) => p.id === project.id)
		if (index !== -1) {
			this.projects[index] = project
		}
		if (this.selectedProject?.id === project.id) {
			this.selectedProject = project
		}

		// Update in projectsByWorkspace if exists
		const workspaceProjects = this.projectsByWorkspace.get(project.workspace_id)
		if (workspaceProjects) {
			const wsIndex = workspaceProjects.findIndex((p) => p.id === project.id)
			if (wsIndex !== -1) {
				workspaceProjects[wsIndex] = project
				this.projectsByWorkspace.set(project.workspace_id, [...workspaceProjects])
			}
		}
	}

	removeProject(id: string) {
		this.removeProjectFromCollections(id)
		if (this.selectedProject?.id === id) this.selectedProject = null
	}

	/** Removes a project from list caches without changing the active project or file state. */
	removeProjectFromCollections(id: string) {
		this.projects = this.projects.filter((p) => p.id !== id)

		this.projectsByWorkspace.forEach((projects, workspaceId) => {
			const filtered = projects.filter((p) => p.id !== id)
			if (filtered.length !== projects.length) {
				this.projectsByWorkspace.set(workspaceId, filtered)
			}
		})
	}

	cacheProjectState(workspaceId: string) {
		this.projectStateMap.set(workspaceId, {
			selectedProject: this.selectedProject,
			projects: this.projects,
		})
	}

	restoreProjectState(workspaceId: string) {
		const cached = this.projectStateMap.get(workspaceId)
		if (cached) {
			this.projects = cached.projects
			this.selectedProject = cached.selectedProject
		}
	}

	// Load projects for a specific workspace (lazy loading)
	loadProjectsForWorkspace(workspaceId: string, force = false, silent = false): Promise<boolean> {
		const pending = this.workspaceRequests.get(workspaceId)
		if (!force && pending) return pending.promise
		if (!force && this.loadedWorkspaces.has(workspaceId)) return Promise.resolve(true)
		pending?.controller.abort()
		// 刷新已浏览的页数，成功后整体替换；不能用第一页覆盖已经加载的后续项目。
		const pages = Math.max(1, this.workspacePages.get(workspaceId)?.page ?? 1)
		return this.requestWorkspaceProjects(workspaceId, 1, pages, silent)
	}

	loadMoreProjectsForWorkspace(workspaceId: string): Promise<boolean> {
		const pending = this.workspaceRequests.get(workspaceId)
		if (pending) return pending.promise
		const state = this.workspacePages.get(workspaceId)
		if (state?.failedRequest)
			return this.requestWorkspaceProjects(
				workspaceId,
				state.failedRequest.firstPage,
				state.failedRequest.lastPage,
				this.getProjectsByWorkspace(workspaceId).length > 0,
			)
		if (!state?.page) return this.loadProjectsForWorkspace(workspaceId)
		if (!state.hasMore) return Promise.resolve(true)
		return this.requestWorkspaceProjects(workspaceId, state.page + 1, state.page + 1, true)
	}

	private requestWorkspaceProjects(
		workspaceId: string,
		firstPage: number,
		lastPage: number,
		silent: boolean,
	): Promise<boolean> {
		const controller = new AbortController()
		const generation = this.generation
		const previous = this.workspacePages.get(workspaceId)
		this.workspacePages.set(workspaceId, {
			page: previous?.page ?? 0,
			total: previous?.total ?? 0,
			hasMore: previous?.hasMore ?? true,
			loadingMore: firstPage > 1,
			error: false,
		})
		if (!silent) this.loadingWorkspaces.add(workspaceId)
		const promise = (async (): Promise<boolean> => {
			try {
				let items: ProjectListItem[] =
					firstPage === 1 ? [] : [...this.getProjectsByWorkspace(workspaceId)]
				let total = 0
				let page = firstPage
				let hasMore = true
				for (; page <= lastPage; page++) {
					const response = await SuperMagicApi.getProjectsWithCollaboration(
						{
							workspace_id: workspaceId,
							page,
							page_size: WORKSPACE_PROJECT_PAGE_SIZE,
							show_collaboration: 1,
						},
						{ signal: controller.signal },
					)
					if (controller.signal.aborted || generation !== this.generation) return false
					const beforeCount = items.length
					items = Array.from(
						new Map(
							[...items, ...response.list].map((item) => [item.id, item]),
						).values(),
					)
					total = response.total
					hasMore =
						page * WORKSPACE_PROJECT_PAGE_SIZE < total && items.length > beforeCount
					if (!hasMore || page === lastPage) break
				}
				runInAction(() => {
					this.projectsByWorkspace.set(workspaceId, items)
					this.loadedWorkspaces.add(workspaceId)
					this.workspacePages.set(workspaceId, {
						page,
						total,
						hasMore,
						loadingMore: false,
						error: false,
					})
				})
				return true
			} catch (error) {
				if (!controller.signal.aborted && generation === this.generation) {
					runInAction(() => {
						const state = this.workspacePages.get(workspaceId)
						if (state)
							this.workspacePages.set(workspaceId, {
								...state,
								loadingMore: false,
								error: true,
								failedRequest: { firstPage, lastPage },
							})
					})
					console.error(`Failed to load projects for workspace ${workspaceId}:`, error)
				}
				return false
			} finally {
				if (this.workspaceRequests.get(workspaceId)?.controller === controller) {
					this.workspaceRequests.delete(workspaceId)
					runInAction(() => this.loadingWorkspaces.delete(workspaceId))
				}
			}
		})()
		this.workspaceRequests.set(workspaceId, { controller, promise })
		return promise
	}

	// Set projects for a specific workspace
	setProjectsForWorkspace(workspaceId: string, projects: ProjectListItem[]) {
		// 导航、移动端和改名会写入局部结果；暖缓存不代表完整分页，也不能删除后续已加载项目。
		const ids = new Set(projects.map((project) => project.id))
		this.projectsByWorkspace.set(workspaceId, [
			...projects,
			...this.getProjectsByWorkspace(workspaceId).filter((project) => !ids.has(project.id)),
		])
	}

	/** 有序落点需要真实后继；加载页尾后再计算锚点，不能把未知后继当作 null。 */
	async ensureProjectDropNeighbors(
		workspaceId: string,
		projectId: string | undefined,
		after: boolean,
	): Promise<boolean> {
		const pending = this.workspaceRequests.get(workspaceId)
		if (pending && !(await pending.promise)) return false
		if (
			this.workspacePages.get(workspaceId)?.error &&
			!(await this.loadMoreProjectsForWorkspace(workspaceId))
		)
			return false
		const items = this.getProjectsByWorkspace(workspaceId)
		if (projectId && !items.some((item) => item.id === projectId)) return false
		if (!after || (projectId && items.at(-1)?.id !== projectId)) return true
		if (!projectId && this.workspacePages.get(workspaceId)?.hasMore) return false
		return this.loadMoreProjectsForWorkspace(workspaceId)
	}

	reorderProjectsInWorkspace(workspaceId: string, projectIds: string[]) {
		const projects = this.projectsByWorkspace.get(workspaceId) || []
		const projectMap = new Map(projects.map((project) => [project.id, project]))
		const ordered = projectIds.flatMap((id, index) => {
			const project = projectMap.get(id)
			return project ? [{ ...project, sort_order: index } as ProjectListItem] : []
		})
		const orderedIds = new Set(ordered.map((project) => project.id))
		const nextProjects = [
			...ordered,
			...projects.filter((project) => !orderedIds.has(project.id)),
		]
		this.projectsByWorkspace.set(workspaceId, nextProjects)
		if (this.selectedProject?.workspace_id === workspaceId) {
			this.selectedProject =
				nextProjects.find((project) => project.id === this.selectedProject?.id) ||
				this.selectedProject
		}
		if (this.projects.some((project) => project.workspace_id === workspaceId)) {
			this.projects.replace(
				this.projects.map((project) =>
					project.workspace_id === workspaceId
						? nextProjects.find((item) => item.id === project.id) || project
						: project,
				),
			)
		}
	}

	moveProjectBetweenWorkspaces(
		project: ProjectListItem,
		sourceWorkspaceId: string,
		targetWorkspaceId: string,
		targetWorkspaceName?: string,
		targetIndex?: number,
		isPinned?: boolean,
	) {
		const sourceProjects = (this.projectsByWorkspace.get(sourceWorkspaceId) || []).filter(
			(item) => item.id !== project.id,
		)
		const targetProjects = [...(this.projectsByWorkspace.get(targetWorkspaceId) || [])].filter(
			(item) => item.id !== project.id,
		)
		const movedProject = {
			...project,
			workspace_id: targetWorkspaceId,
			workspace_name: targetWorkspaceName || project.workspace_name || "",
			...(isPinned === undefined ? {} : { is_pinned: isPinned }),
		}
		const insertAt = Math.max(
			0,
			Math.min(targetIndex ?? targetProjects.length, targetProjects.length),
		)
		targetProjects.splice(insertAt, 0, movedProject)
		this.projectsByWorkspace.set(sourceWorkspaceId, sourceProjects)
		this.projectsByWorkspace.set(targetWorkspaceId, targetProjects)
		this.projects.replace(
			this.projects.map((item) => (item.id === project.id ? movedProject : item)),
		)
		if (this.selectedProject?.id === project.id) this.selectedProject = movedProject
	}

	// Get projects for a specific workspace
	getProjectsByWorkspace(workspaceId: string): ProjectListItem[] {
		return this.projectsByWorkspace.get(workspaceId) || []
	}

	// Check if workspace is loading
	isLoadingWorkspace(workspaceId: string): boolean {
		return this.loadingWorkspaces.has(workspaceId)
	}

	// Check if workspace has been loaded
	hasLoadedWorkspace(workspaceId: string): boolean {
		return this.loadedWorkspaces.has(workspaceId)
	}

	/** 按接口返回的显式状态补丁更新项目状态，避免 running 结束后被覆盖成 waiting。 */
	applyProjectStatusPatches(items: SuperAgentScopedStatusItem[]) {
		if (!Array.isArray(items) || items.length === 0) return

		const statusMap = new Map(items.map((item) => [item.id, item.status]))

		const getPatchedProject = (project: ProjectListItem): ProjectListItem | null => {
			const nextStatus = statusMap.get(project.id)
			if (nextStatus && project.project_status !== nextStatus) {
				return { ...project, project_status: nextStatus as ProjectStatus }
			}
			return null
		}

		// Update main projects array
		this.projects = this.projects.map((p) => getPatchedProject(p) || p)

		// Update projectsByWorkspace map
		this.projectsByWorkspace.forEach((projects, workspaceId) => {
			let changed = false
			const nextProjects = projects.map((p) => {
				const patched = getPatchedProject(p)
				if (patched) {
					changed = true
					return patched
				}
				return p
			})
			if (changed) {
				this.projectsByWorkspace.set(workspaceId, nextProjects)
			}
		})

		// Update receivedCollaborationProjects
		this.receivedCollaborationProjects = this.receivedCollaborationProjects.map(
			(p) => getPatchedProject(p) || p,
		)

		// Update selectedProject
		if (this.selectedProject) {
			const patched = getPatchedProject(this.selectedProject)
			if (patched) {
				this.selectedProject = patched
			}
		}
	}

	// Load received collaboration projects (shared by others)
	async loadReceivedCollaborationProjects(force = false) {
		if (!force && (this.isLoadingReceivedCollaboration || this.hasLoadedReceivedCollaboration))
			return

		runInAction(() => {
			this.isLoadingReceivedCollaboration = true
		})

		try {
			const res = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: 99,
				type: CollaborationProjectType.Received,
				sort_field: "updated_at",
				sort_direction: "desc",
				join_method: CollaborationJoinMethod.Internal,
			})

			runInAction(() => {
				this.receivedCollaborationProjects = res.list as unknown as ProjectListItem[]
				this.hasLoadedReceivedCollaboration = true
				this.isLoadingReceivedCollaboration = false
			})
		} catch {
			runInAction(() => {
				this.isLoadingReceivedCollaboration = false
			})
		}
	}

	reset() {
		recentProjectsStore.reset()
		this.generation++
		this.workspaceRequests.forEach(({ controller }) => controller.abort())
		this.workspaceRequests.clear()
		this.workspacePages.clear()
		this.projects = []
		this.selectedProject = null
		this.projectStateMap.clear()
		this.isFetchingProjects = false
		this.projectsByWorkspace.clear()
		this.loadingWorkspaces.clear()
		this.loadedWorkspaces.clear()
		this.receivedCollaborationProjects = []
		this.isLoadingReceivedCollaboration = false
		this.hasLoadedReceivedCollaboration = false
	}
}

export default new ProjectStore()
