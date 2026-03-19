import { makeAutoObservable, runInAction } from "mobx"
import type { ProjectListItem } from "../../pages/Workspace/types"
import { CollaborationProjectType, CollaborationJoinMethod } from "../../pages/Workspace/types"
import projectFilesStore from "@/stores/projectFiles"
import { SuperMagicApi } from "@/apis"

interface ProjectState {
	selectedProject: ProjectListItem | null
	projects: ProjectListItem[]
}

class ProjectStore {
	projects: ProjectListItem[] = []
	selectedProject: ProjectListItem | null = null
	projectStateMap: Map<string, ProjectState> = new Map()
	isFetchingProjects: boolean = false

	// Lazy loading support: store projects by workspace
	projectsByWorkspace: Map<string, ProjectListItem[]> = new Map()
	loadingWorkspaces: Set<string> = new Set()
	loadedWorkspaces: Set<string> = new Set()

	// Received collaboration projects (shared by others)
	receivedCollaborationProjects: ProjectListItem[] = []
	isLoadingReceivedCollaboration: boolean = false
	hasLoadedReceivedCollaboration: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setProjects(projects: ProjectListItem[]) {
		this.projects = projects
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
		projectFilesStore.setSelectedProject(project)
	}

	setFetchingProjects(isFetching: boolean) {
		this.isFetchingProjects = isFetching
	}

	updateProject(project: ProjectListItem) {
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
		this.projects = this.projects.filter((p) => p.id !== id)
		if (this.selectedProject?.id === id) {
			this.selectedProject = null
		}

		// Remove from projectsByWorkspace
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
	async loadProjectsForWorkspace(workspaceId: string, force = false, silent = false) {
		// Skip if already loading or loaded (unless force refresh)
		if (
			!force &&
			(this.loadingWorkspaces.has(workspaceId) || this.loadedWorkspaces.has(workspaceId))
		) {
			return
		}

		// Mark as loading (skip visual loading state for silent refreshes)
		if (!silent) {
			runInAction(() => {
				this.loadingWorkspaces.add(workspaceId)
			})
		}

		try {
			const response = await SuperMagicApi.getProjectsWithCollaboration({
				workspace_id: workspaceId,
				page: 1,
				page_size: 100,
				show_collaboration: 1,
			})

			runInAction(() => {
				this.projectsByWorkspace.set(workspaceId, response.list || [])
				this.loadedWorkspaces.add(workspaceId)
				if (!silent) {
					this.loadingWorkspaces.delete(workspaceId)
				}
			})
		} catch (error) {
			console.error(`Failed to load projects for workspace ${workspaceId}:`, error)
			if (!silent) {
				runInAction(() => {
					this.loadingWorkspaces.delete(workspaceId)
				})
			}
		}
	}

	// Set projects for a specific workspace
	setProjectsForWorkspace(workspaceId: string, projects: ProjectListItem[]) {
		this.projectsByWorkspace.set(workspaceId, projects)
		this.loadedWorkspaces.add(workspaceId)
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
