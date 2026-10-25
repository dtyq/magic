import {
	Search,
	RefreshCw,
	Loader2,
	FilePlus,
	Upload,
	SquareCheckBig,
	ChevronsUpDown,
	ChevronsDownUp,
	MoreHorizontal,
} from "lucide-react"
import { memo } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import FileMenuDropdown from "./FileMenuDropdown"
import UploadMenuDropdown from "./UploadMenuDropdown"
import { type PresetFileType } from "../constant"
import { cn } from "@/utils/cn"
import HeaderTrailingAction from "./HeaderTrailingAction"
import { SidebarRow, type SidebarSectionOptions } from "../../SidebarSection"
import {
	PROJECT_PANEL_HEADER_CLASSNAME,
	PROJECT_PANEL_TITLE_CLASSNAME,
} from "../../ProjectSider/panelChrome"
import { useFileHeaderOverflow } from "../hooks/useFileHeaderOverflow"
import { MagicDropdown } from "@/components/base/MagicDropdown"

interface NormalModeHeaderProps {
	title?: string
	/** Hide the section label; keep search and refresh actions. */
	showTitle?: boolean
	isShareRoute: boolean
	/** Explicit refresh visibility; defaults to hidden on share routes. */
	showRefresh?: boolean
	refreshLoading: boolean
	allowEdit: boolean
	showMobileActions?: boolean
	onRefresh: () => void
	onSearch?: () => void
	onAddFile?: (extraType?: PresetFileType) => void
	onAddDesign?: () => void
	onAddSelfMedia?: () => void
	onAddAICard?: () => void
	onAddFolder?: () => void
	allFoldersExpanded?: boolean
	expandAllLabel?: string
	onToggleAllFolders?: () => void
	onUploadFile?: () => void
	onUploadFolder?: () => void
	onImportFromOtherProject?: () => void
	onEnterSelectMode?: () => void
	headerTrailingAction?: ReactNode
	section?: SidebarSectionOptions
	className?: string
	adaptive?: boolean
}

function NormalModeHeader({
	title,
	showTitle = true,
	isShareRoute,
	showRefresh,
	refreshLoading,
	allowEdit,
	showMobileActions = false,
	onRefresh,
	onSearch,
	onAddFile,
	onAddDesign,
	onAddSelfMedia,
	onAddAICard,
	onAddFolder,
	allFoldersExpanded,
	expandAllLabel,
	onToggleAllFolders,
	onUploadFile,
	onUploadFolder,
	onImportFromOtherProject,
	onEnterSelectMode,
	headerTrailingAction,
	section,
	className,
	adaptive = false,
}: NormalModeHeaderProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const { rowRef, labelRef, actionsRef, overflow } = useFileHeaderOverflow(adaptive)
	const hasOverflow = (adaptive || overflow) && Boolean(onToggleAllFolders)
	const toggleAllFoldersLabel = allFoldersExpanded
		? t("fileTree.collapseAll")
		: (expandAllLabel ?? t("fileTree.expandAll"))
	const shouldShowRefresh = showRefresh ?? !isShareRoute

	const actions = (
		<div
			ref={actionsRef}
			className={cn(
				"relative ml-auto flex shrink-0 items-center gap-1 [&>*]:shrink-0 [&_button]:shrink-0",
				adaptive && "rounded-md bg-muted/50 p-1",
				adaptive && overflow && "ml-0 min-w-0 flex-1 flex-wrap",
			)}
		>
			{onSearch && (
				<MagicTooltip title={t("topicFiles.search")}>
					<button
						className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
						type="button"
						data-testid="file-header-search-button"
						onClick={onSearch}
						aria-label={t("topicFiles.search")}
					>
						<Search size={16} className="text-foreground" />
					</button>
				</MagicTooltip>
			)}
			{allowEdit && onAddFile && (!isMobile || showMobileActions) && (
				<FileMenuDropdown
					onAddFile={onAddFile}
					onAddDesign={onAddDesign}
					onAddSelfMedia={onAddSelfMedia}
					onAddAICard={onAddAICard}
					onAddFolder={onAddFolder}
				>
					<span>
						<MagicTooltip title={t("topicFiles.addFileOrFolder")}>
							<button
								className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
								type="button"
								data-testid="file-header-add-file-button"
								aria-label={t("topicFiles.addFileOrFolder")}
							>
								<FilePlus size={16} className="text-foreground" />
							</button>
						</MagicTooltip>
					</span>
				</FileMenuDropdown>
			)}
			{allowEdit && (onUploadFile || onUploadFolder) && (!isMobile || showMobileActions) && (
				<UploadMenuDropdown
					onUploadFile={onUploadFile}
					onUploadFolder={onUploadFolder}
					onImportFromOtherProject={onImportFromOtherProject}
				>
					<span>
						<MagicTooltip title={t("topicFiles.upload")}>
							<button
								className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
								type="button"
								data-testid="file-header-upload-button"
								aria-label={t("topicFiles.upload")}
							>
								<Upload size={16} className="text-foreground" />
							</button>
						</MagicTooltip>
					</span>
				</UploadMenuDropdown>
			)}
			{adaptive && (
				<span
					data-toolbar-divider
					aria-hidden
					className={cn(
						"min-w-2 self-stretch border-r border-border/60",
						overflow && "flex-1 border-0",
					)}
				/>
			)}
			{onToggleAllFolders && (
				<div
					className={cn(
						"flex shrink-0",
						hasOverflow && "pointer-events-none invisible absolute",
					)}
					aria-hidden={hasOverflow || undefined}
				>
					<MagicTooltip title={toggleAllFoldersLabel}>
						<button
							className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
							type="button"
							data-testid="file-header-toggle-all-button"
							onClick={onToggleAllFolders}
							aria-label={toggleAllFoldersLabel}
						>
							{allFoldersExpanded ? (
								<ChevronsDownUp size={16} className="text-foreground" />
							) : (
								<ChevronsUpDown size={16} className="text-foreground" />
							)}
						</button>
					</MagicTooltip>
				</div>
			)}
			{shouldShowRefresh && (
				<MagicTooltip title={t("topicFiles.refreshList")}>
					<button
						className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
						type="button"
						data-testid="file-header-refresh-button"
						onClick={onRefresh}
						aria-label={t("topicFiles.refreshList")}
						disabled={refreshLoading}
					>
						{refreshLoading ? (
							<Loader2 size={16} className="animate-spin text-foreground" />
						) : (
							<RefreshCw size={16} className="text-foreground" />
						)}
					</button>
				</MagicTooltip>
			)}
			{allowEdit && onEnterSelectMode && (
				<MagicTooltip title={t("topicFiles.selectFiles")}>
					<button
						className="flex h-6 w-6 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-accent"
						type="button"
						data-testid="file-header-select-mode-button"
						onClick={onEnterSelectMode}
						aria-label={t("topicFiles.selectFiles")}
					>
						<SquareCheckBig size={16} className="text-foreground" />
					</button>
				</MagicTooltip>
			)}
			{headerTrailingAction ? (
				<HeaderTrailingAction>{headerTrailingAction}</HeaderTrailingAction>
			) : null}
			{hasOverflow && (
				<div data-overflow-trigger className="flex shrink-0">
					<MagicDropdown
						trigger={["click"]}
						menu={{
							items: [
								...(onToggleAllFolders
									? [
											{
												key: "toggle-folders",
												label: toggleAllFoldersLabel,
												icon: allFoldersExpanded ? (
													<ChevronsDownUp size={16} />
												) : (
													<ChevronsUpDown size={16} />
												),
												onClick: onToggleAllFolders,
											},
										]
									: []),
							],
						}}
					>
						<span>
							<MagicTooltip title={t("topicFiles.moreActions")}>
								<button
									type="button"
									className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent"
									aria-label={t("topicFiles.moreActions")}
								>
									<MoreHorizontal size={16} />
								</button>
							</MagicTooltip>
						</span>
					</MagicDropdown>
				</div>
			)}
		</div>
	)
	if (adaptive && !section) {
		return (
			<div
				ref={rowRef}
				className={cn(
					"flex min-h-10 w-full items-center gap-2 px-3 py-1",
					overflow && "flex-wrap",
					className,
				)}
			>
				{showTitle ? (
					<h3
						className={cn(
							"min-w-0 flex-1 text-[13px] font-medium leading-5",
							overflow && "basis-full",
						)}
					>
						<span
							ref={labelRef}
							className="inline-block break-words [overflow-wrap:anywhere]"
						>
							{title || t("topicFiles.title")}
						</span>
					</h3>
				) : null}
				{actions}
			</div>
		)
	}
	return section ? (
		<SidebarRow
			label={title || t("topicFiles.title")}
			labelVariant={section.labelVariant}
			onClick={section.onClick}
			isExpanded={section.isExpanded}
			leading={section.leading}
			trailing={adaptive && !section.isExpanded ? undefined : actions}
			wrapLabel={adaptive || section.wrapLabel}
			stackTrailing={adaptive && overflow}
			description={adaptive && section.isExpanded ? section.description : undefined}
			testId="file-section-header"
			rowRef={rowRef}
			labelRef={labelRef}
			className={section.headerClassName}
		/>
	) : (
		<div
			ref={rowRef}
			className={cn(PROJECT_PANEL_HEADER_CLASSNAME, className)}
			data-slot="project-panel-header"
		>
			{showTitle ? (
				<p className={PROJECT_PANEL_TITLE_CLASSNAME} data-slot="project-panel-title">
					<span ref={labelRef} className="inline-block whitespace-nowrap">
						{title || t("topicFiles.title")}
					</span>
				</p>
			) : null}
			{actions}
		</div>
	)
}

export default memo(NormalModeHeader)
