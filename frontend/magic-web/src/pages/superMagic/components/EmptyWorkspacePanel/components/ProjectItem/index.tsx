import IconWorkspaceProjectFolder from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import { cn } from "@/utils/cn"
import dayjs from "@/infrastructure/vendors/dayjs"
import { useHover, useMemoizedFn } from "ahooks"
import { useMemo, useRef } from "react"
import useProjectRename from "@/pages/superMagic/hooks/useProjectRename"
import { Input } from "antd"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useTranslation } from "react-i18next"
import {
	ProjectListItem,
	CollaborationProjectListItem,
	CollaborationProjectType,
} from "@/pages/superMagic/pages/Workspace/types"
import { IconDots, IconLink } from "@tabler/icons-react"
import { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import SuperMagicService from "@/pages/superMagic/services"
import CollaborationProjectTag from "../../../CollaborationProjectTag"
import {
	isCollaborationProject,
	isSelfCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import FlexBox from "@/components/base/FlexBox"
import { observer } from "mobx-react-lite"
import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import ProjectCollaborators from "./components/ProjectCollaborators"
import ProjectMetadata from "./components/ProjectMetadata"
import PinnedTag from "./components/PinnedTag"
import { isOwner } from "@/pages/superMagic/utils/permission"
import magicToast from "@/components/base/MagicToaster/utils"
import ProjectActionsDropdown from "@/pages/superMagic/components/ProjectActionsDropdown"
import ProjectTypeTag from "@/pages/superMagic/components/ProjectTypeTag"
import { ProjectResourceIcon } from "../../../SelectPathModal/components/ProjectResourceSelectorModal/ProjectResourceInfo"
import { getResourceProjectType } from "../../../SelectPathModal/resourceProjectTypes"

interface ProjectItemProps<T extends ProjectListItem | CollaborationProjectListItem> {
	project: T
	index?: number
	viewMode?: ViewMode
	variant?: "default" | "compact"
	titleLayout?: "default" | "recent"
	sortType?: SortType
	inCollaborationPanel?: boolean
	collaborationType?: CollaborationProjectType
	onClick: (project: T) => void
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
	onDeleteProject?: (project: T) => void
	onCancelWorkspaceShortcut?: (projectId: string, workspaceId?: string) => void
	refetchProjects?: () => void
	onMoveProject?: (projectId: string) => void
	onTransferProject?: (project: T) => void
	onPinProject?: (project: T, isPin: boolean) => void
	onAddCollaborators?: (project: T) => void
	onAddWorkspaceShortcut?: (project: T) => void
	onShortcutNavigateToWorkspace?: (project: T) => void
	onMouseEnter?: () => void
	locationName?: string
	selection?: { checked: boolean; onCheck: () => void }
	relativeActiveTime?: boolean
	/** 仅资源浏览面板使用手机信息行，不改变其他项目卡片的布局。 */
	mobileLayout?: boolean
}

// View mode enum
export const enum ViewMode {
	GRID = "grid",
	LIST = "list",
}

export const enum SortType {
	WORKSPACE_ORDER = "workspace",
	PROJECT_UPDATE_TIME = "updated_at",
	MY_LAST_ACTIVE_TIME = "last_active_at",
	PROJECT_CREATE_TIME = "created_at",
}

function ProjectItem<T extends ProjectListItem | CollaborationProjectListItem>({
	project: item,
	index,
	viewMode = ViewMode.GRID,
	variant = "default",
	titleLayout = "default",
	sortType = SortType.PROJECT_UPDATE_TIME,
	inCollaborationPanel = false,
	collaborationType,
	onClick,
	onRenameProject,
	onDeleteProject,
	refetchProjects: _refetchProjects, // eslint-disable-line @typescript-eslint/no-unused-vars
	onMoveProject,
	onTransferProject,
	onPinProject,
	onAddCollaborators,
	onAddWorkspaceShortcut,
	onCancelWorkspaceShortcut,
	onShortcutNavigateToWorkspace,
	onMouseEnter,
	locationName,
	relativeActiveTime = false,
	selection,
	mobileLayout = false,
}: ProjectItemProps<T>) {
	const ref = useRef<HTMLDivElement>(null)
	const isHover = useHover(ref)
	const { t, i18n } = useTranslation("super")

	const isListMode = viewMode === ViewMode.LIST
	const isCompact = variant === "compact"
	const isCompactList = isCompact && isListMode
	const isRecentLayout = isCompact && titleLayout === "recent"
	const hasResourceIcon = isRecentLayout && Boolean(getResourceProjectType(item))

	// Use custom hook for rename functionality
	const {
		isEditing,
		setIsEditing,
		editingProjectName,
		handleProjectNameChange,
		handleProjectNameKeyDown,
		handleProjectNameBlur,
		handleNameClick,
	} = useProjectRename({
		item,
		onRenameProject,
	})

	const handleRenameStart = useMemoizedFn(() => {
		setTimeout(() => {
			setIsEditing(true)
		}, 200)
	})

	const handleCopyCollaborationLink = useMemoizedFn(
		(targetProject: ProjectListItem | CollaborationProjectListItem) => {
			SuperMagicService.project.copyCollaborationLink(targetProject).then((success) => {
				if (success) {
					magicToast.success(t("collaborators.copySuccess"))
				}
			})
		},
	)

	/** 是否是协作项目 */
	const isCollaborationProjectStatus = isCollaborationProject(item)
	/** 是否是自己的协作项目 */
	const isSelfCollaborationProjectStatus = isSelfCollaborationProject(item)

	/** 是否是工作区快捷项目 */
	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(item)
	// 最近项目按活动时间交错排列，标记跟随标题；普通工作区保留左侧置顶标记。
	const projectTags = (
		<>
			<ProjectTypeTag projectMode={item.project_mode} />
			{item.is_pinned && <PinnedTag className="" showText={false} />}
			{!inCollaborationPanel && (
				<CollaborationProjectTag
					visible={isCollaborationProject(item)}
					project={item}
					showText={false}
				/>
			)}
		</>
	)

	const showCollaborators =
		(isCompact || !isListMode) && isCollaborationProjectStatus && inCollaborationPanel
	const copyLinkButton = !selection && isSelfCollaborationProjectStatus && (
		<MagicButton
			className={cn(
				"flex h-7 items-center gap-1 rounded-lg border border-border px-2 py-1.5",
				!isCompactList && "mt-auto",
			)}
			onClick={(event) => {
				event.stopPropagation()
				handleCopyCollaborationLink(item)
			}}
			data-testid="project-item-copy-link-button"
		>
			<MagicIcon component={IconLink} size={14} />
			{t("project.copyLink")}
		</MagicButton>
	)
	const WithCollaborators = showCollaborators ? (
		<ProjectCollaborators<T>
			project={item}
			compact={isCompact}
			list={isCompactList}
			showCreator={
				isCompactList && collaborationType
					? collaborationType === CollaborationProjectType.Received
					: !isOwner(item.user_role)
			}
			selfShared={isSelfCollaborationProjectStatus}
			onAddCollaborators={onAddCollaborators}
			copyLinkButton={isCompactList ? undefined : copyLinkButton}
		/>
	) : null

	const time = useMemo(() => {
		if (mobileLayout) {
			const isActiveTime =
				sortType === SortType.MY_LAST_ACTIVE_TIME ||
				(sortType === SortType.WORKSPACE_ORDER && Boolean(item.last_active_at))
			const rawTime = isActiveTime
				? item.last_active_at
				: sortType === SortType.PROJECT_CREATE_TIME
					? item.created_at
					: item.updated_at
			const date = rawTime ? dayjs(rawTime) : null
			const value = date?.isValid()
				? date
						.locale(i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en")
						.fromNow()
				: undefined
			return {
				value,
				label: !value
					? ""
					: isActiveTime
						? t("common.lastActiveAt", { time: value })
						: sortType === SortType.PROJECT_CREATE_TIME
							? t("common.createdAt", { time: value })
							: t("common.lastUpdatedAt", { time: value }),
			}
		}
		switch (sortType) {
			case SortType.MY_LAST_ACTIVE_TIME: {
				let value = item.last_active_at?.replaceAll("-", "/")
				if (relativeActiveTime) {
					const activeTime = item.last_active_at ? dayjs(item.last_active_at) : null
					const locale = i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en"
					// 最近项目统一显示相对时间；实例语言避免首行沿用其它组件的全局语言。
					value = activeTime?.isValid() ? activeTime.locale(locale).fromNow() : undefined
				}
				return {
					value: value || t("common.noActiveTime"),
					label: value
						? t("common.lastActiveAt", { time: value })
						: t("common.noActiveTime"),
				}
			}
			case SortType.PROJECT_CREATE_TIME: {
				const value = item.created_at.replaceAll("-", "/")
				return { value, label: t("common.createdAt", { time: value }) }
			}
			case SortType.PROJECT_UPDATE_TIME: {
				const value = item.updated_at.replaceAll("-", "/")
				return { value, label: t("common.lastUpdatedAt", { time: value }) }
			}
			default: {
				// 保留原更新时间的回退顺序；列表仅去掉已有列标题重复表达的前缀。
				const value = (item.last_active_at || item.updated_at).replaceAll("-", "/")
				return { value, label: t("common.lastUpdatedAt", { time: value }) }
			}
		}
	}, [
		item.updated_at,
		item.created_at,
		item.last_active_at,
		sortType,
		relativeActiveTime,
		mobileLayout,
		i18n.language,
		t,
	])

	const renderProject = ({
		open,
		triggerContextMenu,
	}: {
		open: boolean
		triggerContextMenu?: React.MouseEventHandler<HTMLButtonElement>
	}) => (
		<div
			ref={ref}
			className={cn(
				"relative flex w-full min-w-0 cursor-pointer flex-col gap-2.5 rounded-lg border border-border bg-card p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				!isCompact && "h-[183px]",
				!isCompact && !!WithCollaborators && "h-[222px] w-full",
				!isCompact &&
					isListMode &&
					"h-14 w-full flex-row items-center justify-start [&_.project-item-actions]:right-2 [&_.project-item-actions]:top-2 [&_.project-item-actions]:border-none [&_.project-item-actions]:bg-muted [&_.project-item-actions]:text-foreground [&_.project-item-content]:max-w-[calc(100%-50px)] [&_.project-item-content]:flex-1 [&_.project-item-icon]:h-10 [&_.project-item-icon]:w-10 [&_.project-item-icon]:flex-none [&_.project-item-title]:pr-5 [&_.project-item-updated-at]:overflow-hidden [&_.project-item-updated-at]:text-ellipsis [&_.project-item-updated-at]:whitespace-nowrap",
				isCompact &&
					"grid grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-accent/50",
				isCompact && !isListMode && "min-h-[88px]",
				isCompactList &&
					"min-h-12 grid-cols-[16px_minmax(0,1fr)_auto] rounded-none border-0 border-b bg-transparent [@container_(min-width:800px)]:[grid-template-columns:var(--project-list-columns)] [@container_project-list_(min-width:520px)]:[grid-template-columns:var(--project-list-columns)]",
				isRecentLayout && "grid-cols-[32px_minmax(0,1fr)_auto] items-start",
				mobileLayout && "min-h-14 grid-cols-[32px_minmax(0,1fr)_auto] gap-x-2 py-3",
			)}
			onClick={() => onClick(item)}
			role={selection ? "button" : undefined}
			tabIndex={selection ? 0 : undefined}
			onKeyDown={
				selection
					? (event) => {
							if (event.target !== event.currentTarget) return
							if (event.key === "Enter") onClick(item)
							if (event.key === " ") {
								event.preventDefault()
								selection.onCheck()
							}
						}
					: undefined
			}
			onMouseEnter={onMouseEnter}
			data-testid="project-item"
			data-index={index}
			data-view-mode={viewMode}
			data-variant={variant}
			data-pinned={item.is_pinned}
			data-collaboration={isCollaborationProjectStatus}
			data-workspace-shortcut={isWorkspaceShortcutProjectStatus}
			data-project-name={item.project_name || t("project.unnamedProject")}
		>
			<div
				className={cn(
					"project-item-icon relative flex flex-1 items-center justify-center rounded px-2 py-2",
					isCompact && "col-start-1 row-start-1 size-4 flex-none p-0",
					isRecentLayout && "size-8 self-start",
					mobileLayout && "size-8",
				)}
				data-testid="project-item-icon"
			>
				{selection ? (
					<Checkbox
						checked={selection.checked}
						aria-label={t("selectPathModal.selectProject", { name: item.project_name })}
						onClick={(event) => event.stopPropagation()}
						onCheckedChange={selection.onCheck}
					/>
				) : hasResourceIcon ? (
					<ProjectResourceIcon project={item} />
				) : (
					<IconWorkspaceProjectFolder
						isHovered={isHover}
						wasHovered={!isHover}
						size={
							mobileLayout || isRecentLayout
								? 32
								: isCompact
									? 16
									: isListMode
										? 30
										: 60
						}
					/>
				)}
			</div>
			<div
				className={cn(
					"project-item-content flex max-w-full flex-col gap-1",
					isCompact && "col-start-2 row-start-1 min-w-0 gap-0.5",
					isCompactList && "contents",
				)}
				data-testid="project-item-content"
			>
				<div
					className={cn(
						"contents",
						isRecentLayout && "col-start-2 row-start-1 flex min-w-0 flex-col gap-0.5",
					)}
				>
					{/* 编辑时，只允许编辑非工作区快捷项目 */}
					{isEditing && !isWorkspaceShortcutProjectStatus && onRenameProject ? (
						<Input
							autoFocus
							className={cn("h-5", isCompactList && "col-start-2 row-start-1")}
							onClick={(e) => e.stopPropagation()}
							value={editingProjectName}
							onChange={handleProjectNameChange}
							onKeyDown={handleProjectNameKeyDown}
							onBlur={handleProjectNameBlur}
							data-testid="project-item-rename-input"
						/>
					) : (
						<FlexBox
							align="center"
							gap={isRecentLayout ? 6 : 4}
							className={cn(
								"min-w-0",
								isRecentLayout && "min-h-5",
								isCompactList && "col-start-2 row-start-1",
							)}
							data-testid="project-item-title-wrapper"
						>
							{selection && (
								<IconWorkspaceProjectFolder size={16} isHovered={isHover} />
							)}
							{!isRecentLayout && projectTags}
							<SmartTooltip
								className={cn(
									"project-item-title min-w-0 flex-1 rounded text-sm font-semibold leading-5 text-foreground",
									!onRenameProject && "hover:bg-transparent",
									isListMode && "cursor-pointer",
									!isListMode && "cursor-text",
									isCompact && "cursor-pointer text-[13px] font-medium",
									isRecentLayout && "flex-initial",
									mobileLayout && "text-sm",
								)}
								onClick={isListMode || isCompact ? undefined : handleNameClick}
								data-testid="project-item-title"
								maxLines={mobileLayout || (isCompact && !isListMode) ? 2 : 1}
								data-editable={!isListMode && !isCompact && !!onRenameProject}
							>
								{item.project_name || t("project.unnamedProject")}
								{locationName && !isRecentLayout && (
									<span className="block truncate text-xs font-normal text-muted-foreground">
										{locationName}
									</span>
								)}
							</SmartTooltip>
							{isRecentLayout && projectTags}
						</FlexBox>
					)}
					{isRecentLayout && isCompactList && !mobileLayout && locationName && (
						<SmartTooltip
							className="min-w-0 text-xs font-normal leading-4 text-muted-foreground"
							data-testid="project-item-location"
						>
							{locationName}
						</SmartTooltip>
					)}
				</div>
				{isCompact && (!isCompactList || mobileLayout) ? (
					<ProjectMetadata
						mobile={mobileLayout}
						list={isCompactList}
						recent={isRecentLayout}
						locationName={locationName}
						time={{ value: time.value ?? "", label: time.label }}
						timeLabel={
							sortType === SortType.MY_LAST_ACTIVE_TIME ||
							(sortType === SortType.WORKSPACE_ORDER && Boolean(item.last_active_at))
								? t("sidebarPanels.lastActiveTime")
								: sortType === SortType.PROJECT_CREATE_TIME
									? t("sidebarPanels.createdTime")
									: t("sidebarPanels.updatedTime")
						}
						createdAt={item.created_at}
						relativeActiveTime={relativeActiveTime}
					/>
				) : (
					(!mobileLayout || time.value) && (
						<SmartTooltip
							className={cn(
								"project-item-updated-at text-[10px] font-normal leading-[13px] text-muted-foreground",
								isCompact && "text-xs leading-4",
								isCompactList &&
									"col-start-2 row-start-2 [@container_(min-width:800px)]:col-start-[time] [@container_(min-width:800px)]:row-start-1 [@container_project-list_(min-width:520px)]:col-start-[time] [@container_project-list_(min-width:520px)]:row-start-1",
								isRecentLayout && isCompactList && "leading-5",
								mobileLayout && "whitespace-normal",
							)}
							data-testid="project-item-time"
							data-sort-type={sortType}
							maxLines={isCompactList ? 0 : 1}
						>
							{/* 有表头时仅显示值；窄行与不支持容器查询的浏览器保留时间含义。 */}
							{isCompactList && !mobileLayout ? (
								<>
									<span className="[@container_(min-width:800px)]:hidden [@container_project-list_(min-width:520px)]:hidden">
										{time.label}
									</span>
									<span className="hidden [@container_(min-width:800px)]:inline [@container_project-list_(min-width:520px)]:inline">
										{time.value}
									</span>
								</>
							) : (
								time.label
							)}
						</SmartTooltip>
					)
				)}
			</div>

			<div
				className={cn(
					isCompactList
						? "col-start-3 row-span-2 row-start-1 flex items-center justify-end gap-2 [@container_(min-width:800px)]:col-start-[actions] [@container_(min-width:800px)]:row-span-1 [@container_project-list_(min-width:520px)]:col-start-[actions] [@container_project-list_(min-width:520px)]:row-span-1"
						: "contents",
					isRecentLayout && "self-start",
				)}
			>
				{isCompactList && showCollaborators && copyLinkButton}
				{!selection && (
					<button
						type="button"
						aria-label={t("common.moreActions")}
						className={cn(
							"project-item-actions absolute right-5 top-5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-border bg-black/50 text-white",
							isListMode && "right-2 top-2 border-none bg-muted text-foreground",
							isCompact &&
								"static col-start-3 row-start-1 rounded-md border-none bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
							isRecentLayout && "h-5 self-start",
						)}
						style={{
							opacity: (isCompact || isHover || open) && !isEditing ? 1 : 0,
							visibility:
								(isCompact || isHover || open) && !isEditing ? "visible" : "hidden",
						}}
						onClick={triggerContextMenu}
						data-testid="project-item-more-button"
						data-visible={isHover || open}
					>
						<IconDots size={16} />
					</button>
				)}
			</div>
			{WithCollaborators}
		</div>
	)
	if (selection) return renderProject({ open: false })
	return (
		<div className={mobileLayout ? "w-full min-w-0 [&>span]:flex [&>span]:w-full" : "contents"}>
			{/* 手机菜单的触发容器是 inline-flex；仅本面板将它铺满行宽，避免项目信息缩成半行。 */}
			<ProjectActionsDropdown
				item={item}
				inCollaborationPanel={inCollaborationPanel}
				contextMenuTargetRef={ref}
				onOpenInNewWindow={openProjectInNewTab}
				onCopyCollaborationLink={handleCopyCollaborationLink}
				onRenameStart={handleRenameStart}
				onRenameProject={onRenameProject}
				onDeleteProject={onDeleteProject}
				onMoveProject={onMoveProject}
				onTransferProject={onTransferProject}
				onPinProject={onPinProject}
				onAddCollaborators={onAddCollaborators}
				onAddWorkspaceShortcut={onAddWorkspaceShortcut}
				onCancelWorkspaceShortcut={onCancelWorkspaceShortcut}
				onShortcutNavigateToWorkspace={onShortcutNavigateToWorkspace}
			>
				{renderProject}
			</ProjectActionsDropdown>
		</div>
	)
}

export default observer(ProjectItem)
