import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { useDebounce } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ArrowLeft, FolderSearch } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ProjectsPanelToolbar } from "../../../WorkspacesMenu/components/ProjectsPanelToolbar"
import { useUserInfo } from "@/models/user/hooks"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import type { FileManagerLocationSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import { isMicroAppEnabled } from "@/services/microAppFeature"
import { ProjectsPanel, ProjectsPanelList } from "../../../WorkspacesMenu/components/ProjectsPanel"
import { useProjectManagerWindow } from "../../../WorkspacesMenu/useProjectManagerWindow"
import { ViewToggle } from "../../../WorkspacesMenu/components/CollaborationProjectsPanel/components"
import { useViewTogglePersistValue } from "../../../WorkspacesMenu/components/CollaborationProjectsPanel/components/ViewToggle/hooks"
import ProjectItem, {
	SortType,
	ViewMode,
} from "../../../EmptyWorkspacePanel/components/ProjectItem"
import { FileManager } from "../../../TopicFilesButton/components/FileManager/FileManager"
import type {
	FileManagerCheckChange,
	FileManagerRevealRequest,
} from "../../../TopicFilesButton/components/FileManager/types"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks"
import {
	getFilePresentationIndex,
	resolveFilePresentation,
} from "../../../TopicFilesButton/utils/file-presentation"
import { resolveAttachmentId } from "../../../TopicFilesButton/utils/attachmentIndex"
import type { FileHelpContext } from "../../../TopicFilesButton/utils/magic-system-folder"
import type { ProjectListItem, Workspace } from "../../../../pages/Workspace/types"
import {
	MY_AGENTS_WORKSPACE_DATA,
	MY_AGENTS_WORKSPACE_ID,
	MY_CLAW_WORKSPACE_DATA,
	MY_CLAW_WORKSPACE_ID,
	SHARE_WORKSPACE_ID,
	MICRO_APPS_WORKSPACE_DATA,
	MY_SKILLS_WORKSPACE_DATA,
	SHARE_WORKSPACE_DATA,
} from "../../../../constants"
import type { ProjectResourceSelection } from "../../types"
import { MentionSelectionPanel, type MentionSelectionItem } from "./MentionSelectionPanel"
import { MentionSourceSidebar } from "./MentionSourceSidebar"
import { ProjectBrowserLayout } from "../../../WorkspacesMenu/components/ProjectBrowserLayout"
import { useSelectionListViewport } from "./useSelectionListViewport"
import { ProjectResourceItem } from "./ProjectResourceItem"
import { getResourceProjectType, type ResourceProject } from "../../resourceProjectTypes"
import recentProjectsStore from "@/pages/superMagic/stores/core/recentProjects"
import { useRecentProjectSearch } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useRecentProjectSearch"
import { TopicMode } from "../../../../pages/Workspace/TopicMode"
import { WorkspaceStatus } from "../../../../pages/Workspace/types"
import { isOwner } from "../../../../utils/permission"
import { isResourceWorkspace } from "../../utils/resourceProjects"
import { getItemName, hasEditPermission } from "../../utils/attachmentUtils"
import SmartTooltip from "@/components/other/SmartTooltip"

export interface DestinationPickerOptions {
	path: AttachmentItem[]
	canSubmit: boolean
	disabledFolderIds: ReadonlySet<string>
	onDirectoryChange: (directoryId: string) => void
	createWorkspaceAction?: ReactNode
	createAction?: ReactNode
	footerOptions?: ReactNode
	creationDialog?: ReactNode
}

interface Props {
	title: string
	workspaces: Workspace[]
	workspace: Workspace | null
	project: ProjectListItem | null
	projects: ProjectListItem[]
	resourceFilter?: ReactNode
	attachments: AttachmentItem[]
	loading: boolean
	error: boolean
	submitting: boolean
	selectionMode?: "mention" | "import"
	allowProjectSelection?: boolean
	destination?: DestinationPickerOptions
	includeFixedWorkspaces: boolean
	excludeProjectIds: string[]
	selections: ProjectResourceSelection[]
	hasMore: boolean
	loadingMore: boolean
	onProjectSearch: (keyword: string) => void
	onLoadMore: () => void
	onWorkspace: (workspace: Workspace) => void
	onProject: (project: ProjectListItem, action: "select" | "enter", workspace?: Workspace) => void
	onRecent: () => void
	onBack: () => void
	onRefresh: () => void
	onCheck: (change: FileManagerCheckChange) => void
	onRemove: (selection: ProjectResourceSelection) => void
	onClear: () => void
	onNavigate: (selection: ProjectResourceSelection) => void
	onSubmit: () => void
	onClose: () => void
}

function selectionKey(selection: ProjectResourceSelection) {
	return selection.level === "project"
		? `project:${selection.project.id}`
		: `attachment:${selection.project.id}:${resolveAttachmentId(selection.attachment)}`
}

/** 只组合现有管理器的选择模式；项目、附件请求和全局勾选仍由 selector 持有。 */
export const MentionDesktopPicker = observer(function MentionDesktopPicker(props: Props) {
	const { t } = useTranslation("super")
	const destination = props.destination
	const isDestination = Boolean(destination)
	const allowProjectSelection = props.allowProjectSelection ?? props.selectionMode === "mention"
	const { userInfo } = useUserInfo()
	const layer = useOverlayZIndex({ open: true, zIndexScope: "fullscreen" })
	const identity = `${userInfo?.organization_code ?? ""}/${userInfo?.user_id ?? ""}`
	const frame = useProjectManagerWindow(true, {
		// 单一目标没有右侧已选清单；尺寸与视图偏好分开保存，避免沿用多选窗口的宽度。
		preferenceKey: isDestination ? "file_destination_picker" : "file_picker",
		recommendedSize: isDestination ? { width: 960, height: 680 } : { width: 1160, height: 740 },
		minSize: { width: isDestination ? 720 : 960, height: 560 },
	})
	const [query, setQuery] = useState("")
	const { workspace: searchWorkspace, project: searchProject, onProjectSearch } = props
	const debouncedQuery = useDebounce(query, { wait: 500 })
	useEffect(() => {
		if (query === debouncedQuery && searchWorkspace && !searchProject)
			onProjectSearch(debouncedQuery)
	}, [query, debouncedQuery, searchWorkspace, searchProject, onProjectSearch])
	const [recentMode, setRecentMode] = useState(!destination || !props.workspace)
	const workspaceId = props.workspace?.id
	useEffect(() => {
		if (isDestination && workspaceId) setRecentMode(false)
	}, [isDestination, workspaceId])
	const [reveal, setReveal] = useState<FileManagerRevealRequest>()
	const [rootVisit, setRootVisit] = useState(0)
	const revealId = useRef(0)
	const locations = useRef(new Map<string, FileManagerLocationSnapshot>())
	const defaultViewMode = isDestination ? ViewMode.GRID : ViewMode.LIST
	const { viewMode = defaultViewMode, setViewMode } = useViewTogglePersistValue({
		localStorageKey: isDestination
			? "file_destination_projects_view"
			: "file_picker_projects_view",
		defaultValue: defaultViewMode,
	})
	useEffect(() => {
		if (!userInfo?.user_id || !userInfo.organization_code) return
		recentProjectsStore.setIdentity(userInfo.user_id, userInfo.organization_code)
		recentProjectsStore.invalidate()
		void recentProjectsStore.loadMore()
	}, [userInfo?.user_id, userInfo?.organization_code])
	const recentSearch = useRecentProjectSearch(query, recentMode && !props.project, props.loading)
	// 最近入口与工作区列表遵循同一目标权限，不能借新入口扩大复制可写范围。
	const canUseProject = (project: ProjectListItem) =>
		!props.excludeProjectIds.includes(project.id) &&
		(!destination ||
			(hasEditPermission(project.user_role) &&
				project.project_mode !== TopicMode.MicroApp &&
				(props.includeFixedWorkspaces ||
					(project.project_mode !== TopicMode.MagiClaw &&
						project.workspace_id !== SHARE_WORKSPACE_ID))))
	const projects = props.projects.filter(canUseProject)
	const viewport = useSelectionListViewport(
		'[data-testid="shared-workspace-dialog-project-item"]',
		projects.length,
		`${viewMode}:${props.project?.id ?? ""}`,
	)
	const recentProjects = (
		query.trim() && userInfo?.user_id && userInfo.organization_code
			? recentSearch.items
			: recentProjectsStore.items.filter((project) =>
					(project.project_name || t("project.unnamedProject"))
						.toLocaleLowerCase()
						.includes(query.trim().toLocaleLowerCase()),
				)
	).filter(canUseProject)
	const recentViewport = useSelectionListViewport(
		'[data-testid="shared-workspace-dialog-project-item"]',
		recentProjects.length,
		`recent:${viewMode}`,
	)
	const recentWorkspaceForProject = (project: ProjectListItem): Workspace => {
		if (project.project_mode === TopicMode.MagiClaw) return MY_CLAW_WORKSPACE_DATA(t)
		if (
			project.project_mode === TopicMode.AgentCreator ||
			project.project_mode === TopicMode.CustomAgent
		)
			return MY_AGENTS_WORKSPACE_DATA(t)
		if (
			project.project_mode === TopicMode.SkillProjectCreator ||
			project.project_mode === TopicMode.CustomSkill
		)
			return MY_SKILLS_WORKSPACE_DATA(t)
		if (project.project_mode === TopicMode.MicroApp) return MICRO_APPS_WORKSPACE_DATA(t)
		return (
			props.workspaces.find((workspace) => workspace.id === project.workspace_id) ?? {
				id: project.workspace_id,
				name: project.workspace_name || t("workspace.unnamedWorkspace"),
				workspace_type: "default",
				is_archived: 0,
				workspace_status: WorkspaceStatus.WAITING,
				project_count: 0,
				current_project_id: project.id,
				current_topic_id: project.current_topic_id ?? "",
			}
		)
	}
	const special = [
		...(props.includeFixedWorkspaces
			? [SHARE_WORKSPACE_DATA(t), MY_CLAW_WORKSPACE_DATA(t)]
			: []),
		MY_SKILLS_WORKSPACE_DATA(t),
		MY_AGENTS_WORKSPACE_DATA(t),
		...(!destination && isMicroAppEnabled() ? [MICRO_APPS_WORKSPACE_DATA(t)] : []),
	]
	const specialIds = new Set(special.map((workspace) => workspace.id))
	const regular = props.workspaces.filter(
		(workspace) => !specialIds.has(workspace.id) && workspace.workspace_type !== "micro-app",
	)
	const contextFor = (
		selection: Pick<ProjectResourceSelection, "workspace" | "project">,
	): FileHelpContext => ({
		kind:
			selection.workspace.id === MY_CLAW_WORKSPACE_ID
				? "claw"
				: selection.workspace.id === MY_AGENTS_WORKSPACE_ID
					? "crew"
					: "project",
		projectId: selection.project.id,
	})
	const context: FileHelpContext = useMemo(
		() => ({
			kind:
				props.workspace?.id === MY_CLAW_WORKSPACE_ID
					? "claw"
					: props.workspace?.id === MY_AGENTS_WORKSPACE_ID
						? "crew"
						: "project",
			projectId: props.project?.id ?? "",
		}),
		[props.workspace?.id, props.project?.id],
	)
	const selectedItems: MentionSelectionItem[] = props.selections.map((selection) => {
		const common = {
			key: selectionKey(selection),
			sourceName: `${selection.workspace.name} / ${selection.project.project_name || t("project.unnamedProject")}`,
		}
		return selection.level === "project"
			? {
					...common,
					projectName: selection.project.project_name || t("project.unnamedProject"),
				}
			: {
					...common,
					presentation: resolveFilePresentation(selection.attachment, {
						context: contextFor(selection),
						...(selection.project.id === props.project?.id
							? { index: getFilePresentationIndex(props.attachments) }
							: {}),
					}),
				}
	})
	const selectedProjects = new Set(
		props.selections
			.filter((selection) => selection.level === "project")
			.map((selection) => selection.project.id),
	)
	const checkedIds = new Set(
		props.selections.flatMap((selection) =>
			selection.level === "attachment" && selection.project.id === props.project?.id
				? [resolveAttachmentId(selection.attachment) ?? ""]
				: [],
		),
	)
	const renderProjectItem = (itemProps: ComponentProps<typeof ProjectItem>) => {
		const { project } = itemProps
		const resourceProject = project as ResourceProject
		const resourceType = resourceProject.resourceType ?? getResourceProjectType(project)
		const displayProject: ResourceProject = resourceType
			? {
					...resourceProject,
					resourceType,
					// 最近列表返回的 id 已是文件项目 ID；模块列表仍以 project_id 判断是否关联源码。
					project_id: recentMode ? project.id : resourceProject.project_id,
					resourceId:
						resourceProject.resourceId ??
						resourceProject.micro_app_id ??
						resourceProject.claw_code,
				}
			: resourceProject
		const workspaceOverride = recentMode ? recentWorkspaceForProject(project) : undefined
		const selection = allowProjectSelection
			? {
					checked: selectedProjects.has(project.id),
					onCheck: () => props.onProject(displayProject, "select", workspaceOverride),
				}
			: undefined
		const onClick = () => {
			setRecentMode(false)
			props.onProject(displayProject, "enter", workspaceOverride)
		}
		if (resourceType && !recentMode) {
			return (
				<ProjectResourceItem
					{...itemProps}
					project={displayProject}
					onClick={onClick}
					selection={selection}
				/>
			)
		}
		return (
			<div className="flex min-w-0 items-center gap-2">
				{selection && (
					<Checkbox
						checked={selection.checked}
						aria-label={t("selectPathModal.selectProject", {
							name: project.project_name,
						})}
						onCheckedChange={selection.onCheck}
					/>
				)}
				<div className="min-w-0 flex-1">
					<ProjectItem
						{...itemProps}
						locationName={
							recentMode
								? isOwner(project.user_role)
									? workspaceOverride?.name
									: t("workspace.shareWorkspaceName")
								: undefined
						}
						relativeActiveTime={recentMode}
						onClick={onClick}
					/>
				</div>
			</div>
		)
	}
	const navigate = (key: string, target: "project" | "file") => {
		const selection = props.selections.find((item) => selectionKey(item) === key)
		if (!selection) return
		setQuery("")
		if (target === "file" && selection.level === "attachment") {
			setReveal({
				fileId: resolveAttachmentId(selection.attachment) ?? "",
				requestId: ++revealId.current,
			})
		} else {
			locations.current.delete(selection.project.id)
			setReveal(undefined)
			setRootVisit((value) => value + 1)
		}
		setRecentMode(false)
		props.onNavigate(selection)
	}
	const panel = (
		<MentionSelectionPanel
			items={selectedItems}
			onRemove={(key) => {
				const selection = props.selections.find((item) => selectionKey(item) === key)
				if (selection) props.onRemove(selection)
			}}
			onClear={props.onClear}
			onNavigate={navigate}
		/>
	)
	return (
		<ProjectsPanel
			open
			modal
			zIndex={layer.contentZIndex}
			title={props.title}
			titleIcon={<FolderSearch size={16} />}
			windowOptions={frame.windowOptions}
			onRestoreRecommendedSize={frame.restoreRecommendedSize}
			resizeGuide={{ visible: frame.resizeGuideVisible, onDismiss: frame.dismissResizeGuide }}
			onClose={props.onClose}
		>
			<div className="flex min-h-0 flex-1 flex-col [container-type:inline-size]">
				<ProjectBrowserLayout
					minContentWidth={isDestination ? 320 : 520}
					sidebar={
						<MentionSourceSidebar
							workspaces={regular}
							specialWorkspaces={special}
							current={props.workspace}
							footer={destination?.createWorkspaceAction}
							recentActive={recentMode && !props.project}
							onSelectRecent={() => {
								setRecentMode(true)
								setQuery("")
								setReveal(undefined)
								props.onRecent()
							}}
							onSelect={(workspace) => {
								setRecentMode(false)
								setQuery("")
								setReveal(undefined)
								props.onWorkspace(workspace)
							}}
						/>
					}
				>
					<div className="flex min-h-0 min-w-0 flex-1">
						<div className="flex min-h-0 min-w-0 flex-1 flex-col">
							{props.project && props.workspace ? (
								<>
									<div className="min-h-0 flex-1">
										<FileManager
											key={`${identity}:${props.project.id}:${rootVisit}`}
											{...(destination
												? {
														mode: "destination" as const,
														disabledFolderIds:
															destination.disabledFolderIds,
														onDirectoryChange:
															destination.onDirectoryChange,
														initialDirectoryId: destination.path.length
															? (resolveAttachmentId(
																	destination.path[
																		destination.path.length - 1
																	],
																) ?? "")
															: "",
													}
												: {
														mode: "select" as const,
														checkedIds,
														onCheckChange: props.onCheck,
													})}
											rootId=""
											rootName={
												props.project.project_name ||
												t("project.unnamedProject")
											}
											scopeKey={`file_picker:${identity}:${props.project.id}`}
											identityKey={identity}
											projectId={props.project.id}
											selectedProject={props.project}
											context={context}
											attachments={props.attachments}
											isActive
											dataReady={!props.loading && !props.error}
											loading={props.loading}
											error={props.error}
											onRefresh={props.onRefresh}
											onOpen={() => undefined}
											initialState={
												destination
													? undefined
													: locations.current.get(props.project.id)
											}
											onStateChange={(snapshot) => {
												if (props.project)
													locations.current.set(
														props.project.id,
														snapshot,
													)
											}}
											revealRequest={reveal}
											toolbarLeading={
												<div className="flex shrink-0 items-center gap-1">
													<Button
														variant="ghost"
														size="sm"
														className="h-7 shrink-0 gap-1 px-1.5 text-xs font-normal"
														onClick={() => {
															setReveal(undefined)
															setRecentMode(false)
															props.onBack()
														}}
													>
														<ArrowLeft size={16} />
														{props.workspace.name}
													</Button>
													{destination?.createAction}
												</div>
											}
										/>
									</div>
								</>
							) : recentMode ? (
								<>
									<ProjectsPanelToolbar
										location={t("projectNavigation.recent")}
										searchValue={query}
										onSearchValueChange={(event) =>
											setQuery(event.target.value)
										}
										viewToggle={
											<ViewToggle value={viewMode} onChange={setViewMode} />
										}
									>
										{destination?.createAction}
									</ProjectsPanelToolbar>
									<ProjectsPanelList
										projects={recentProjects}
										loading={
											query.trim()
												? recentSearch.loading
												: recentProjectsStore.loading
										}
										viewMode={viewMode}
										renderItem={renderProjectItem}
										itemProps={{
											titleLayout: "recent",
											sortType: SortType.MY_LAST_ACTIVE_TIME,
											onClick: (project) => {
												setRecentMode(false)
												props.onProject(
													project,
													"enter",
													recentWorkspaceForProject(project),
												)
											},
										}}
										listViewport={recentViewport}
										error={
											(
												query.trim()
													? recentSearch.error
													: recentProjectsStore.error
											) ? (
												<Button
													variant="ghost"
													onClick={() =>
														void (query.trim()
															? recentSearch.loadMore()
															: recentProjectsStore.loadMore())
													}
												>
													{t("common.retry")}
												</Button>
											) : undefined
										}
										footer={
											(
												query.trim()
													? recentSearch.hasMore
													: recentProjectsStore.hasMore
											) ? (
												<Button
													variant="ghost"
													disabled={
														query.trim()
															? recentSearch.loading
															: recentProjectsStore.loading
													}
													onClick={() =>
														void (query.trim()
															? recentSearch.loadMore()
															: recentProjectsStore.loadMore())
													}
												>
													{t("selectPathModal.loadMore")}
												</Button>
											) : undefined
										}
									/>
								</>
							) : (
								<>
									<ProjectsPanelToolbar
										location={
											props.workspace?.name || t("selectPathModal.workspace")
										}
										searchValue={query}
										onSearchValueChange={(event) =>
											setQuery(event.target.value)
										}
										viewToggle={
											<ViewToggle value={viewMode} onChange={setViewMode} />
										}
									>
										{destination?.createAction}
									</ProjectsPanelToolbar>
									{props.resourceFilter}
									<ProjectsPanelList
										projects={projects}
										listLayout={
											props.workspace && isResourceWorkspace(props.workspace)
												? "resource"
												: "project"
										}
										loading={props.loading}
										viewMode={viewMode}
										renderItem={renderProjectItem}
										itemProps={{
											onClick: (project) => {
												setReveal(undefined)
												props.onProject(project, "enter")
											},
										}}
										listViewport={viewport}
										error={
											props.error ? (
												<Button variant="ghost" onClick={props.onRefresh}>
													{t("common.retry")}
												</Button>
											) : undefined
										}
										footer={
											props.hasMore ? (
												<Button
													variant="ghost"
													disabled={props.loadingMore}
													onClick={props.onLoadMore}
												>
													{t("selectPathModal.loadMore")}
												</Button>
											) : undefined
										}
									/>
								</>
							)}
						</div>
						{!destination && <div className="flex min-h-0 w-60 shrink-0">{panel}</div>}
					</div>
				</ProjectBrowserLayout>
				{destination?.footerOptions}
				<div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t px-4">
					{destination ? (
						<SmartTooltip className="min-w-0 flex-1 text-xs text-muted-foreground">
							{props.workspace
								? [
										props.workspace.name,
										props.project?.project_name,
										...(props.project
											? destination.path.length
												? destination.path.map(getItemName)
												: [t("selectPathModal.rootDirectory")]
											: []),
									]
										.filter(Boolean)
										.join(" / ")
								: t("selectPathModal.selectStorageLocation")}
						</SmartTooltip>
					) : (
						<span className="text-xs text-muted-foreground">
							{t("fileManager.selectedCount", { count: props.selections.length })}
						</span>
					)}
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={props.onClose}>
							{t("common.cancel")}
						</Button>
						<Button
							disabled={
								(destination ? !destination.canSubmit : !props.selections.length) ||
								props.submitting
							}
							onClick={props.onSubmit}
						>
							{t("selectPathModal.confirm")}
							{!destination && ` (${props.selections.length})`}
						</Button>
					</div>
				</div>
			</div>
			{destination?.creationDialog}
		</ProjectsPanel>
	)
})
