import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconSearch, IconX } from "@tabler/icons-react"
import {
	CollaborationProjectCreator,
	CollaborationProjectType,
	type CollaborationProjectListItem,
	Workspace,
	CollaborationJoinMethod,
} from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "@/pages/superMagic/services"
import { useMemoizedFn } from "ahooks"
import MagicIcon from "@/components/base/MagicIcon"
import { Input } from "@/components/shadcn-ui/input"
import { CreatorFilter, SortSelector, ViewToggle } from "./components"
import ProjectItem, {
	SortType,
	ViewMode,
} from "../../../EmptyWorkspacePanel/components/ProjectItem"
import MagicEmpty from "@/components/base/MagicEmpty"
import MagicSpin from "@/components/base/MagicSpin"
import useSearchValue from "@/pages/superMagic/pages/Assistant/components/TopicPanel/hooks/useSearchValue"
import { Tabs } from "antd"
import useCollaboratorUpdatePanel from "../../../WithCollaborators/hooks/useCollaboratorUpdatePanel"
import useAddCollaborationToWorkspaceModal from "../AddCollaborationToWorkspaceModal/hooks/useAddCollaborationToWorkspaceModal"
import { FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import { FetchProjectsParams } from "@/pages/superMagic/hooks/useProjects"
import { useViewTogglePersistValue } from "./components/ViewToggle/hooks"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { userStore } from "@/models/user"
import magicToast from "@/components/base/MagicToaster/utils"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { MagicModalProps } from "@/components/base/MagicModal"
import { cn } from "@/lib/utils"

interface CollaborationProjectsPanelProps extends MagicModalProps {
	onClose?: () => void
	onCollaborationProjectClick: (project: CollaborationProjectListItem) => void
	workspaces: Workspace[]
	selectedWorkspace: Workspace | null
	fetchProjects: (params: FetchProjectsParams) => void
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
}

const gridClassName = cn(
	"grid gap-2.5",
	"[grid-template-columns:repeat(6,1fr)]",
	"max-[1750px]:[grid-template-columns:repeat(5,1fr)]",
	"max-[1500px]:[grid-template-columns:repeat(4,1fr)]",
	"max-[1250px]:[grid-template-columns:repeat(3,1fr)]",
	"max-[1000px]:[grid-template-columns:repeat(2,1fr)]",
)

const contentClassName = cn(
	"h-[70vh] overflow-y-auto rounded-b-[12px] bg-gray-50 px-5 pb-5 dark:bg-white/5",
	"[&::-webkit-scrollbar]:w-[6px]",
	"[&::-webkit-scrollbar-thumb]:rounded-[4px] [&::-webkit-scrollbar-thumb]:bg-border",
	"[&::-webkit-scrollbar-track]:bg-transparent",
)

interface ProjectListProps {
	projects: CollaborationProjectListItem[]
	loading: boolean
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
	refetchProjects: () => void
}

const ProjectList = memo(function ProjectList({
	projects,
	loading,
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
	onPinProject,
	onAddCollaborators,
	onAddWorkspaceShortcut,
	onCancelWorkspaceShortcut,
	onShortcutNavigateToWorkspace,
	refetchProjects,
}: ProjectListProps) {
	const { t } = useTranslation("super")

	return (
		<MagicSpin section spinning={loading}>
			{/* Control bar */}
			<div className="bg-gray-50 px-5 pb-2.5 pt-5 dark:bg-white/5">
				<div className="flex items-center justify-between gap-2.5">
					<div className="text-sm font-semibold leading-5 text-foreground/80 opacity-80">
						{t("workspace.projects")} · {projects.length}
					</div>
					<div className="flex items-center gap-2.5">
						{tabType === CollaborationProjectType.Received &&
							currentTab === CollaborationProjectType.Received &&
							joinType === CollaborationJoinMethod.Internal && (
								<CreatorFilter
									value={creatorFilter}
									onChange={onCreatorFilterChange}
								/>
							)}
						<SortSelector value={sortType} onChange={onSortTypeChange} />
						<ViewToggle value={viewMode} onChange={onViewModeChange} />
					</div>
				</div>
			</div>

			{/* Project list */}
			<div className={contentClassName}>
				<div className={gridClassName}>
					{projects.map((item, index) => {
						const projectItemKey = [
							item.id,
							item.updated_at,
							item.last_active_at || "",
							item.is_pinned ? "1" : "0",
							item.bind_workspace_id || "",
							viewMode,
						].join("-")

						return (
							<ProjectItem<CollaborationProjectListItem>
								key={projectItemKey}
								index={index}
								project={item}
								onClick={onProjectClick}
								onPinProject={onPinProject}
								onAddCollaborators={onAddCollaborators}
								onAddWorkspaceShortcut={onAddWorkspaceShortcut}
								onCancelWorkspaceShortcut={onCancelWorkspaceShortcut}
								onShortcutNavigateToWorkspace={onShortcutNavigateToWorkspace}
								refetchProjects={refetchProjects}
								viewMode={viewMode}
								sortType={sortType}
								inCollaborationPanel
							/>
						)
					})}
				</div>
				{projects.length <= 0 && <MagicEmpty description={t("project.noProjects")} />}
			</div>
		</MagicSpin>
	)
})

function CollaborationProjectsPanel(props: CollaborationProjectsPanelProps) {
	const { workspaces, fetchWorkspaces, selectedWorkspace, fetchProjects } = props
	const { t } = useTranslation("super")
	const { isPersonalOrganization } = userStore.user

	const { searchValue, onSearchValueChange, debouncedSearchValue, setSearchValue } =
		useSearchValue({ debounceWait: 500 })

	// Per-tab cached data to avoid stale content when switching tabs
	const [receivedProjects, setReceivedProjects] = useState<CollaborationProjectListItem[]>([])
	const [sharedProjects, setSharedProjects] = useState<CollaborationProjectListItem[]>([])
	const [loadingReceived, setLoadingReceived] = useState(false)
	const [loadingShared, setLoadingShared] = useState(false)

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

	const fetchForTab = useMemoizedFn(
		(
			tab: CollaborationProjectType,
			{ resetWhenError = false }: { resetWhenError?: boolean } = {},
		) => {
			const setLoading =
				tab === CollaborationProjectType.Received ? setLoadingReceived : setLoadingShared
			const setProjects =
				tab === CollaborationProjectType.Received ? setReceivedProjects : setSharedProjects

			setLoading(true)
			SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: 99,
				name: debouncedSearchValue,
				type: tab,
				sort_field: sortType,
				sort_direction: "desc",
				creator_user_ids:
					tab === CollaborationProjectType.Received &&
						joinType === CollaborationJoinMethod.Internal &&
						creatorFilter.length > 0
						? creatorFilter.map((item) => item.user_id)
						: undefined,
				join_method: joinType,
			})
				.then((res) => setProjects(res?.list || []))
				.catch(() => {
					if (resetWhenError) setProjects([])
				})
				.finally(() => setLoading(false))
		},
	)

	// Refetch current tab — used by action callbacks (pin, shortcut, etc.)
	const refetchProjects = useMemoizedFn(
		({ resetWhenError = false }: { resetWhenError?: boolean } = {}) => {
			fetchForTab(currentTab, { resetWhenError })
		},
	)

	// Refetch both tabs — used after actions that affect all tabs
	const refetchAllTabs = useMemoizedFn(() => {
		fetchForTab(CollaborationProjectType.Received)
		fetchForTab(CollaborationProjectType.Shared)
	})

	useEffect(() => {
		if (props.open) {
			setCurrentTab(CollaborationProjectType.Received)
			fetchForTab(CollaborationProjectType.Received, { resetWhenError: true })
			fetchForTab(CollaborationProjectType.Shared, { resetWhenError: true })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.open])

	// Refresh all tabs when filter/sort params change
	useEffect(() => {
		if (!props.open) return
		refetchAllTabs()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedSearchValue, creatorFilter, sortType])

	const handleClose = useMemoizedFn(() => {
		setSearchValue("")
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
		onClose: () => setSelectedCollaborationProject(null),
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
			refetchProjects,
		}),
		// Only re-compute when stable identities change — all handlers are memoized
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[currentTab, joinType, creatorFilter, sortType, viewMode],
	)

	// Stable per-tab fetch callbacks for ProjectList's refetchProjects prop
	const refetchReceived = useCallback(
		() => fetchForTab(CollaborationProjectType.Received),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)
	const refetchShared = useCallback(
		() => fetchForTab(CollaborationProjectType.Shared),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)

	return (
		<Dialog open={props.open}>
			{props.open && (
				<DialogContent
					showCloseButton={false}
					className="!w-[80vw] !max-w-[2000px] gap-0 overflow-hidden p-0"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={handleClose}
				>
					{/* Dialog header */}
					<div className="flex items-center justify-between gap-2.5 px-5 pb-0 pt-5">
						<div className="flex min-w-0 flex-col gap-1">
							<div className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold leading-[22px] text-foreground/80">
								{t("workspace.collaborationProjectsTitle")}
							</div>
							<div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-foreground/35">
								{t("workspace.collaborationProjectsDesc")}
							</div>
						</div>
						<div className="flex items-center gap-2.5">
							<div className="relative w-[220px]">
								<IconSearch
									size={16}
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									className="bg-fill pl-9"
									placeholder={t("project.searchProject")}
									onChange={onSearchValueChange}
									value={searchValue}
								/>
							</div>
							<div
								className="flex cursor-pointer items-center justify-center rounded-[6px] p-1.5 hover:bg-fill active:bg-fill-secondary"
								onClick={(e) => {
									e.stopPropagation()
									handleClose()
								}}
							>
								<MagicIcon component={IconX} size={24} />
							</div>
						</div>
					</div>

					{/* Tabs — both panes stay mounted to avoid remount lag on switch */}
					<Tabs
						activeKey={currentTab}
						onChange={(key) => setCurrentTab(key as CollaborationProjectType)}
						className="[&_.magic-tabs-nav]:!mb-0 [&_.magic-tabs-nav]:!pl-5"
						destroyOnHidden={false}
						items={[
							{
								label:
									joinType === CollaborationJoinMethod.Internal
										? t("workspace.teamSharedWithMe")
										: t("workspace.externalSharedWithMe"),
								key: CollaborationProjectType.Received,
								children: (
									<ProjectList
										{...sharedListProps}
										tabType={CollaborationProjectType.Received}
										projects={receivedProjects}
										loading={loadingReceived}
										refetchProjects={refetchReceived}
									/>
								),
							},
							{
								label: t("workspace.sharedByMe"),
								key: CollaborationProjectType.Shared,
								children: (
									<ProjectList
										{...sharedListProps}
										tabType={CollaborationProjectType.Shared}
										projects={sharedProjects}
										loading={loadingShared}
										refetchProjects={refetchShared}
									/>
								),
							},
						]}
					/>
					{CollaboratorUpdatePanel}
					{AddCollaborationToWorkspaceModal}
				</DialogContent>
			)}
		</Dialog>
	)
}

export default memo(CollaborationProjectsPanel)
