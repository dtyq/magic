import { useEffect, useRef, type ComponentProps, type CSSProperties, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { IconX } from "@tabler/icons-react"
import type { DialogWindowOptions } from "@/hooks/use-dialog-window"
import {
	Dialog,
	DialogContent,
	DialogPortal,
	DialogTitle,
	DialogDescription,
} from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { useSelectionListViewport } from "../../SelectPathModal/components/ProjectResourceSelectorModal/useSelectionListViewport"
import {
	DialogRestoreSizeButton,
	DialogWindowDecorations,
} from "@/pages/superMagic/components/DialogWindow"
import MagicIcon from "@/components/base/MagicIcon"
import MagicSpin from "@/components/base/MagicSpin"
import MagicEmpty from "@/components/base/MagicEmpty"
import { cn } from "@/utils/cn"
import { ProjectBrowserLayout } from "./ProjectBrowserLayout"
import {
	CollaborationProjectType,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import ProjectItem, { SortType, ViewMode } from "../../EmptyWorkspacePanel/components/ProjectItem"

interface ProjectsPanelProps {
	open?: boolean
	title: string
	titleIcon?: ReactNode
	modal?: boolean
	zIndex?: number
	windowOptions?: DialogWindowOptions
	onRestoreRecommendedSize?: () => void
	resizeGuide?: { visible: boolean; onDismiss: () => void }
	description?: string
	onClose: () => void
	children: ReactNode
	sidebar?: ReactNode
}

export function ProjectsPanel({
	open,
	title,
	titleIcon,
	modal = false,
	zIndex,
	windowOptions,
	onRestoreRecommendedSize,
	resizeGuide,
	description,
	onClose,
	children,
	sidebar,
}: ProjectsPanelProps) {
	const { t } = useTranslation("super")
	const wasOpenRef = useRef(false)
	const returnFocusRef = useRef<HTMLElement | null>(null)
	if (open && !wasOpenRef.current)
		returnFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null
	wasOpenRef.current = !!open

	// modal={modal} disables Radix's focus trap and body scroll lock so the nested
	// MagicModal (AddCollaborationToWorkspaceModal / MoveProjectModal / DeleteDangerModal,
	// portaled to body via Antd Modal) can receive focus. Restore the body scroll lock
	// manually below since modal={modal} drops it.
	useEffect(() => {
		if (!open || modal) return
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [open, modal])

	return (
		<Dialog
			open={open}
			modal={modal}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
		>
			{/* modal={modal} drops Radix's overlay, so render a manual mask below the content z-index. */}
			{open && (
				<DialogPortal>
					<div
						aria-hidden="true"
						className="fixed inset-0 z-detail-fullscreen bg-black/50"
						style={zIndex === undefined ? undefined : { zIndex: zIndex - 1 }}
						data-testid="shared-workspace-dialog-mask"
					/>
				</DialogPortal>
			)}
			{open && (
				<DialogContent
					showCloseButton={false}
					style={zIndex === undefined ? undefined : { zIndex }}
					windowOptions={windowOptions}
					className={cn(
						"flex flex-col gap-0 rounded-xl p-0",
						// 复用普通 Dialog 的入场缩放，窗口拖动和尺寸更新仍保持立即跟手。
						windowOptions
							? "overflow-visible data-[state=open]:zoom-in-95 motion-reduce:data-[state=open]:animate-none"
							: "overflow-hidden",
						!windowOptions &&
							"h-[min(680px,calc(100dvh_-_32px))] !w-[min(960px,calc(100vw_-_32px))] !max-w-none",
					)}
					onInteractOutside={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
						const target = returnFocusRef.current
						if (target?.isConnected && !target.closest("[inert]"))
							target.focus({ preventScroll: true })
					}}
					data-testid="shared-workspace-dialog"
				>
					<DialogTitle className="sr-only">{title}</DialogTitle>
					<DialogDescription className="sr-only">
						{description || title}
					</DialogDescription>
					{/* Dialog header */}
					<div
						className={cn(
							"flex min-h-[52px] shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5",
							windowOptions?.draggable &&
								"cursor-grab touch-none select-none active:cursor-grabbing",
						)}
						data-dialog-drag-handle
						data-testid="shared-workspace-dialog-header"
					>
						{titleIcon && (
							<div
								className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
								aria-hidden="true"
							>
								{titleIcon}
							</div>
						)}
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<div
								className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium leading-5 text-foreground"
								data-testid="shared-workspace-dialog-title"
							>
								{title}
							</div>
							{description && (
								<div
									className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-foreground/35"
									data-testid="shared-workspace-dialog-description"
								>
									{description}
								</div>
							)}
						</div>
						<div
							className="flex items-center gap-2.5"
							data-testid="shared-workspace-dialog-actions"
						>
							<DialogRestoreSizeButton
								visible={Boolean(
									windowOptions?.resizable && onRestoreRecommendedSize,
								)}
								onClick={onRestoreRecommendedSize}
							/>
							<button
								type="button"
								aria-label={t("button.close", { ns: "interface" })}
								className="flex cursor-pointer items-center justify-center rounded-[6px] p-1.5 outline-none hover:bg-fill focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-fill-secondary"
								data-testid="shared-workspace-dialog-close-button"
								onClick={(e) => {
									e.stopPropagation()
									onClose()
								}}
							>
								<MagicIcon component={IconX} size={16} />
							</button>
						</div>
					</div>

					{/* 高度从窗口逐层传到滚动区；缩放时标题、搜索和工具栏仍保持可见。 */}
					<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-b-xl">
						{sidebar ? (
							<ProjectBrowserLayout sidebar={sidebar}>
								<div className="flex min-h-0 min-w-0 flex-1 flex-col">
									{children}
								</div>
							</ProjectBrowserLayout>
						) : (
							<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
						)}
					</div>
					{/* 说明留在窗口内，不接管焦点；角落热区与边缘拖拽仍由 Dialog 管理。 */}
					<DialogWindowDecorations
						resizable={windowOptions?.resizable}
						resizeGuide={resizeGuide}
						onRestoreRecommendedSize={onRestoreRecommendedSize}
					/>
				</DialogContent>
			)}
		</Dialog>
	)
}

interface ProjectsPanelListProps<T extends ProjectListItem> {
	projects: T[]
	loading: boolean
	viewMode: ViewMode
	listLayout?: "project" | "resource"
	toolbar?: ReactNode
	listViewport?: ReturnType<typeof useSelectionListViewport>
	itemProps: Omit<ComponentProps<typeof ProjectItem<T>>, "project" | "index" | "viewMode">
	renderItem?: (props: ComponentProps<typeof ProjectItem<T>>) => ReactNode
	tabType?: CollaborationProjectType
	error?: ReactNode
	footer?: ReactNode
	emptyContent?: ReactNode
	selectedProjectId?: string
	total?: number
}

export function ProjectsPanelList<T extends ProjectListItem>({
	projects,
	loading,
	viewMode,
	listLayout = "project",
	toolbar,
	itemProps,
	renderItem,
	tabType,
	error,
	footer,
	emptyContent,
	selectedProjectId,
	total,
	listViewport,
}: ProjectsPanelListProps<T>) {
	const { t } = useTranslation("super")
	const isList = viewMode === ViewMode.LIST
	const isResourceLayout = listLayout === "resource"
	const isShared = !!itemProps.inCollaborationPanel
	// 最近项目使用资源缩略图，表头首列与条目的 32px 图标保持一致。
	const iconColumn = itemProps.titleLayout === "recent" ? "32px" : "16px"
	const showCreator = isShared && tabType === CollaborationProjectType.Received
	// 普通列表仅含名称和时间，520px 即可保持列展示；具有人数／创建者的列表仍需 800px。
	// 命名容器只供普通条目使用，表头和条目随同一个内容宽度切换。
	// 表头与条目共用列宽；800px 可容纳最完整的人员列和至少 120px 名称，窄容器改为多行。
	const listStyle: CSSProperties & { "--project-list-columns": string } = {
		"--project-list-columns": showCreator
			? `${iconColumn} minmax(120px,1fr) [creator] 144px [members] 128px [time] 176px [actions] 32px`
			: isShared
				? `${iconColumn} minmax(120px,1fr) [members] 128px [time] 176px [actions] 128px`
				: `${iconColumn} minmax(120px,1fr) [time] 176px [actions] 32px`,
	}
	const timeHeading =
		itemProps.sortType === SortType.MY_LAST_ACTIVE_TIME
			? t("sidebarPanels.lastActiveTime")
			: itemProps.sortType === SortType.PROJECT_CREATE_TIME
				? t("sidebarPanels.createdTime")
				: t("sidebarPanels.updatedTime")
	return (
		<MagicSpin
			section
			spinning={loading}
			className="flex min-h-0 flex-1 flex-col"
			innerClassName="flex min-h-0 flex-1 flex-col"
		>
			<div
				className="flex min-h-0 flex-1 flex-col"
				data-testid="shared-workspace-dialog-project-list"
				data-tab-type={tabType}
			>
				{toolbar}
				{/* Project list */}
				<div ref={listViewport?.containerRef} className="min-h-0 flex-1">
					<ScrollArea
						className="h-full"
						style={listViewport?.height ? { height: listViewport.height } : undefined}
						viewportRef={listViewport?.viewportRef}
						viewportClassName="[&>div]:!block"
					>
						<div
							className={cn(
								"min-w-0 bg-muted/20 p-3",
								isList && "[container-type:inline-size]",
								isList && !isShared && "[container-name:project-list]",
							)}
							style={isList ? listStyle : undefined}
							data-list-layout={isShared ? "collaboration" : "project"}
						>
							{error}
							{isList && !isResourceLayout && projects.length > 0 && (
								<div className="hidden items-center gap-x-3 border-b border-border px-3 py-2 text-xs text-muted-foreground [grid-template-columns:var(--project-list-columns)] [@container_(min-width:800px)]:grid [@container_project-list_(min-width:520px)]:grid">
									<span className="col-span-2">
										{t("sidebarPanels.projectName")}
									</span>
									{showCreator && <span>{t("collaborators.creator")}</span>}
									{isShared && <span>{t("collaborators.collaborator")}</span>}
									<span>{timeHeading}</span>
									<span className="sr-only">{t("common.moreActions")}</span>
								</div>
							)}
							<div
								className={cn(
									"grid",
									viewMode === ViewMode.LIST
										? "grid-cols-1"
										: "gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]",
									// 资源卡片统一网格行高，空字段不再让卡片边框停在半行。
									!isList && isResourceLayout && "auto-rows-fr",
								)}
								data-testid="shared-workspace-dialog-project-list-layout"
								data-view-mode={viewMode}
							>
								{projects.map((item, index) => (
									<div
										key={item.id}
										data-testid="shared-workspace-dialog-project-item"
										data-tab-type={tabType}
										data-project-id={item.id}
										aria-current={
											selectedProjectId === item.id ? true : undefined
										}
										className={cn(
											selectedProjectId === item.id &&
												(isList
													? "[&_[data-testid=project-item]]:bg-primary/5"
													: "rounded-lg [&_[data-testid=project-item]]:border-primary [&_[data-testid=project-item]]:bg-primary/5"),
										)}
										data-project-name={
											item.project_name || t("project.unnamedProject")
										}
									>
										{renderItem ? (
											renderItem({
												...itemProps,
												project: item,
												index,
												viewMode,
												variant: "compact",
												collaborationType: tabType,
											})
										) : (
											<ProjectItem<T>
												{...itemProps}
												project={item}
												index={index}
												viewMode={viewMode}
												variant="compact"
												collaborationType={tabType}
											/>
										)}
									</div>
								))}
							</div>
							{!error && !loading && projects.length === 0 && (
								<div
									data-testid="shared-workspace-dialog-project-empty"
									data-tab-type={tabType}
								>
									{emptyContent || (
										<MagicEmpty description={t("project.noProjects")} />
									)}
								</div>
							)}
							{total !== undefined && projects.length > 0 && (
								<div className="pt-3 text-center text-xs text-muted-foreground">
									{t("sidebarPanels.loadedProjects", {
										count: projects.length,
										total,
									})}
								</div>
							)}
							{footer}
						</div>
					</ScrollArea>
				</div>
			</div>
		</MagicSpin>
	)
}
