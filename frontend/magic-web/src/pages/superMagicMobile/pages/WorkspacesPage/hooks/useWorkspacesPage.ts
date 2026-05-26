import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce, useRequest } from "ahooks"
import { runInAction } from "mobx"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { SHARE_WORKSPACE_DATA } from "@/pages/superMagic/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

const WORKSPACE_PAGE_SIZE = 100

export interface UseWorkspacesPageReturn {
	/** 加载中 */
	isLoading: boolean
	/** 搜索关键字 */
	searchValue: string
	setSearchValue: (value: string) => void
	/** 真正用于执行搜索的防抖关键字 */
	debouncedSearchValue: string
	/** 原始工作空间列表 */
	allWorkspaces: Workspace[]
	/** 过滤后的工作空间列表 */
	filteredWorkspaces: Workspace[]
	/** 原始列表空态 */
	isWorkspaceEmpty: boolean
	/** 搜索结果空态 */
	isSearchEmpty: boolean
	/** 当前选中的工作空间 */
	selectedWorkspace: Workspace | null
	/** 更多操作 Sheet */
	moreSheetOpen: boolean
	moreSheetWorkspace: Workspace | null
	openMoreSheet: (workspace: Workspace) => void
	closeMoreSheet: () => void
	/** 新建 Sheet */
	createSheetOpen: boolean
	openCreateSheet: () => void
	closeCreateSheet: () => void
	/** 操作函数 */
	handleCreateWorkspace: (name: string) => Promise<void>
	handleRenameWorkspace: (id: string, name: string) => Promise<void>
	handleDeleteWorkspace: (id: string) => Promise<void>
	handleSelectWorkspace: (workspace: Workspace) => void
	/** 共享工作区入口 */
	handleOpenSharedWorkspace: () => void
	/** 下拉刷新：重新加载第 1 页 */
	handleRefresh: () => Promise<void>
	/** 是否还有更多工作区未加载 */
	hasMore: boolean
	/** 加载更多工作区（下一页） */
	loadMore: () => Promise<void>
}

export function useWorkspacesPage(): UseWorkspacesPageReturn {
	const { t } = useTranslation("super")
	const navigate = useNavigate()

	const [searchValue, setSearchValue] = useState("")
	// 输入框始终保持实时更新，真正执行列表过滤时统一使用防抖关键字。
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 300 })
	const [moreSheetOpen, setMoreSheetOpen] = useState(false)
	const [moreSheetWorkspace, setMoreSheetWorkspace] = useState<Workspace | null>(null)
	const [createSheetOpen, setCreateSheetOpen] = useState(false)
	// 分页状态：追踪服务端总数和当前已加载到第几页
	const [workspacesTotal, setWorkspacesTotal] = useState(0)
	const [currentPage, setCurrentPage] = useState(1)

	// 加载工作空间列表（第 1 页，触发服务层的 store 更新与 isLoading 管理）
	const { run: fetchWorkspacesPage1, loading: isLoading } = useRequest(
		async () => {
			// 直接调 API 以便同时拿到 total，避免二次请求；手动维护 store 侧效果。
			const res = await SuperMagicApi.getWorkspaces({
				page: 1,
				page_size: WORKSPACE_PAGE_SIZE,
			})
			if (res) {
				runInAction(() => {
					workspaceStore.setWorkspaces(res.list)
					const refreshedSelected = res.list.find(
						(ws: Workspace) => ws.id === workspaceStore.selectedWorkspace?.id,
					)
					if (refreshedSelected) workspaceStore.setSelectedWorkspace(refreshedSelected)
				})
				setWorkspacesTotal(res.total ?? res.list.length)
			}
			setCurrentPage(1)
			return res?.list ?? []
		},
		{
			manual: true,
		},
	)

	useEffect(() => {
		fetchWorkspacesPage1()
	}, [fetchWorkspacesPage1])

	// 当前工作空间列表遵循 page_size: 999 + 前端本地搜索，原始数据与过滤结果要分别保留。
	const allWorkspaces = workspaceStore.workspaces
	const filteredWorkspaces = !debouncedSearchValue
		? allWorkspaces
		: allWorkspaces.filter((ws) =>
				(ws.name ?? "").toLowerCase().includes(debouncedSearchValue.toLowerCase()),
			)
	// 将“数据为空”和“搜索为空”拆成显式状态，避免视图层把过滤后的列表长度误判为真实空态。
	const isWorkspaceEmpty = !isLoading && !debouncedSearchValue && allWorkspaces.length === 0
	const isSearchEmpty =
		!isLoading && Boolean(debouncedSearchValue) && filteredWorkspaces.length === 0

	const openMoreSheet = useCallback((workspace: Workspace) => {
		setMoreSheetWorkspace(workspace)
		setMoreSheetOpen(true)
	}, [])

	const closeMoreSheet = useCallback(() => {
		setMoreSheetOpen(false)
		setMoreSheetWorkspace(null)
	}, [])

	const openCreateSheet = useCallback(() => {
		setCreateSheetOpen(true)
	}, [])

	const closeCreateSheet = useCallback(() => {
		setCreateSheetOpen(false)
	}, [])

	const handleCreateWorkspace = useCallback(
		async (name: string) => {
			const trimmedName = name.trim()
			if (!trimmedName) return
			try {
				// 移动端工作空间列表页创建成功后仅刷新列表，避免公共服务自动切换工作区并触发详情页跳转。
				await SuperMagicService.workspace.createWorkspace(trimmedName)
				// 刷新列表（重置到第 1 页），保持当前页面停留在工作空间列表。
				await fetchWorkspacesPage1()
				magicToast.success(t("workspace.createWorkspaceSuccess"))
				closeCreateSheet()
			} catch (error) {
				console.error("创建工作区失败:", error)
			}
		},
		[t, closeCreateSheet, fetchWorkspacesPage1],
	)

	const handleRenameWorkspace = useCallback(
		async (id: string, name: string) => {
			const trimmedName = name.trim()
			if (!trimmedName) return
			try {
				await SuperMagicService.workspace.renameWorkspaceWithRefresh(id, trimmedName)
				magicToast.success(t("workspace.renameWorkspaceSuccess"))
			} catch (error) {
				console.error("重命名工作区失败:", error)
			}
		},
		[t],
	)

	const handleDeleteWorkspace = useCallback(
		async (id: string) => {
			const isDeletingSelectedWorkspace = workspaceStore.selectedWorkspace?.id === id

			try {
				await SuperMagicService.workspace.deleteWorkspace(id)
				if (isDeletingSelectedWorkspace) {
					// 列表页删除只更新当前列表，不跳详情；但若删的是当前选中工作区，
					// 仍需清空项目/话题，避免后续页面继续引用已删除工作区下的旧上下文。
					SuperMagicService.clearProjectAndTopicSelection()
				}
				magicToast.success(t("workspace.deleteWorkspaceSuccess"))
				closeMoreSheet()
			} catch (error) {
				console.error("删除工作区失败:", error)
			}
		},
		[t, closeMoreSheet],
	)

	/**
	 * 新重构版工作空间列表点击后直接进入新详情页，避免回落到旧的 Super 路由流。
	 */
	const handleSelectWorkspace = useCallback(
		(workspace: Workspace) => {
			workspaceStore.setSelectedWorkspace(workspace)
			navigate({
				name: RouteName.SuperWorkspaceProjects,
				params: {
					workspaceId: workspace.id,
				},
			})
		},
		[navigate],
	)

	/**
	 * 共享工作区是前端虚拟入口，直接构造运行态数据并进入新移动端共享项目页。
	 */
	const handleOpenSharedWorkspace = useCallback(() => {
		const shareWorkspace = SHARE_WORKSPACE_DATA(t)
		workspaceStore.setSelectedWorkspace(shareWorkspace)
		navigate({
			name: RouteName.SuperSharedWorkspace,
		})
	}, [navigate, t])

	/**
	 * 下拉刷新：重置到第 1 页并重新拉取工作空间列表。
	 */
	const handleRefresh = useCallback(async () => {
		await fetchWorkspacesPage1()
	}, [fetchWorkspacesPage1])

	/**
	 * 加载更多：请求下一页并追加到列表，不影响已选工作区。
	 */
	const loadMore = useCallback(async () => {
		const nextPage = currentPage + 1
		try {
			const res = await SuperMagicApi.getWorkspaces({
				page: nextPage,
				page_size: WORKSPACE_PAGE_SIZE,
			})
			if (res?.list.length) {
				runInAction(() => {
					workspaceStore.appendWorkspaces(res.list)
				})
				setWorkspacesTotal(res.total ?? workspacesTotal)
				setCurrentPage(nextPage)
			}
		} catch (error) {
			console.error("加载更多工作区失败:", error)
		}
	}, [currentPage, workspacesTotal])

	// 是否还有更多：当前已加载数量小于服务端总数（搜索态禁用加载更多）
	const hasMore = !debouncedSearchValue && workspaceStore.workspaces.length < workspacesTotal

	return {
		isLoading,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		allWorkspaces,
		filteredWorkspaces,
		isWorkspaceEmpty,
		isSearchEmpty,
		selectedWorkspace: workspaceStore.selectedWorkspace,
		moreSheetOpen,
		moreSheetWorkspace,
		openMoreSheet,
		closeMoreSheet,
		createSheetOpen,
		openCreateSheet,
		closeCreateSheet,
		handleCreateWorkspace,
		handleRenameWorkspace,
		handleDeleteWorkspace,
		handleSelectWorkspace,
		handleOpenSharedWorkspace,
		handleRefresh,
		hasMore,
		loadMore,
	}
}
