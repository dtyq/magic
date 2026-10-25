import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import workspaceStore from "../stores/core/workspace"
import projectStore from "../stores/core/project"
import { type Workspace } from "../pages/Workspace/types"
import { SHARE_WORKSPACE_ID } from "../constants"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { getInsertIndexByAnchors, isSameOrder } from "./orderUtils"
import { createOrderRequestOptions, reportOrderApiError } from "./orderErrorReporter"
import { invalidateWorkspaceSearchResults } from "./workspaceListSearchInvalidation"
import { analyticsService } from "@/services/analytics"
import type { ProjectInitializationScope } from "./projectStateInitialization"

export interface FetchWorkspacesParams {
	isAutoSelect?: boolean
	isSelectLast?: boolean
	isEditLast?: boolean
	isAfterCreate?: boolean
	page: number
	/** Workspace list page size. Defaults to the sidebar's incremental page size. */
	pageSize?: number
	/** Appends the next page to the existing workspace list instead of replacing it. */
	append?: boolean
}

export interface UpdateWorkspaceStatusParams {
	workspaceId?: string
}

export interface DeleteWorkspaceOptions {
	/** Keeps callers with their own pagination state from receiving a second list refresh. */
	refreshAfterDelete?: boolean
}

class WorkspaceService {
	fetchWorkspaces = async (
		{
			isAutoSelect = true,
			isSelectLast = true,
			page,
			pageSize = 20,
			append = false,
		}: FetchWorkspacesParams,
		_options?: Omit<RequestConfig, "url">,
		scope?: ProjectInitializationScope,
	): Promise<Workspace[]> => {
		if (scope && !scope.isCurrent()) return []
		const generation = workspaceStore.beginWorkspaceListFetch()
		try {
			const res = await SuperMagicApi.getWorkspaces({ page, page_size: pageSize })
			if (scope && !scope.isCurrent()) return []
			if (res) {
				runInAction(() => {
					const nextWorkspaces = append
						? Array.from(
								new Map(
									[...workspaceStore.workspaces, ...res.list].map((workspace) => [
										workspace.id,
										workspace,
									]),
								).values(),
							)
						: res.list
					workspaceStore.setWorkspaces(nextWorkspaces)
					const refreshedSelectedWorkspace = res.list.find(
						(workspace: Workspace) =>
							workspace.id === workspaceStore.selectedWorkspace?.id,
					)
					if (refreshedSelectedWorkspace) {
						// 列表刷新后用服务端最新对象回填当前选中项，避免详情页标题停留在旧快照。
						workspaceStore.setSelectedWorkspace(refreshedSelectedWorkspace)
					}
				})

				if (!append && isAutoSelect && isSelectLast && res.list.length > 0) {
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
		} finally {
			runInAction(() => {
				workspaceStore.endWorkspaceListFetch(generation)
			})
		}
	}

	createWorkspace = async (name: string = ""): Promise<Workspace | null> => {
		analyticsService.report("workspace_create_attempted")
		const res = await SuperMagicApi.createWorkspace({
			workspace_name: name,
		})
		const workspaceId = res?.id?.trim()
		if (workspaceId) {
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
			const selectedWorkspace =
				workspaceStore.selectedWorkspace?.id === id
					? workspaceStore.selectedWorkspace
					: null
			const targetWorkspace = workspaceStore.getWorkspaceById(id) ?? selectedWorkspace
			if (targetWorkspace) {
				runInAction(() => {
					// 详情页可能只持有 selectedWorkspace，不能只更新列表里的对象。
					const updatedWorkspace = { ...targetWorkspace, name } as Workspace
					workspaceStore.updateWorkspace(updatedWorkspace)

					if (projectStore.selectedProject?.workspace_id === id) {
						projectStore.setSelectedProject({
							...projectStore.selectedProject,
							workspace_name: name,
						})
					}

					const workspaceProjects = projectStore.getProjectsByWorkspace(id)
					if (workspaceProjects.length > 0) {
						projectStore.setProjectsForWorkspace(
							id,
							workspaceProjects.map((project) => ({
								...project,
								workspace_name: name,
							})),
						)
					}

					if (projectStore.projects.length > 0) {
						projectStore.setProjects(
							projectStore.projects.map((project) => {
								if (project.workspace_id !== id) return project
								return {
									...project,
									workspace_name: name,
								}
							}),
						)
					}
				})
			}
			invalidateWorkspaceSearchResults()
		} catch (error) {
			console.log("重命名工作区失败，失败原因：", error)
			throw error
		}
	}

	moveWorkspace = async (
		workspaceId: string,
		preWorkspaceId: string | null,
		nextWorkspaceId: string | null,
	): Promise<void> => {
		const previousWorkspaceIds = workspaceStore.workspaces.map((workspace) => workspace.id)
		const sourceIndex = previousWorkspaceIds.indexOf(workspaceId)
		if (sourceIndex === -1) return
		const nextWorkspaceIds = previousWorkspaceIds.filter((id) => id !== workspaceId)
		const insertIndex = getInsertIndexByAnchors(
			nextWorkspaceIds,
			preWorkspaceId,
			nextWorkspaceId,
		)
		if (insertIndex === null) return
		nextWorkspaceIds.splice(Math.max(0, insertIndex), 0, workspaceId)
		const optimisticWorkspaceIds = [...nextWorkspaceIds]
		runInAction(() => {
			workspaceStore.reorderWorkspaces(nextWorkspaceIds)
		})

		const { requestId, options } = createOrderRequestOptions()
		let orderingRequestCompleted = false
		try {
			await SuperMagicApi.moveWorkspace(
				{
					id: workspaceId,
					pre_workspace_id: preWorkspaceId,
					next_workspace_id: nextWorkspaceId,
				},
				options,
			)
			orderingRequestCompleted = true
			await this.fetchWorkspaces({
				page: 1,
				pageSize: Math.max(20, previousWorkspaceIds.length),
				isAutoSelect: false,
				isSelectLast: false,
			})
			invalidateWorkspaceSearchResults()
		} catch (error) {
			if (!orderingRequestCompleted)
				reportOrderApiError({
					endpoint: `/api/v1/super-agent/workspaces/${workspaceId}`,
					params: {
						id: workspaceId,
						pre_workspace_id: preWorkspaceId,
						next_workspace_id: nextWorkspaceId,
					},
					requestId,
					error,
				})
			const currentWorkspaceIds = workspaceStore.workspaces.map((workspace) => workspace.id)
			if (isSameOrder(currentWorkspaceIds, optimisticWorkspaceIds)) {
				runInAction(() => {
					workspaceStore.reorderWorkspaces(previousWorkspaceIds)
				})
			}
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

	pinWorkspace = async (id: string, isPinned: boolean): Promise<void> => {
		const selectedWorkspace =
			workspaceStore.selectedWorkspace?.id === id ? workspaceStore.selectedWorkspace : null
		const targetWorkspace = workspaceStore.getWorkspaceById(id) ?? selectedWorkspace

		if (!targetWorkspace?.name) {
			throw new Error("workspaceNameRequired")
		}

		try {
			await SuperMagicApi.editWorkspace({
				id,
				workspace_name: targetWorkspace.name,
				is_pinned: isPinned,
			})

			runInAction(() => {
				workspaceStore.updateWorkspace({
					...targetWorkspace,
					is_pinned: isPinned,
				})
			})
		} catch (error) {
			console.log("置顶工作区失败，失败原因：", error)
			throw error
		}
	}

	deleteWorkspace = async (
		id: string,
		{ refreshAfterDelete = true }: DeleteWorkspaceOptions = {},
	): Promise<Workspace | null> => {
		try {
			await SuperMagicApi.deleteWorkspace({ id })
			invalidateWorkspaceSearchResults()

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

			if (refreshAfterDelete) {
				this.fetchWorkspaces({
					isSelectLast: true,
					isEditLast: false,
					page: 1,
					isAutoSelect: false,
				})
			}

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
