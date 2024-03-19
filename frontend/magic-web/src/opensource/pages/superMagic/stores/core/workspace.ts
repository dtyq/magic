import { makeAutoObservable } from "mobx"
import type { Workspace } from "../../pages/Workspace/types"

interface WorkspaceState {
	selectedWorkspace: Workspace | null
	workspaces: Workspace[]
}

class WorkspaceStore {
	workspaces: Workspace[] = []
	selectedWorkspace: Workspace | null = null
	workspaceStateMap: Map<string, WorkspaceState> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get firstWorkspace(): Workspace | null {
		return this.workspaces[0] || null
	}

	setWorkspaces(workspaces: Workspace[]) {
		this.workspaces = workspaces
	}

	setSelectedWorkspace(workspace: Workspace | null) {
		this.selectedWorkspace = workspace
	}

	getWorkspaceById(id: string): Workspace | null {
		return this.workspaces.find((ws) => ws.id === id) || null
	}

	/**
	 * 更新工作区
	 * @param workspace 工作区
	 */
	updateWorkspace(workspace: Workspace) {
		const index = this.workspaces.findIndex((ws) => ws.id === workspace.id)
		if (index !== -1) {
			this.workspaces[index] = workspace
		}
		if (this.selectedWorkspace?.id === workspace.id) {
			this.selectedWorkspace = workspace
		}
	}

	removeWorkspace(id: string) {
		this.workspaces = this.workspaces.filter((ws) => ws.id !== id)
		if (this.selectedWorkspace?.id === id) {
			this.selectedWorkspace = null
		}
	}

	cacheWorkspaceState(userId: string) {
		this.workspaceStateMap.set(userId, {
			selectedWorkspace: this.selectedWorkspace,
			workspaces: this.workspaces,
		})
	}

	restoreWorkspaceState(userId: string) {
		const cached = this.workspaceStateMap.get(userId)
		if (cached) {
			this.workspaces = cached.workspaces
			this.selectedWorkspace = cached.selectedWorkspace
		}
	}

	reset() {
		this.workspaces = []
		this.selectedWorkspace = null
		this.workspaceStateMap.clear()
	}
}

export default new WorkspaceStore()
