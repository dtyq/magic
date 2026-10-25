import { type ChangeEventHandler, memo, useLayoutEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
	CollaborationProjectCreator,
	CollaborationProjectType,
	type CollaborationProjectListItem,
	Workspace,
	CollaborationJoinMethod,
} from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { useDebounce, useMemoizedFn } from "ahooks"
import { CreatorFilter, SortSelector, ViewToggle } from "./components"
import { SortType, ViewMode } from "../../../EmptyWorkspacePanel/components/ProjectItem"
import { Tabs } from "antd"
import useCollaboratorUpdatePanel from "../../../WithCollaborators/hooks/useCollaboratorUpdatePanel"
import useAddCollaborationToWorkspaceModal from "../AddCollaborationToWorkspaceModal/hooks/useAddCollaborationToWorkspaceModal"
import { FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import { FetchProjectsParams } from "@/pages/superMagic/hooks/useProjects"
import { useViewTogglePersistValue } from "./components/ViewToggle/hooks"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { userStore } from "@/models/user"
import magicToast from "@/components/base/MagicToaster/utils"

import { ProjectsPanelToolbar } from "../ProjectsPanelToolbar"
import { ProjectsPanelList } from "../ProjectsPanel"
import { Button } from "@/components/shadcn-ui/button"
import { useCollaborationProjects } from "./useCollaborationProjects"

interface CollaborationProjectsContentProps {
	open: boolean
	location: string
	onSearchValueChange: ChangeEventHandler<HTMLInputElement>
	searchValue: string
	onClose?: () => void
	onCollaborationProjectClick: (project: CollaborationProjectListItem) => void
	workspaces: Workspace[]
	selectedWorkspace: Workspace | null
	fetchProjects: (params: FetchProjectsParams) => void
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
}

interface ProjectListProps {
	location: string
	searchValue: string
	onSearchValueChange: ChangeEventHandler<HTMLInputElement>
	query: ReturnType<typeof useCollaborationProjects>
	tabType: CollaborationProjectType
	currentTab: CollaborationProjectType
	joinType: CollaborationJoinMethod
	creatorFilter: CollaborationProjectCreator[]
	sortType: SortType
	viewMode: ViewMode
	onCreatorFilterChange: (value: CollaborationProjectCreator) => void
	onSortTypeChange: (value: SortType) => void
	onViewModeChange: (value: ViewMode) => void
	onProjectClick: (project: CollaborationProjectListItem) => void
	onPinProject: (project: CollaborationProjectListItem, isPin: boolean) => void
	onAddCollaborators: (project: CollaborationProjectListItem) => void
	onAddWorkspaceShortcut: (project: CollaborationProjectListItem) => void
	onCancelWorkspaceShortcut: (projectId: string, workspaceId?: string) => void
	onShortcutNavigateToWorkspace: (project: CollaborationProjectListItem) => void
}

function SharedProjectList({
	location,
	searchValue,
	onSearchValueChange,
	query,
	tabType,
	currentTab,
	joinType,
	creatorFilter,
	sortType,
	viewMode,
	onCreatorFilterChange,
	onSortTypeChange,
	onViewModeChange,
	onProjectClick,
	...actions
}: ProjectListProps) {
	const { t } = useTranslation("super")
	return (
		<ProjectsPanelList
			projects={query.projects}
			loading={query.loading}
			total={query.total}
			error={
				query.failed && (
					<div role="alert" className="flex items-center justify-center gap-2 py-4">
						<span>{t("sidebarPanels.projectsLoadFailed")}</span>
						<Button variant="outline" onClick={() => void query.retry()}>
							{t("sidebarPanels.retry")}
						</Button>
					</div>
				)
			}
			footer={
				!query.failed &&
				query.hasMore && (
					<div className="flex justify-center py-4">
						<Button
							variant="outline"
							disabled={query.loading}
							onClick={() => void query.loadMore()}
						>
							{t("sidebarPanels.loadMore")}
						</Button>
					</div>
				)
			}
			tabType={tabType}
			viewMode={viewMode}
			toolbar={
				<ProjectsPanelToolbar
					location={location}
					total={query.total}
					searchValue={searchValue}
					onSearchValueChange={onSearchValueChange}
					viewToggle={<ViewToggle value={viewMode} onChange={onViewModeChange} />}
				>
					{tabType === CollaborationProjectType.Received &&
						currentTab === CollaborationProjectType.Received &&
						joinType === CollaborationJoinMethod.Internal && (
							<CreatorFilter value={creatorFilter} onChange={onCreatorFilterChange} />
						)}
					<SortSelector value={sortType} onChange={onSortTypeChange} compact />
				</ProjectsPanelToolbar>
			}
			itemProps={{
				...actions,
				onClick: onProjectClick,
				sortType,
				inCollaborationPanel: true,
			}}
		/>
	)
}

export function CollaborationProjectsContent(props: CollaborationProjectsContentProps) {
	const { workspaces, fetchWorkspaces, selectedWorkspace, fetchProjects } = props
	const { t } = useTranslation("super")
	const { isPersonalOrganization } = userStore.user

	const debouncedSearchValue = useDebounce(props.searchValue, { wait: 500 })

	const [currentTab, setCurrentTab] = useState<CollaborationProjectType>(
		CollaborationProjectType.Received,
	)
	const [joinType] = useState<CollaborationJoinMethod>(
		// Team edition cannot share externally; only personal edition can
		isPersonalOrganization ? CollaborationJoinMethod.link : CollaborationJoinMethod.Internal,
	)

	// Control bar states
	const { viewMode, setViewMode } = useViewTogglePersistValue({
		localStorageKey: "collaboration_projects_panel_view_toggle_value",
		defaultValue: ViewMode.LIST,
	})
	const [sortType, setSortType] = useState<SortType>(SortType.PROJECT_UPDATE_TIME)
	const [creatorFilter, setCreatorFilter] = useState<CollaborationProjectCreator[]>([])

	const handleCreatorFilterChange = useMemoizedFn((value: CollaborationProjectCreator) => {
		if (creatorFilter.some((item) => item.user_id === value.user_id))
			setCreatorFilter(creatorFilter.filter((item) => item.user_id !== value.user_id))
		else setCreatorFilter([...creatorFilter, value])
	})

	const handleSortTypeChange = useMemoizedFn((value: SortType) => setSortType(value))
	const handleViewModeChange = useMemoizedFn((value: ViewMode) => setViewMode(value))

	// Per-tab cached data to avoid stale content when switching tabs
	// Refresh all tabs when filter/sort params change
	const queryOptions = {
		open: props.open,
		name: debouncedSearchValue,
		sortType,
		joinType,
		creatorFilter,
	}
	// 打开和参数变化共用一次预取；动作后的刷新仍由原回调显式触发。
	const received = useCollaborationProjects({
		...queryOptions,
		tab: CollaborationProjectType.Received,
	})
	const shared = useCollaborationProjects({
		...queryOptions,
		tab: CollaborationProjectType.Shared,
	})

	// Refetch both tabs — used after actions that affect all tabs
	const refetchAllTabs = useMemoizedFn(() => {
		void received.refresh()
		void shared.refresh()
	})

	useLayoutEffect(() => {
		if (props.open) setCurrentTab(CollaborationProjectType.Received)
	}, [props.open])

	const handleClose = useMemoizedFn(() => {
		received.cancel()
		shared.cancel()
		setCurrentTab(CollaborationProjectType.Received)
		handleSortTypeChange(SortType.PROJECT_UPDATE_TIME)
		setCreatorFilter([])
		props.onClose?.()
	})

	const handleProjectClick = useMemoizedFn((project: CollaborationProjectListItem) => {
		props.onCollaborationProjectClick(project)
		handleClose()
	})

	const handlePinProject = useMemoizedFn(
		async (project: CollaborationProjectListItem, isPin: boolean) => {
			const workspaceId =
				project.workspace_id || project.bind_workspace_id || selectedWorkspace?.id
			if (!workspaceId) return
			try {
				await SuperMagicService.project.pinProject(project, isPin)
				refetchAllTabs()
				if (
					project.workspace_id === selectedWorkspace?.id ||
					project.bind_workspace_id === selectedWorkspace?.id
				) {
					fetchProjects?.({
						workspaceId: selectedWorkspace?.id,
						isAutoSelect: false,
						isSelectLast: false,
						isEditLast: false,
						clearWhenNoProjects: false,
					})
				}
			} catch {
				// Error already handled in service
			}
		},
	)

	const [selectedCollaborationProject, setSelectedCollaborationProject] =
		useState<CollaborationProjectListItem | null>(null)

	const { openManageModal, CollaboratorUpdatePanel } = useCollaboratorUpdatePanel({
		selectedProject: selectedCollaborationProject,
		onClose: () => {
			setSelectedCollaborationProject(null)
			// 与最近项目保持一致，成员或共享设置退出后重新取得列表及可用操作。
			refetchAllTabs()
		},
	})

	const onAddCollaborators = useMemoizedFn((project: CollaborationProjectListItem) => {
		setSelectedCollaborationProject(project)
		openManageModal()
	})

	const { AddCollaborationToWorkspaceModal, onOpen: onAddWorkspaceShortcut } =
		useAddCollaborationToWorkspaceModal({
			workspaces,
			fetchWorkspaces,
			onSuccess: (workspaceId) => {
				refetchAllTabs()
				if (workspaceId === selectedWorkspace?.id) {
					fetchProjects?.({
						workspaceId,
						isAutoSelect: false,
						isSelectLast: false,
						isEditLast: false,
						clearWhenNoProjects: false,
					})
				}
			},
		})

	const cancelWorkspaceShortcut = useMemoizedFn(
		async (projectId: string, workspaceId?: string) => {
			if (!workspaceId) return
			try {
				await SuperMagicService.project.cancelWorkspaceShortcut(projectId, workspaceId)
				magicToast.success(t("project.cancelWorkspaceShortcutSuccess"))
				if (workspaceId === selectedWorkspace?.id) {
					fetchProjects?.({
						workspaceId,
						isAutoSelect: false,
						isSelectLast: false,
						isEditLast: false,
						clearWhenNoProjects: false,
					})
				}
				refetchAllTabs()
			} catch {
				// Error already handled in service
			}
		},
	)

	const shortcutNavigateToWorkspace = useMemoizedFn((project: CollaborationProjectListItem) => {
		if (project.bind_workspace_id) {
			routeManageService.navigateToState({ workspaceId: project.bind_workspace_id })
			handleClose()
		}
	})

	// Shared props for both ProjectList instances
	const sharedListProps = useMemo(
		() => ({
			location: props.location,
			searchValue: props.searchValue,
			onSearchValueChange: props.onSearchValueChange,
			currentTab,
			joinType,
			creatorFilter,
			sortType,
			viewMode,
			onCreatorFilterChange: handleCreatorFilterChange,
			onSortTypeChange: handleSortTypeChange,
			onViewModeChange: handleViewModeChange,
			onProjectClick: handleProjectClick,
			onPinProject: handlePinProject,
			onAddCollaborators,
			onAddWorkspaceShortcut,
			onCancelWorkspaceShortcut: cancelWorkspaceShortcut,
			onShortcutNavigateToWorkspace: shortcutNavigateToWorkspace,
		}),
		// Only re-compute when stable identities change — all handlers are memoized
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			currentTab,
			joinType,
			creatorFilter,
			sortType,
			viewMode,
			props.location,
			props.searchValue,
			props.onSearchValueChange,
		],
	)

	return (
		<>
			{/* Tabs — both panes stay mounted to avoid remount lag on switch */}
			<Tabs
				activeKey={currentTab}
				onChange={(key) => setCurrentTab(key as CollaborationProjectType)}
				className="min-h-0 flex-1 [&_.magic-tabs-content-holder]:flex [&_.magic-tabs-content-holder]:min-h-0 [&_.magic-tabs-content-holder]:flex-1 [&_.magic-tabs-content]:flex [&_.magic-tabs-content]:min-h-0 [&_.magic-tabs-content]:flex-1 [&_.magic-tabs-nav]:!mb-0 [&_.magic-tabs-nav]:shrink-0 [&_.magic-tabs-nav]:!pl-5 [&_.magic-tabs-tabpane-active]:flex [&_.magic-tabs-tabpane-active]:min-h-0 [&_.magic-tabs-tabpane-active]:flex-1 [&_.magic-tabs-tabpane-active]:flex-col"
				destroyOnHidden={false}
				data-testid="shared-workspace-dialog-tabs"
				items={[
					{
						label: (
							<span data-testid="shared-workspace-dialog-tab-received">
								{joinType === CollaborationJoinMethod.Internal
									? t("workspace.teamSharedWithMe")
									: t("workspace.externalSharedWithMe")}
							</span>
						),
						key: CollaborationProjectType.Received,
						children: (
							<SharedProjectList
								{...sharedListProps}
								tabType={CollaborationProjectType.Received}
								query={received}
							/>
						),
					},
					{
						label: (
							<span data-testid="shared-workspace-dialog-tab-shared">
								{t("workspace.sharedByMe")}
							</span>
						),
						key: CollaborationProjectType.Shared,
						children: (
							<SharedProjectList
								{...sharedListProps}
								tabType={CollaborationProjectType.Shared}
								query={shared}
							/>
						),
					},
				]}
			/>
			{CollaboratorUpdatePanel}
			{AddCollaborationToWorkspaceModal}
		</>
	)
}

export default memo(CollaborationProjectsContent)
