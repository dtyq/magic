import { useCallback, useRef, useState } from "react"
import type { Workspace } from "../pages/Workspace/types"
import { useTranslation } from "react-i18next"
import type { NavigateToStateParams } from "../services/routeManageService"
import { useMemoizedFn } from "ahooks"
import { ProjectListItem, Topic } from "../pages/Workspace/types"
import { SHARE_WORKSPACE_ID } from "../constants"
import { SuperMagicApi } from "@/apis"
import { useWorkspaceEditing } from "./useWorkspaceEditing"
import magicToast from "@/components/base/MagicToaster/utils"

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

export function useWorkspace({
	onWorkspaceStateChange,
	setSelectedProject,
	setSelectedTopic,
}: {
	onWorkspaceStateChange: (workspaceState: NavigateToStateParams) => void
	setSelectedProject: ((project: ProjectListItem | null) => void) | null
	setSelectedTopic: ((topic: Topic | null) => void) | null
}) {
	const { t } = useTranslation("super")

	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [workspacesPage, setWorkspacesPage] = useState(1)
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)

	// Use ref to store fetchWorkspaces to avoid circular dependency
	const fetchWorkspacesRef = useRef<
		((params: FetchWorkspacesParams) => Promise<Workspace[] | undefined>) | null
	>(null)

	// Workspace editing hook
	const {
		editingWorkspaceId,
		editingWorkspaceName,
		handleWorkspaceInputChange,
		handleWorkspaceInputKeyDown,
		handleWorkspaceInputBlur,
		handleStartEditWorkspace,
		resetWorkspaceEditing,
		setEditingState,
	} = useWorkspaceEditing({
		selectedWorkspace,
		workspaces,
		onSave: async (workspaceId: string, workspaceName: string) => {
			await SuperMagicApi.editWorkspace({
				id: workspaceId,
				workspace_name: workspaceName,
			})
		},
		onSaveSuccess: async () => {
			// After editing, need to update workspace list
			if (fetchWorkspacesRef.current) {
				await fetchWorkspacesRef.current({ isSelectLast: false, page: 1 })
			}
		},
	})

	/**
	 * 加载工作区数据
	 * @param isAutoSelect 是否自动选择
	 * @param isSelectLast 是否选择最后一个
	 * @param isEditLast 是否编辑最后一个
	 * @param isAfterCreate 是否在创建后
	 * @param page 页码
	 */
	const fetchWorkspaces = useCallback(
		async ({
			isAutoSelect = true,
			isSelectLast = true,
			isEditLast = false,
			isAfterCreate = false,
			page,
		}: FetchWorkspacesParams) => {
			try {
				const res = await SuperMagicApi.getWorkspaces({ page, page_size: 99 })
				if (res) {
					setWorkspaces(res.list)
					setWorkspacesPage(1)

					if (isAutoSelect && !isSelectLast && selectedWorkspace) {
						const _selectedWorkspace =
							res.list.find(
								(workspace: Workspace) => workspace.id === selectedWorkspace.id,
							) ||
							res.list[0] ||
							null

						setSelectedWorkspace(_selectedWorkspace)
						onWorkspaceStateChange({
							workspaceId: _selectedWorkspace?.id || null,
						})
					} else if (isAutoSelect && isSelectLast) {
						const _selectedWorkspace = res.list[0] || null

						if (isAfterCreate) {
							setSelectedWorkspace(_selectedWorkspace)
							setSelectedProject?.(null)
							setSelectedTopic?.(null)
							onWorkspaceStateChange({
								workspaceId: _selectedWorkspace?.id || null,
								projectId: null,
								topicId: null,
							})
						} else {
							setSelectedWorkspace(_selectedWorkspace)
							onWorkspaceStateChange({
								workspaceId: _selectedWorkspace?.id || null,
							})
						}
					}

					if (isEditLast) {
						setEditingState(res.list[0]?.id || null, res.list[0]?.name || "")
					}

					return res.list
				}
				return []
			} catch (error) {
				console.log("加载工作区失败，失败原因：", error)
			}
		},
		[
			selectedWorkspace,
			onWorkspaceStateChange,
			setSelectedProject,
			setSelectedTopic,
			setEditingState,
		],
	)

	// Store fetchWorkspaces in ref
	fetchWorkspacesRef.current = fetchWorkspaces

	/**
	 * 更新工作区的状态
	 * 注意：该方法仅用于更新指定工作区的状态，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateWorkspaceStatus = useCallback(
		async ({ workspaceId }: UpdateWorkspaceStatusParams) => {
			if (!workspaceId || workspaceId === SHARE_WORKSPACE_ID) return
			try {
				const res = await SuperMagicApi.getWorkspaceDetail({ id: workspaceId })
				if (selectedWorkspace?.id === workspaceId) {
					setSelectedWorkspace(res)
				}
				const updatedWorkspaces = workspaces.map((workspace) => {
					if (workspace.id === workspaceId) {
						return res
					}
					return workspace
				})
				setWorkspaces(updatedWorkspaces)
			} catch (error) {
				console.log("更新工作区状态失败，失败原因：", error)
			}
		},
		[workspaces, selectedWorkspace],
	)
	const handleStartAddWorkspace = useCallback(
		async (workspaceName: string) => {
			try {
				const defaultWorkspaceName = ""
				const res = await SuperMagicApi.createWorkspace({
					workspace_name: workspaceName || defaultWorkspaceName,
				})
				if (res?.id) {
					// 创建完成后直接获取最新工作区列表
					await fetchWorkspaces({
						isSelectLast: true,
						isEditLast: !workspaceName,
						page: 1,
						isAfterCreate: true,
					})
					magicToast.success(t("workspace.createWorkspaceSuccess"))
				}
			} catch (error) {
				console.log("创建工作区失败，失败原因：", error)
			}
		},
		[fetchWorkspaces, t],
	)

	const handleDeleteWorkspace = useMemoizedFn(async (id: string) => {
		try {
			await SuperMagicApi.deleteWorkspace({ id })

			if (workspaces.length === 1) {
				setWorkspaces([])
				setSelectedWorkspace(null)
				setSelectedProject?.(null)
				setSelectedTopic?.(null)
				onWorkspaceStateChange({
					workspaceId: null,
					projectId: null,
					topicId: null,
				})
				magicToast.success(t("workspace.deleteWorkspaceSuccess"))
				return
			}

			const targetWorkspaceIndex = workspaces.findIndex((ws) => ws.id === id)

			const nextWorkspaceIndex =
				targetWorkspaceIndex === workspaces.length - 1
					? targetWorkspaceIndex - 1
					: targetWorkspaceIndex

			const newWorkspaces = workspaces.filter((ws) => ws.id !== id)
			const nextWorkspace = newWorkspaces[nextWorkspaceIndex]
			setWorkspaces(newWorkspaces)

			if (selectedWorkspace?.id === id) {
				setSelectedWorkspace(nextWorkspace)
				setSelectedProject?.(null)
				setSelectedTopic?.(null)
				onWorkspaceStateChange({
					workspaceId: nextWorkspace.id,
					projectId: null,
					topicId: null,
				})
			}

			fetchWorkspaces({
				isSelectLast: true,
				isEditLast: false,
				page: 1,
				isAutoSelect: false,
			})
			magicToast.success(t("workspace.deleteWorkspaceSuccess"))
		} catch (error) {
			console.log("删除工作区失败，失败原因：", error)
		}
	})

	return {
		workspaces,
		setWorkspaces,
		workspacesPage,
		selectedWorkspace,
		setSelectedWorkspace,
		editingWorkspaceId,
		editingWorkspaceName,
		handleWorkspaceInputChange,
		handleWorkspaceInputKeyDown,
		handleWorkspaceInputBlur,
		handleStartEditWorkspace,
		handleStartAddWorkspace,
		handleDeleteWorkspace,
		fetchWorkspaces,
		resetWorkspaceEditing,
		updateWorkspaceStatus,
	}
}
