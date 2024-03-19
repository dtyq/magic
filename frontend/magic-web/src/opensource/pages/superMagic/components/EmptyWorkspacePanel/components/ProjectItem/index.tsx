import IconWorkspaceProjectFolder from "@/opensource/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import { cn } from "@/opensource/lib/utils"
import { useHover, useMemoizedFn } from "ahooks"
import { useMemo, useRef, lazy } from "react"
import useProjectRename from "@/opensource/pages/superMagic/hooks/useProjectRename"
import { Input } from "antd"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import { useTranslation } from "react-i18next"
import {
	ProjectListItem,
	CollaborationProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { IconDots, IconLink } from "@tabler/icons-react"
import { HandleRenameProjectParams } from "@/opensource/pages/superMagic/hooks/useProjects"
import { openProjectInNewTab } from "@/opensource/pages/superMagic/utils/project"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import type {
	Collaborator,
	CollaborationProjectListItem as ShareItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import CollaborationProjectTag from "../../../CollaborationProjectTag"
import {
	isCollaborationProject,
	isSelfCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/opensource/pages/superMagic/constants"
import FlexBox from "@/opensource/components/base/FlexBox"
import { observer } from "mobx-react-lite"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import AddCollaborators from "./components/AddCollaborators"
import PinnedTag from "./components/PinnedTag"
import { isOwner } from "@/opensource/pages/superMagic/utils/permission"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import ProjectActionsDropdown from "@/opensource/pages/superMagic/components/ProjectActionsDropdown"

interface ProjectItemProps<T extends ProjectListItem | CollaborationProjectListItem> {
	project: T
	index?: number
	viewMode?: ViewMode
	sortType?: SortType
	inCollaborationPanel?: boolean
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
}

// View mode enum
export const enum ViewMode {
	GRID = "grid",
	LIST = "list",
}

export const enum SortType {
	PROJECT_UPDATE_TIME = "updated_at",
	MY_LAST_ACTIVE_TIME = "last_active_at",
	PROJECT_CREATE_TIME = "created_at",
}

function ProjectItem<T extends ProjectListItem | CollaborationProjectListItem>({
	project: item,
	index,
	viewMode = ViewMode.GRID,
	sortType = SortType.PROJECT_UPDATE_TIME,
	inCollaborationPanel = false,
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
}: ProjectItemProps<T>) {
	const ref = useRef<HTMLDivElement>(null)
	const isHover = useHover(ref)
	const { t } = useTranslation("super")

	const isListMode = viewMode === ViewMode.LIST

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

	const WithCollaborators = useMemo(() => {
		if (isListMode || !isCollaborationProjectStatus || !inCollaborationPanel) return null

		const shareItem = item as ShareItem
		const creatorName = shareItem.creator?.nickname
		const creatorAvatar = shareItem.creator?.avatar_url || undefined
		const members: Collaborator[] = shareItem.members || []
		const memberCount: number = shareItem.member_count ?? members.length

		return (
			<div
				className="flex flex-row items-start justify-between gap-2 border-t border-border pt-2.5"
				data-testid="project-item-collaborators"
			>
				{!isOwner(item.user_role) && (
					<div
						className="flex w-full flex-col justify-center gap-1.5"
						style={{ maxWidth: "calc(100% - 90px)" }}
						data-testid="project-item-creator-section"
					>
						<div
							className="text-[10px] font-normal leading-[13px] text-muted-foreground empty:block"
							data-testid="project-item-creator-label"
						>
							{t("collaborators.creator")}
						</div>
						<div className="flex w-full items-center gap-1">
							<MagicAvatar src={creatorAvatar} size={20} shape="circle">
								{creatorName}
							</MagicAvatar>
							<SmartTooltip className="flex-1 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-foreground">
								{creatorName}
							</SmartTooltip>
						</div>
					</div>
				)}
				<div
					className="flex shrink-0 flex-col justify-center gap-1.5"
					style={{ maxWidth: 80 }}
					data-testid="project-item-members-section"
				>
					<div
						className="text-[10px] font-normal leading-[13px] text-muted-foreground empty:block"
						data-testid="project-item-members-label"
					>
						{t("collaborators.collaborator")}
					</div>
					<AddCollaborators<T>
						members={members}
						totalCount={memberCount}
						isSelfCollaborationProjectStatus={isSelfCollaborationProjectStatus}
						selectedProject={item}
						onAddCollaborators={onAddCollaborators}
					/>
				</div>
				{isSelfCollaborationProjectStatus && (
					<MagicButton
						className="mt-auto flex h-7 items-center gap-1 rounded-lg border border-border px-2 py-1.5"
						onClick={(e) => {
							e.stopPropagation()
							handleCopyCollaborationLink(item)
						}}
						data-testid="project-item-copy-link-button"
					>
						<MagicIcon component={IconLink} size={14} />
						{t("project.copyLink")}
					</MagicButton>
				)}
			</div>
		)
	}, [
		isListMode,
		isCollaborationProjectStatus,
		inCollaborationPanel,
		item,
		t,
		isSelfCollaborationProjectStatus,
		onAddCollaborators,
		handleCopyCollaborationLink,
	])

	const timeRender = useMemo(() => {
		switch (sortType) {
			case SortType.PROJECT_UPDATE_TIME:
				return t("common.lastUpdatedAt", {
					time: (item.last_active_at || item.updated_at).replaceAll("-", "/"),
				})
			case SortType.MY_LAST_ACTIVE_TIME:
				if (!item.last_active_at) {
					return t("common.noActiveTime")
				}
				return t("common.lastActiveAt", {
					time: item.last_active_at?.replaceAll("-", "/"),
				})
			case SortType.PROJECT_CREATE_TIME:
				return t("common.createdAt", {
					time: item.created_at.replaceAll("-", "/"),
				})
			default:
				return t("common.lastUpdatedAt", {
					time: (item.last_active_at || item.updated_at).replaceAll("-", "/"),
				})
		}
	}, [item.updated_at, item.created_at, item.last_active_at, sortType, t])

	return (
		<>
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
				{({ open, triggerContextMenu }) => (
					<div
						ref={ref}
						className={cn(
							"relative flex w-full min-w-0 cursor-pointer flex-col gap-2.5 rounded-lg border border-border bg-card p-2.5",
							"h-[183px]",
							!!WithCollaborators && "h-[222px] w-full",
							isListMode &&
								"h-14 w-full flex-row items-center justify-start [&_.project-item-actions]:right-2 [&_.project-item-actions]:top-2 [&_.project-item-actions]:border-none [&_.project-item-actions]:bg-muted [&_.project-item-actions]:text-foreground [&_.project-item-content]:max-w-[calc(100%-50px)] [&_.project-item-content]:flex-1 [&_.project-item-icon]:h-10 [&_.project-item-icon]:w-10 [&_.project-item-icon]:flex-none [&_.project-item-title]:pr-5 [&_.project-item-updated-at]:overflow-hidden [&_.project-item-updated-at]:text-ellipsis [&_.project-item-updated-at]:whitespace-nowrap",
						)}
						onClick={() => onClick(item)}
						onMouseEnter={onMouseEnter}
						data-testid="project-item"
						data-index={index}
						data-view-mode={viewMode}
						data-pinned={item.is_pinned}
						data-collaboration={isCollaborationProjectStatus}
						data-workspace-shortcut={isWorkspaceShortcutProjectStatus}
						data-project-name={item.project_name || t("project.unnamedProject")}
					>
						<div
							className="project-item-icon relative flex flex-1 items-center justify-center rounded px-2 py-2"
							data-testid="project-item-icon"
						>
							<IconWorkspaceProjectFolder
								isHovered={isHover}
								wasHovered={!isHover}
								size={isListMode ? 30 : 60}
							/>
						</div>
						<div
							className="project-item-content flex max-w-full flex-col gap-1"
							data-testid="project-item-content"
						>
							{/* 编辑时，只允许编辑非工作区快捷项目 */}
							{isEditing && !isWorkspaceShortcutProjectStatus && onRenameProject ? (
								<Input
									autoFocus
									className="h-5"
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
									gap={4}
									data-testid="project-item-title-wrapper"
								>
									{item.is_pinned && <PinnedTag className="" showText={false} />}
									{!inCollaborationPanel && (
										<CollaborationProjectTag
											visible={isCollaborationProject(item)}
											project={item}
											showText={false}
										/>
									)}
									<SmartTooltip
										className={cn(
											"project-item-title rounded text-sm font-semibold leading-5 text-foreground",
											!onRenameProject && "hover:bg-transparent",
											isListMode && "cursor-pointer",
											!isListMode && "cursor-text",
										)}
										onClick={isListMode ? undefined : handleNameClick}
										data-testid="project-item-title"
										data-editable={!isListMode && !!onRenameProject}
									>
										{item.project_name || t("project.unnamedProject")}
									</SmartTooltip>
								</FlexBox>
							)}
							<SmartTooltip
								className="project-item-updated-at text-[10px] font-normal leading-[13px] text-muted-foreground"
								data-testid="project-item-time"
								data-sort-type={sortType}
							>
								{timeRender}
							</SmartTooltip>
						</div>

						<div
							className={cn(
								"project-item-actions absolute right-5 top-5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-border bg-black/50 text-white",
								isListMode && "right-2 top-2 border-none bg-muted text-foreground",
							)}
							style={{
								opacity: (isHover || open) && !isEditing ? 1 : 0,
								visibility: (isHover || open) && !isEditing ? "visible" : "hidden",
							}}
							onClick={triggerContextMenu}
							data-testid="project-item-more-button"
							data-visible={isHover || open}
						>
							<IconDots size={18} />
						</div>
						{WithCollaborators}
					</div>
				)}
			</ProjectActionsDropdown>
		</>
	)
}

export default observer(ProjectItem)
