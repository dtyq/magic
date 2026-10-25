import { useEffect, useRef, useState } from "react"
import { useMemoizedFn, useDebounce } from "ahooks"
import { reaction } from "mobx"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { SuperMagicApi } from "@/apis"
import MagicEmpty from "@/components/base/MagicEmpty"
import { Button } from "@/components/shadcn-ui/button"
import CreateProjectInput from "@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateProjectInput"
import { type Workspace } from "@/pages/superMagic/pages/Workspace/types"
import projectStore from "@/pages/superMagic/stores/core/project"
import recentProjectsStore from "@/pages/superMagic/stores/core/recentProjects"
import RecentProjectItem from "./RecentProjectItem"
import { ProjectResourceItem } from "../../SelectPathModal/components/ProjectResourceSelectorModal/ProjectResourceItem"
import {
	getResourceProjectType,
	type ResourceProject,
} from "../../SelectPathModal/resourceProjectTypes"
import ProjectItem, { SortType, ViewMode } from "../../EmptyWorkspacePanel/components/ProjectItem"
import useProjectItemActionProps from "../../EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import { SortSelector, ViewToggle } from "./CollaborationProjectsPanel/components"
import { useViewTogglePersistValue } from "./CollaborationProjectsPanel/components/ViewToggle/hooks"
import { ProjectsPanelToolbar } from "./ProjectsPanelToolbar"
import { ProjectTypeFilter, type RecentProjectType } from "./ProjectTypeFilter"
import type { ChangeEventHandler } from "react"
import { ProjectsPanelList } from "./ProjectsPanel"
import {
	isResourceWorkspace,
	loadResourceProjectPage,
} from "../../SelectPathModal/utils/resourceProjects"
import magicToast from "@/components/base/MagicToaster/utils"

interface WorkspaceProjectsContentProps {
	location: string
	onSearchValueChange: ChangeEventHandler<HTMLInputElement>
	searchValue: string
	onClearSearch: () => void
	open: boolean
	/** 不指定目录时浏览跨工作区最近项目；查询状态仍由本窗口独立持有。 */
	workspace?: Workspace
	onClose: () => void
	initialCreating?: boolean
	onCancelCreating?: () => void
}

const PAGE_SIZE = 100

export default function WorkspaceProjectsContent({
	location,
	onSearchValueChange,
	searchValue,
	onClearSearch,
	open,
	workspace,
	onClose,
	initialCreating = false,
	onCancelCreating,
}: WorkspaceProjectsContentProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const workspaceId = workspace?.id
	const recent = !workspace
	const [sortType, setSortType] = useState<SortType>(
		recent ? SortType.MY_LAST_ACTIVE_TIME : SortType.WORKSPACE_ORDER,
	)
	const [projectType, setProjectType] = useState<RecentProjectType>("all")
	const debouncedSearchValue = useDebounce(searchValue, { wait: 500 })
	const { viewMode: preferredViewMode, setViewMode } = useViewTogglePersistValue({
		localStorageKey: "workspace_projects_panel_view_toggle_value",
		defaultValue: ViewMode.LIST,
	})
	// 手机始终使用列表，但不改写用户在桌面保存的视图偏好。
	const viewMode = isMobile ? ViewMode.LIST : preferredViewMode
	const [projects, setProjects] = useState<ResourceProject[]>(() =>
		workspaceId ? projectStore.getProjectsByWorkspace(workspaceId) : [],
	)
	const [loading, setLoading] = useState(open)
	const [failed, setFailed] = useState(false)
	const [page, setPage] = useState(1)
	const failedPageRef = useRef(1)
	const [total, setTotal] = useState<number>()
	const [creating, setCreating] = useState(initialCreating)
	const requestId = useRef(0)
	const isOpenRef = useRef(open)
	const actions = useProjectItemActionProps({ selectedWorkspace: workspace ?? null })
	const request = useRef<AbortController | null>(null)
	const modalWasOpen = useRef(false)

	const load = useMemoizedFn(async (nextPage = 1) => {
		if (!isOpenRef.current) return
		const id = ++requestId.current
		request.current?.abort()
		const controller = new AbortController()
		request.current = controller
		setLoading(true)
		setFailed(false)
		try {
			const result =
				workspace && isResourceWorkspace(workspace)
					? await loadResourceProjectPage({
							workspace,
							page: nextPage,
							pageSize: PAGE_SIZE,
							keyword: debouncedSearchValue,
							signal: controller.signal,
						})
					: await SuperMagicApi.getProjectsWithCollaboration(
							{
								workspace_id: workspaceId,
								sort_mode: recent ? "recent" : "workspace",
								project_name: debouncedSearchValue,
								page: nextPage,
								page_size: PAGE_SIZE,
								show_collaboration: 1,
								include_special: recent ? 1 : 0,
								project_type: recent ? projectType : undefined,
								sort_field:
									sortType === SortType.WORKSPACE_ORDER ? undefined : sortType,
								sort_direction: "desc",
							},
							{ signal: controller.signal },
						)
			if (id !== requestId.current || controller.signal.aborted) return
			// 搜索和分页只更新本面板；全局导航缓存继续由项目 service 维护。
			const visibleList = result.list
			setProjects((previous) =>
				nextPage === 1
					? visibleList
					: [
							...previous,
							...visibleList.filter(
								(item) => !previous.some((existing) => existing.id === item.id),
							),
						],
			)
			setPage(nextPage)
			setTotal(result.total)
		} catch {
			if (id === requestId.current && !controller.signal.aborted) {
				failedPageRef.current = nextPage
				setFailed(true)
			}
		} finally {
			if (id === requestId.current) setLoading(false)
		}
	})

	useEffect(() => {
		isOpenRef.current = open
		if (!open) return
		setProjects(
			debouncedSearchValue || !workspaceId
				? []
				: projectStore.getProjectsByWorkspace(workspaceId),
		)
		setTotal(undefined)
		void load()
		return () => {
			requestId.current += 1
			request.current?.abort()
			isOpenRef.current = false
		}
	}, [open, workspaceId, debouncedSearchValue, sortType, projectType, load])

	// 普通目录订阅自己的缓存；最近分类订阅 service 的失效版本，搜索／分页不会改写侧栏快照。
	useEffect(() => {
		if (!open) return
		return reaction(
			() =>
				workspaceId
					? projectStore
							.getProjectsByWorkspace(workspaceId)
							.map((item) =>
								[item.id, item.project_name, item.is_pinned, item.updated_at].join(
									":",
								),
							)
							.join("|")
					: recentProjectsStore.revision,
			() => {
				void load()
			},
		)
	}, [open, workspaceId, load])

	useEffect(() => {
		// 与最近项目一致：动作弹窗结束后重查，不能把提前修改缓存当作服务端已完成。
		if (modalWasOpen.current && !actions.isProjectModalOpen) void load()
		modalWasOpen.current = actions.isProjectModalOpen
	}, [actions.isProjectModalOpen, load])

	const refreshAfterShortcutRemoval = (removeShortcut?: (projectId: string) => void) =>
		removeShortcut
			? async (projectId: string) => {
					await removeShortcut(projectId)
					await load()
				}
			: undefined

	const close = useMemoizedFn(() => {
		isOpenRef.current = false
		requestId.current += 1
		request.current?.abort()
		setCreating(false)
		onClose()
	})

	return (
		<>
			<ProjectsPanelList
				projects={projects}
				listLayout={workspace && isResourceWorkspace(workspace) ? "resource" : "project"}
				selectedProjectId={projectStore.selectedProject?.id}
				total={total}
				emptyContent={
					debouncedSearchValue ? (
						<div className="flex flex-col items-center gap-2 py-4">
							<MagicEmpty description={t("sidebarPanels.noMatchingProjects")} />
							<Button variant="outline" onClick={onClearSearch}>
								{t("sidebarPanels.clearSearch")}
							</Button>
						</div>
					) : undefined
				}
				loading={loading}
				viewMode={viewMode}
				renderItem={(props) => {
					// 只有资源接口返回的条目（带 resourceId）才用资源样式；普通工作区里的
					// agent/skill 模式项目来自项目列表，与其他项目共用 ProjectItem 样式和点击逻辑。
					const resourceType =
						workspace && (props.project as ResourceProject).resourceId
							? getResourceProjectType(props.project)
							: undefined
					if (resourceType) {
						const resourceProject: ResourceProject = {
							...props.project,
							resourceType,
						}
						return (
							<ProjectResourceItem
								project={resourceProject}
								viewMode={props.viewMode}
								onClick={(project) => {
									if (!project.project_id) {
										magicToast.info(t("fileManager.locateUnavailable"))
										return
									}
									props.onClick(project)
								}}
							/>
						)
					}
					return recent ? <RecentProjectItem {...props} /> : <ProjectItem {...props} />
				}}
				toolbar={
					<ProjectsPanelToolbar
						location={location}
						total={total}
						searchValue={searchValue}
						onSearchValueChange={onSearchValueChange}
						viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} />}
					>
						{recent && (
							<ProjectTypeFilter
								value={projectType}
								onChange={setProjectType}
								responsive
							/>
						)}
						{(!workspace || !isResourceWorkspace(workspace)) && (
							<SortSelector
								value={sortType}
								onChange={setSortType}
								includeWorkspaceOrder={!recent}
								compact
								responsive
							/>
						)}
						{workspace &&
							!isResourceWorkspace(workspace) &&
							(creating ? (
								<CreateProjectInput
									workspaceId={workspace.id}
									onCancel={() => {
										setCreating(false)
										onCancelCreating?.()
									}}
									onCreated={close}
								/>
							) : (
								<Button onClick={() => setCreating(true)}>
									<Plus size={16} />
									{t("sidebarPanels.createProject")}
								</Button>
							))}
					</ProjectsPanelToolbar>
				}
				itemProps={{
					titleLayout: recent ? "recent" : "default",
					mobileLayout: isMobile,
					sortType,
					onClick: (project) => {
						if (project.id !== projectStore.selectedProject?.id)
							actions.handleProjectClick(project)
						close()
					},
					onRenameProject: async (params) => {
						await actions.handleRenameProject(params)
						await load()
					},
					onPinProject: async (project, pinned) => {
						await actions.handlePinProject(project, pinned)
						await load()
					},
					onDeleteProject: actions.handleDeleteProjectConfirm,
					onMoveProject: actions.handleMoveProject,
					onTransferProject: actions.handleTransferProject,
					onAddCollaborators: actions.onAddCollaborators,
					onCancelWorkspaceShortcut: refreshAfterShortcutRemoval(
						actions.handleCancelWorkspaceShortcut,
					),
				}}
				error={
					failed && (
						<div role="alert" className="flex items-center justify-center gap-2 py-4">
							<span>{t("sidebarPanels.projectsLoadFailed")}</span>
							<Button
								variant="outline"
								onClick={() => void load(failedPageRef.current)}
							>
								{t("sidebarPanels.retry")}
							</Button>
						</div>
					)
				}
				footer={
					!failed &&
					total !== undefined &&
					projects.length < total && (
						<div className="flex justify-center py-4">
							<Button
								variant="outline"
								disabled={loading}
								onClick={() => void load(page + 1)}
							>
								{t("sidebarPanels.loadMore")}
							</Button>
						</div>
					)
				}
			/>
			{actions.projectModals}
		</>
	)
}
