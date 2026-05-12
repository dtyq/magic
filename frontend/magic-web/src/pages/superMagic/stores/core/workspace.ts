import { makeAutoObservable } from "mobx"
import { WorkspaceStatus, type Workspace } from "../../pages/Workspace/types"
import type { SuperAgentScopedStatusItem } from "@/apis/modules/superMagic"

interface WorkspaceState {
	selectedWorkspace: Workspace | null
	workspaces: Workspace[]
}

class WorkspaceStore {
	workspaces: Workspace[] = []
	selectedWorkspace: Workspace | null = null
	workspaceStateMap: Map<string, WorkspaceState> = new Map()
	/** Tracks concurrent workspace list fetches for loading UI */
	workspaceListFetchInFlight = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get firstWorkspace(): Workspace | null {
		return this.workspaces[0] || null
	}

	get isWorkspaceListLoading(): boolean {
		return this.workspaceListFetchInFlight > 0
	}

	beginWorkspaceListFetch() {
		this.workspaceListFetchInFlight++
	}

	endWorkspaceListFetch() {
		this.workspaceListFetchInFlight = Math.max(0, this.workspaceListFetchInFlight - 1)
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

	/** 按接口返回的显式状态补丁更新工作区状态，避免将终态误降级为 waiting。 */
	applyWorkspaceStatusPatches(items: SuperAgentScopedStatusItem[]) {
		if (!Array.isArray(items) || items.length === 0) return

		const statusMap = new Map(items.map((item) => [item.id, item.status]))

		const getPatchedWorkspace = (workspace: Workspace): Workspace | null => {
			const nextStatus = statusMap.get(workspace.id)
			if (nextStatus && workspace.workspace_status !== nextStatus) {
				return { ...workspace, workspace_status: nextStatus as WorkspaceStatus }
			}
			return null
		}

		this.workspaces = this.workspaces.map((ws) => getPatchedWorkspace(ws) || ws)

		if (this.selectedWorkspace) {
			const patched = getPatchedWorkspace(this.selectedWorkspace)
			if (patched) {
				this.selectedWorkspace = patched
			}
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
		this.workspaceListFetchInFlight = 0
	}
}

export default new WorkspaceStore()
