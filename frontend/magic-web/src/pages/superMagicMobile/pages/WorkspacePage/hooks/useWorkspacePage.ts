import { useEffect, useMemo, useState } from "react"
import { useDebounce, useMemoizedFn, useRequest } from "ahooks"
import { runInAction } from "mobx"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { SuperMagicApi } from "@/apis"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import magicToast from "@/components/base/MagicToaster/utils"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import {
	navigateSuperMobileBack,
	readSuperMobileReturnTo,
} from "@/pages/superMagicMobile/layout/MainLayout/components/MainHeader/backNavigation"
import { resolveWorkspaceDetailDeleteFallback } from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { formatRelativeTime } from "@/utils/string"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import type React from "react"

const PROJECT_PAGE_SIZE = 100

export interface RefreshWorkspaceProjectsOptions {
	/** 为 true 时不触发 useRequest loading，用于删除/重命名等操作后的后台同步 */
	silent?: boolean
}

export interface UseWorkspacePageReturn {
	selectedWorkspace: Workspace | null
	projects: ProjectListItem[]
	isLoading: boolean
	searchValue: string
	setSearchValue: (value: string) => void
	debouncedSearchValue: string
	filteredProjects: ProjectListItem[]
	projectTimeLabels: Record<string, string>
	createProjectSheetOpen: boolean
	moreSheetOpen: boolean
	moreSheetWorkspace: Workspace | null
	openCreateProjectSheet: () => void
	closeCreateProjectSheet: () => void
	openMoreSheet: (workspace: Workspace) => void
	closeMoreSheet: () => void
	isProjectEmpty: boolean
	isSearchEmpty: boolean
	handleBack: () => void
	handleRefreshProjects: (options?: RefreshWorkspaceProjectsOptions) => Promise<void>
	handleCreateProject: (projectName: string) => Promise<void>
	handleOpenProject: (project: ProjectListItem) => void
	handleRenameWorkspace: (id: string, name: string) => Promise<void>
	handleDeleteWorkspace: (id: string) => Promise<void>
	handleMoreProjectSwipe: (project: ProjectListItem) => void
	handlePinProjectSwipe: (project: ProjectListItem) => Promise<void>
	handleDeleteProjectSwipe: (project: ProjectListItem) => void
	projectActionComponents: React.ReactNode
	/** 是否还有更多项目未加载 */
	hasMore: boolean
	/** 加载下一页项目 */
	loadMore: () => Promise<void>
}

/**
 * 负责工作区页的状态编排，让页面视图只关心展示和交互绑定。
 */
export function useWorkspacePage(): UseWorkspacePageReturn {
	const { t, i18n } = useTranslation("super")
	const navigate = useNavigate()
	const location = useLocation()
	const { workspaceId } = useParams<{ workspaceId: string }>()
	const selectedWorkspace =
		workspaceId && workspaceStore.selectedWorkspace?.id !== workspaceId
			? workspaceStore.getWorkspaceById(workspaceId)
			: workspaceStore.selectedWorkspace
	const projects = projectStore.projects

	const [searchValue, setSearchValue] = useState("")
	// 输入框展示保持实时，项目过滤只消费防抖后的关键字，避免频繁重算列表。
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 300 })
	const [createProjectSheetOpen, setCreateProjectSheetOpen] = useState(false)
	const [moreSheetOpen, setMoreSheetOpen] = useState(false)
	const [moreSheetWorkspace, setMoreSheetWorkspace] = useState<Workspace | null>(null)
	/** 乐观删除：在服务端确认前先从列表移除，避免 reload 竞态导致项目短暂复现 */
	const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set())
	// 分页状态：追踪服务端总数和当前已加载到第几页
	const [projectsTotal, setProjectsTotal] = useState(0)
	const [currentPage, setCurrentPage] = useState(1)

	/**
	 * 进入新重构详情页时优先按路由参数恢复工作区，保证刷新后仍能拿到正确上下文。
	 */
	useEffect(() => {
		if (!workspaceId) return
		if (workspaceStore.selectedWorkspace?.id === workspaceId) return

		const cachedWorkspace = workspaceStore.getWorkspaceById(workspaceId)
		if (cachedWorkspace) {
			workspaceStore.setSelectedWorkspace(cachedWorkspace)
			return
		}

		void SuperMagicService.workspace
			.getWorkspaceDetail(workspaceId, {
				enableErrorMessagePrompt: false,
			})
			.then((workspace) => {
				if (!workspace) return
				workspaceStore.setSelectedWorkspace(workspace)
			})
			.catch((error) => {
				console.error("加载工作区详情失败:", error)
			})
	}, [workspaceId])

	/**
	 * 拉取工作区第 1 页项目并写回 store，供 useRequest 与静默刷新共用，避免重复拼装请求逻辑。
	 */
	const fetchProjectsForWorkspace = useMemoizedFn(async (workspaceId: string) => {
		const res = await SuperMagicApi.getProjectsWithCollaboration({
			workspace_id: workspaceId,
			page: 1,
			page_size: PROJECT_PAGE_SIZE,
		})
		runInAction(() => {
			projectStore.setProjects(res.list)
			projectStore.setProjectsForWorkspace(workspaceId, res.list)
		})
		setProjectsTotal(res.total ?? res.list.length)
		setCurrentPage(1)
		return res.list
	})

	/**
	 * 进入页面或切换工作区后刷新项目列表，直接调 API 以便同时拿到 total，避免二次请求。
	 */
	const { loading: isLoading, run: fetchProjects } = useRequest(
		async (workspaceId?: string) => {
			if (!workspaceId) return []
			return fetchProjectsForWorkspace(workspaceId)
		},
		{
			manual: true,
			refreshDeps: [selectedWorkspace?.id],
			ready: Boolean(selectedWorkspace?.id),
		},
	)

	/**
	 * 当前工作区变化时主动回补一次项目列表，确保路由直达场景也能拿到数据。
	 */
	useEffect(() => {
		if (!selectedWorkspace?.id) return
		void fetchProjects(selectedWorkspace.id)
	}, [fetchProjects, selectedWorkspace?.id])

	/**
	 * 工作区项目搜索按当前 API 口径保持前端本地过滤，不发明服务端搜索协议。
	 * 同时过滤掉乐观删除中的项目 ID，避免删除后列表短暂复现。
	 */
	const filteredProjects = useMemo(() => {
		const keyword = debouncedSearchValue.toLowerCase()

		return projects
			.filter((project) => !pendingRemoveIds.has(project.id))
			.filter((project) =>
				keyword ? (project.project_name ?? "").toLowerCase().includes(keyword) : true,
			)
	}, [debouncedSearchValue, pendingRemoveIds, projects])

	/**
	 * 项目列表副标题统一复用相对时间格式，避免不同移动端入口各自维护一套时间展示文案。
	 */
	const projectTimeLabels = useMemo(() => {
		return filteredProjects.reduce<Record<string, string>>((acc, project) => {
			const rawTime = project.last_active_at || project.updated_at || project.created_at

			if (!rawTime) {
				acc[project.id] = ""
				return acc
			}

			acc[project.id] = formatRelativeTime(i18n.language)(rawTime)
			return acc
		}, {})
	}, [filteredProjects, i18n.language])

	/**
	 * Prefer history back; when opened via deep link without history, fall back to workspace list.
	 */
	const handleBack = useMemoizedFn(() => {
		navigateSuperMobileBack({
			navigate,
			fallback: { name: RouteName.SuperWorkspacesList },
			returnTo: readSuperMobileReturnTo(location.state),
		})
	})

	/**
	 * 显式刷新当前工作区项目，用于下拉刷新和创建后回补数据。
	 * silent 刷新仅移除服务端已确认不存在的 pending id；非 silent（如下拉刷新）清空 pending。
	 */
	const handleRefreshProjects = useMemoizedFn(
		async (options?: RefreshWorkspaceProjectsOptions) => {
			if (!selectedWorkspace?.id) return

			const silent = options?.silent ?? false
			const latestProjects = silent
				? await fetchProjectsForWorkspace(selectedWorkspace.id)
				: await fetchProjects(selectedWorkspace.id)

			if (silent) {
				const latestProjectIds = new Set(latestProjects.map((project) => project.id))
				setPendingRemoveIds((prev) => {
					const next = new Set(prev)
					for (const id of prev) {
						if (!latestProjectIds.has(id)) next.delete(id)
					}
					return next
				})
				return
			}

			setPendingRemoveIds(new Set())
		},
	)

	/**
	 * 打开新建项目弹层，让顶部主操作先进入命名确认而不是立即创建。
	 */
	const openCreateProjectSheet = useMemoizedFn(() => {
		setCreateProjectSheetOpen(true)
	})

	/**
	 * 关闭新建项目弹层，并把关闭行为集中在容器层统一管理。
	 */
	const closeCreateProjectSheet = useMemoizedFn(() => {
		setCreateProjectSheetOpen(false)
	})

	/**
	 * 新建项目时仅刷新当前工作区列表，让用户继续停留在当前页完成后续操作。
	 */
	const handleCreateProject = useMemoizedFn(async (projectName: string) => {
		if (!selectedWorkspace) return
		const normalizedProjectName = projectName.trim()
		if (!normalizedProjectName) return

		try {
			const result = await SuperMagicService.handleCreateProject({
				projectMode: TopicMode.Empty,
				isAutoSelect: false,
				projectName: normalizedProjectName,
			})

			if (!result?.project) {
				magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
				return
			}

			magicToast.success(t("project.createProjectSuccess"))
			closeCreateProjectSheet()
			await handleRefreshProjects()
		} catch (error) {
			magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
			console.error("创建项目失败:", error)
		}
	})

	/**
	 * 点击列表项时只负责切换项目，让详情页自行承载后续话题链路。
	 */
	const handleOpenProject = useMemoizedFn((project: ProjectListItem) => {
		if (!project?.id) return
		SuperMagicService.switchProjectInMobile(project)
	})

	/**
	 * 工作区级更多操作仅承载重命名与删除，符合当前工作包白名单。
	 */
	const openMoreSheet = useMemoizedFn((workspace: Workspace) => {
		setMoreSheetWorkspace(workspace)
		setMoreSheetOpen(true)
	})

	/**
	 * 关闭更多操作时同步清理上下文，避免误操作残留到下次打开。
	 */
	const closeMoreSheet = useMemoizedFn(() => {
		setMoreSheetOpen(false)
		setMoreSheetWorkspace(null)
	})

	/**
	 * 工作区重命名后保留当前页面上下文，仅做数据刷新与提示。
	 */
	const handleRenameWorkspace = useMemoizedFn(async (id: string, name: string) => {
		const trimmedName = name.trim()
		if (!trimmedName) return

		try {
			await SuperMagicService.workspace.renameWorkspaceWithRefresh(id, trimmedName)
			magicToast.success(t("workspace.renameWorkspaceSuccess"))
			closeMoreSheet()
		} catch (error) {
			console.error("重命名工作区失败:", error)
		}
	})

	/**
	 * 删除工作区后交给既有 service 处理后续选中态与跳转逻辑。
	 */
	const handleDeleteWorkspace = useMemoizedFn(async (id: string) => {
		const isDeletingCurrentWorkspace = workspaceId === id

		try {
			await SuperMagicService.workspace.deleteWorkspace(id)
			if (isDeletingCurrentWorkspace) {
				SuperMagicService.clearProjectAndTopicSelection()
			}
			magicToast.success(t("workspace.deleteWorkspaceSuccess"))
			closeMoreSheet()
			if (isDeletingCurrentWorkspace) {
				// 详情页删除：返回上一级；无历史时兜底到工作区列表（与项目详情删除一致）。
				navigateSuperMobileBack({
					navigate,
					fallback: resolveWorkspaceDetailDeleteFallback(),
				})
			}
		} catch (error) {
			console.error("删除工作区失败:", error)
		}
	})

	/**
	 * 项目操作（重命名、置顶、移动、删除确认弹层等）由 useProjectListActions 统一管理。
	 * 注意需在 handleRefreshProjects 定义后调用，作为 onProjectChanged 回调。
	 */
	const {
		openActionsPopup: openProjectActionsPopup,
		openProjectDeleteConfirm,
		updateCurrentActionItem: updateProjectActionItem,
		handlePinProject,
		projectActionComponents,
	} = useProjectListActions({
		mode: "default",
		onProjectChanged: () => handleRefreshProjects({ silent: true }),
		onDeleteProjectConfirmed: async (project) => {
			try {
				setPendingRemoveIds((prev) => new Set([...prev, project.id]))
				await SuperMagicService.deleteProject(project, {
					selectedProjectBehavior: "switch-next",
					lastUsedWorkspaceId: selectedWorkspace?.id,
				})
				await handleRefreshProjects({ silent: true })
			} catch {
				await handleRefreshProjects({ silent: true })
				magicToast.error(t("project.deleteProjectFailed"))
				throw new Error("delete project failed")
			}
		},
	})

	/** 项目左滑"更多"：设置当前操作项，打开项目操作面板 */
	const handleMoreProjectSwipe = useMemoizedFn((project: ProjectListItem) => {
		updateProjectActionItem(project)
		openProjectActionsPopup(project)
	})

	/** 项目左滑"置顶/取消置顶"：直接调 pin 服务，完成后刷新列表 */
	const handlePinProjectSwipe = useMemoizedFn(async (project: ProjectListItem) => {
		try {
			await handlePinProject(project)
		} catch {
			magicToast.error(
				project.is_pinned
					? t("hierarchicalWorkspacePopup.unpinProjectFailed")
					: t("hierarchicalWorkspacePopup.pinProjectFailed"),
			)
		}
	})

	/**
	 * 项目左滑"删除"：先弹出二次确认，确认后走 onDeleteProjectConfirmed 乐观删除链路。
	 */
	const handleDeleteProjectSwipe = useMemoizedFn((project: ProjectListItem) => {
		openProjectDeleteConfirm(project)
	})

	const isProjectEmpty = !isLoading && !debouncedSearchValue && projectStore.projects.length === 0
	const isSearchEmpty =
		!isLoading && Boolean(debouncedSearchValue) && filteredProjects.length === 0

	/**
	 * 加载更多项目：请求下一页并追加到 store。
	 * 搜索态下禁止加载更多，保持一次性全量本地过滤行为。
	 */
	const loadMore = useMemoizedFn(async () => {
		if (!selectedWorkspace?.id) return
		// 搜索态不加载更多，保持一次性全量本地过滤行为
		if (debouncedSearchValue) return
		const nextPage = currentPage + 1
		try {
			const res = await SuperMagicApi.getProjectsWithCollaboration({
				workspace_id: selectedWorkspace.id,
				page: nextPage,
				page_size: PROJECT_PAGE_SIZE,
			})
			if (res.list.length) {
				runInAction(() => {
					projectStore.appendProjects(res.list)
				})
				setProjectsTotal(res.total ?? projectsTotal)
				setCurrentPage(nextPage)
			}
		} catch (error) {
			console.error("加载更多项目失败:", error)
		}
	})

	// 是否还有更多项目（搜索态禁用加载更多，结果为本地全量过滤）
	const hasMore = !debouncedSearchValue && projectStore.projects.length < projectsTotal

	return {
		selectedWorkspace,
		projects,
		isLoading,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		filteredProjects,
		projectTimeLabels,
		createProjectSheetOpen,
		moreSheetOpen,
		moreSheetWorkspace,
		openCreateProjectSheet,
		closeCreateProjectSheet,
		openMoreSheet,
		closeMoreSheet,
		isProjectEmpty,
		isSearchEmpty,
		handleBack,
		handleRefreshProjects,
		handleCreateProject,
		handleOpenProject,
		handleRenameWorkspace,
		handleDeleteWorkspace,
		handleMoreProjectSwipe,
		handlePinProjectSwipe,
		handleDeleteProjectSwipe,
		projectActionComponents,
		hasMore,
		loadMore,
	}
}
