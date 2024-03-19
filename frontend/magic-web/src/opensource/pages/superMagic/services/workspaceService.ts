import { SuperMagicApi } from "@/opensource/apis"
import { runInAction } from "mobx"
import workspaceStore from "../stores/core/workspace"
import { type Workspace } from "../pages/Workspace/types"
import { SHARE_WORKSPACE_ID } from "../constants"
import { RequestConfig } from "@/opensource/apis/core/HttpClient"

export interface FetchWorkspacesParams {
	isAutoSelect?: boolean
	isSelectLast?: boolean
	isEditLast?: boolean
	isAfterCreate?: boolean
	page: number
}

export interface UpdateWorkspaceStatusParams {
	workspaceId?: string
}

class WorkspaceService {
	fetchWorkspaces = async (
		{ isAutoSelect = true, isSelectLast = true, page }: FetchWorkspacesParams,
		options?: Omit<RequestConfig, "url">,
	): Promise<Workspace[]> => {
		try {
			const res = await SuperMagicApi.getWorkspaces({ page, page_size: 99 })
			if (res) {
				runInAction(() => {
					workspaceStore.setWorkspaces(res.list)
				})

				if (isAutoSelect && isSelectLast && res.list.length > 0) {
					runInAction(() => {
						workspaceStore.setSelectedWorkspace(res.list[0])
					})
				}

				return res.list
			}
			return []
		} catch (error) {
			console.log("加载工作区失败，失败原因：", error)
			return []
		}
	}

	createWorkspace = async (name: string = ""): Promise<Workspace | null> => {
		const res = await SuperMagicApi.createWorkspace({
			workspace_name: name,
		})
		if (res?.id) {
			return res
		}
		return null
	}

	renameWorkspace = async (id: string, name: string): Promise<void> => {
		try {
			await SuperMagicApi.editWorkspace({
				id,
				workspace_name: name,
			})
			const targetWorkspace = workspaceStore.getWorkspaceById(id)
			if (targetWorkspace) {
				runInAction(() => {
					const updatedWorkspace = { ...targetWorkspace, name } as Workspace
					workspaceStore.updateWorkspace(updatedWorkspace)
				})
			}
		} catch (error) {
			console.log("重命名工作区失败，失败原因：", error)
			throw error
		}
	}

	/**
	 * Rename workspace and refresh workspace list
	 * @param id Workspace ID
	 * @param name New workspace name
	 * @returns Promise that resolves when operation completes
	 * @throws Error with validation message if name is empty
	 */
	renameWorkspaceWithRefresh = async (id: string, name: string): Promise<void> => {
		if (!name) {
			throw new Error("workspaceNameRequired")
		}

		await this.renameWorkspace(id, name)
		await this.fetchWorkspaces({
			isAutoSelect: false,
			isSelectLast: false,
			isEditLast: false,
			page: 1,
		})
	}

	deleteWorkspace = async (id: string): Promise<Workspace | null> => {
		try {
			await SuperMagicApi.deleteWorkspace({ id })

			const workspaces = workspaceStore.workspaces
			if (workspaces.length === 1) {
				runInAction(() => {
					workspaceStore.setWorkspaces([])
					workspaceStore.setSelectedWorkspace(null)
				})
				return null
			}

			const targetWorkspaceIndex = workspaces.findIndex((ws) => ws.id === id)
			const nextWorkspaceIndex =
				targetWorkspaceIndex === workspaces.length - 1
					? targetWorkspaceIndex - 1
					: targetWorkspaceIndex

			const newWorkspaces = workspaces.filter((ws) => ws.id !== id)
			const nextWorkspace = newWorkspaces[nextWorkspaceIndex]

			runInAction(() => {
				workspaceStore.setWorkspaces(newWorkspaces)
				if (workspaceStore.selectedWorkspace?.id === id) {
					workspaceStore.setSelectedWorkspace(nextWorkspace || null)
				}
			})

			this.fetchWorkspaces({
				isSelectLast: true,
				isEditLast: false,
				page: 1,
				isAutoSelect: false,
			})

			return nextWorkspace || null
		} catch (error) {
			console.log("删除工作区失败，失败原因：", error)
			throw error
		}
	}

	updateWorkspaceStatus = async (workspaceId: string): Promise<void> => {
		if (!workspaceId || workspaceId === SHARE_WORKSPACE_ID) return
		try {
			const res = await SuperMagicApi.getWorkspaceDetail({ id: workspaceId })
			runInAction(() => {
				workspaceStore.updateWorkspace(res)
			})
		} catch (error) {
			console.log("更新工作区状态失败，失败原因：", error)
			throw error
		}
	}

	/**
	 * 获取工作区详情
	 * @param workspaceId 工作区ID
	 * @returns 工作区详情
	 */
	getWorkspaceDetail = (
		workspaceId: string,
		options?: Omit<RequestConfig, "url">,
	): Promise<Workspace | null> => {
		return SuperMagicApi.getWorkspaceDetail({ id: workspaceId }, options)
	}
}

export default WorkspaceService
