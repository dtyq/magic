import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useEffect, useMemo, useState } from "react"
import {
	AlertTriangle,
	CheckCircle2,
	ChevronLeft,
	Copy,
	Download,
	Ellipsis,
	FolderOpen,
	Loader,
	Pencil,
	Share2,
	Sparkles,
	FolderInput,
	Trash2,
	type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import type { AudioProjectListItem } from "@/types/audioProject"
import type { RecordingDetailFileMap } from "../../types/recording-detail"
import {
	formatRecordingCreatedTime,
	formatRecordingDuration,
	isAudioProjectSummarizing,
	isAudioProjectSummaryReady,
	resolveRecordingSourceLabel,
} from "../../utils/audio-recordings-utils"
import { resolveSummaryTypeLabel } from "./resolve-summary-type-label"
import { canCopyAudioProject } from "../../utils/copy-availability"
import {
	RECORDING_DETAIL_HEADER_ICON_ACTION_CLASS,
	RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS,
	RECORDING_DETAIL_HEADER_PRIMARY_ACTION_CLASS,
	RECORDING_DETAIL_HEADER_TEXT_ACTION_CLASS,
	RecordingDetailHeaderMenuItem,
	RecordingDetailHeaderSubMenuTrigger,
} from "./RecordingDetailHeaderActionMenu"
import { useRecordingDetailCapabilities } from "./RecordingDetailProvider"

interface RecordingDetailExportAvailability {
	hasAudio: boolean
	hasTranscript: boolean
	hasNotes: boolean
	hasSummaryFiles: boolean
	hasAnyExportable: boolean
}

interface RecordingDetailHeaderProps {
	title: string
	projectItem: AudioProjectListItem | null
	fileMap: RecordingDetailFileMap | null
	exportAvailability: RecordingDetailExportAvailability
	canGenerateSummary: boolean
	summarySubmitting: boolean
	renaming?: boolean
	showBackButton?: boolean
	onBack: () => void
	onRename: (name: string) => Promise<boolean>
	onGenerateSummary: () => void
	onExportAudio: () => void
	onExportTranscript: () => void
	onExportNotes: () => void
	onExportSummaryType: (type: string) => void
	onExportAll: () => void
	onCreateShare: () => void
	onManageShare: () => void
	onOpenProject?: () => void
	onMoveGroup: () => void
	onCopyToProject?: () => void
	onDelete: () => void
}

interface RecordingDetailSummaryBadge {
	label: string
	icon: LucideIcon
	iconClassName?: string
	toneClassName: string
}

/** Resolves the detail-title summary badge without modeling list-only pipeline states. */
function resolveDetailSummaryBadge(
	projectItem: AudioProjectListItem,
	t: (key: string) => string,
): RecordingDetailSummaryBadge {
	if (isAudioProjectSummaryReady(projectItem)) {
		return {
			label: t("card.summarized"),
			icon: CheckCircle2,
			toneClassName:
				"border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		}
	}

	if (
		projectItem.card_status === "summary_failed" ||
		(projectItem.current_phase === "summarizing" && projectItem.phase_status === "failed")
	) {
		return {
			label: t("card.summaryFailed"),
			icon: AlertTriangle,
			toneClassName: "border-destructive/25 bg-destructive/10 text-destructive",
		}
	}

	if (isAudioProjectSummarizing(projectItem)) {
		return {
			label: t("card.summarizing"),
			icon: Loader,
			iconClassName: "animate-spin",
			toneClassName: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
		}
	}

	return {
		label: t("card.notSummarized"),
		icon: Sparkles,
		toneClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	}
}

/** Desktop detail header with inline rename, status badges, and owner action menus. */
export function RecordingDetailHeader({
	title,
	projectItem,
	fileMap,
	exportAvailability,
	canGenerateSummary,
	summarySubmitting,
	renaming = false,
	showBackButton = true,
	onBack,
	onRename,
	onGenerateSummary,
	onExportAudio,
	onExportTranscript,
	onExportNotes,
	onExportSummaryType,
	onExportAll,
	onCreateShare,
	onManageShare,
	onOpenProject,
	onMoveGroup,
	onCopyToProject,
	onDelete,
}: RecordingDetailHeaderProps) {
	const { permissions: access } = useFileAccess()
	const { t } = useTranslation("audioRecordings")
	const capabilities = useRecordingDetailCapabilities()
	const [editingTitle, setEditingTitle] = useState(false)
	const [titleDraft, setTitleDraft] = useState(title)

	// Keep draft aligned with external title updates when the user is not editing inline.
	useEffect(() => {
		if (!editingTitle) setTitleDraft(title)
	}, [editingTitle, title])

	const statusBadge = useMemo(() => {
		if (!projectItem) return null
		return resolveDetailSummaryBadge(projectItem, t)
	}, [projectItem, t])
	const StatusBadgeIcon = statusBadge?.icon
	const copyAvailability = useMemo(() => canCopyAudioProject(projectItem), [projectItem])
	const canShowOpenProject = Boolean(onOpenProject)
	const canShowCopyToProject = capabilities.canCopyToProject && Boolean(onCopyToProject)
	const isSummaryFailed =
		projectItem?.card_status === "summary_failed" ||
		(projectItem?.current_phase === "summarizing" && projectItem.phase_status === "failed")
	const isSummaryReady = projectItem ? isAudioProjectSummaryReady(projectItem) : false
	const canShowGenerateSummary =
		capabilities.canGenerateSummary && (canGenerateSummary || isSummaryReady || isSummaryFailed)
	const summaryActionLabel =
		isSummaryReady || isSummaryFailed ? t("card.regenerateSummary") : t("card.generateSummary")

	/** i18n labels for recording source resolution — mirrors AudioRecordingCard usage */
	const sourceLabels = useMemo(
		() => ({
			sourceRecorded: t("card.sourceRecorded"),
			sourceImported: t("card.sourceImported"),
			sourceDevice: t("card.sourceDevice"),
			sourcePc: t("card.sourcePc"),
		}),
		[t],
	)

	/** Commits an inline title edit only when the user changed the trimmed value. */
	async function commitTitleEdit() {
		if (renaming) return
		const next = titleDraft.trim()
		setEditingTitle(false)
		if (!next || next === title) return
		await onRename(next)
	}

	return (
		<div className="shrink-0 px-8 pb-3 pt-4" data-testid="recording-detail-header">
			<div className="flex min-w-0 items-center justify-between gap-6">
				<div className="flex min-w-0 items-center gap-4">
					{showBackButton ? (
						<button
							type="button"
							className={RECORDING_DETAIL_HEADER_ICON_ACTION_CLASS}
							onClick={onBack}
							aria-label={t("detail.back")}
							data-testid="recording-detail-back"
						>
							<ChevronLeft className="size-5" />
						</button>
					) : null}

					<div className="min-w-0">
						<div className="flex min-w-0 items-center gap-2">
							{editingTitle && capabilities.canRename ? (
								<Input
									autoFocus
									value={titleDraft}
									disabled={renaming}
									onChange={(event) => setTitleDraft(event.target.value)}
									onBlur={() => void commitTitleEdit()}
									onKeyDown={(event) => {
										if (event.key === "Enter") void commitTitleEdit()
										if (event.key === "Escape") setEditingTitle(false)
									}}
									className="h-9 min-w-[300px] max-w-xl text-lg font-semibold"
									data-testid="recording-detail-title-input"
								/>
							) : (
								<h1 className="truncate text-xl font-semibold text-foreground">
									{title}
								</h1>
							)}
							{capabilities.canRename ? (
								<Button
									variant="ghost"
									size="icon"
									className="size-8 shrink-0"
									disabled={renaming}
									onClick={() => {
										setTitleDraft(title)
										setEditingTitle(true)
									}}
									data-testid="recording-detail-rename-trigger"
								>
									<Pencil className="size-4" />
								</Button>
							) : null}
						</div>

						{projectItem ? (
							<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span>{formatRecordingCreatedTime(projectItem.created_at)}</span>
								<span>·</span>
								<span>{formatRecordingDuration(projectItem.duration)}</span>
								<span>·</span>
								<span>
									{resolveRecordingSourceLabel(projectItem, sourceLabels)}
								</span>
								{statusBadge ? (
									<span
										className={`inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] font-medium leading-[14px] ${statusBadge.toneClassName}`}
										data-testid="recording-detail-summary-status"
									>
										{StatusBadgeIcon ? (
											<span className="inline-flex size-3 shrink-0 items-center justify-center">
												<StatusBadgeIcon
													className={`block size-3 ${statusBadge.iconClassName ?? ""}`}
													aria-hidden
												/>
											</span>
										) : null}
										<span className="leading-[14px]">{statusBadge.label}</span>
									</span>
								) : null}
							</div>
						) : null}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					{canShowGenerateSummary ? (
						<Button
							className={RECORDING_DETAIL_HEADER_PRIMARY_ACTION_CLASS}
							onClick={onGenerateSummary}
							disabled={summarySubmitting}
							data-testid="recording-detail-generate-summary"
						>
							<Sparkles className="size-4" />
							{summarySubmitting ? t("detail.summarizing") : summaryActionLabel}
						</Button>
					) : null}

					{capabilities.canExport && access.download ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={RECORDING_DETAIL_HEADER_TEXT_ACTION_CLASS}
									data-testid="recording-detail-export-trigger"
								>
									<Download className="size-4" />
									{t("detail.export")}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className={RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS}
							>
								<RecordingDetailHeaderMenuItem
									disabled={!exportAvailability.hasAudio}
									onClick={() => void onExportAudio()}
								>
									{t("detail.exportAudio")}
								</RecordingDetailHeaderMenuItem>
								<RecordingDetailHeaderMenuItem
									disabled={!exportAvailability.hasTranscript}
									onClick={() => void onExportTranscript()}
								>
									{t("detail.exportTranscript")}
								</RecordingDetailHeaderMenuItem>
								<RecordingDetailHeaderMenuItem
									disabled={!exportAvailability.hasNotes}
									onClick={() => void onExportNotes()}
								>
									{t("detail.exportNotes")}
								</RecordingDetailHeaderMenuItem>
								<DropdownMenuSub>
									<RecordingDetailHeaderSubMenuTrigger
										disabled={!exportAvailability.hasSummaryFiles}
										data-testid="recording-detail-export-summary-sub"
									>
										{t("detail.exportSummary")}
									</RecordingDetailHeaderSubMenuTrigger>
									<DropdownMenuSubContent
										className={RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS}
									>
										{fileMap?.summaryFiles.map((fileRef) => (
											<RecordingDetailHeaderMenuItem
												key={fileRef.type}
												onClick={() =>
													void onExportSummaryType(fileRef.type)
												}
											>
												{resolveSummaryTypeLabel(fileRef.type)}
											</RecordingDetailHeaderMenuItem>
										))}
									</DropdownMenuSubContent>
								</DropdownMenuSub>
								<DropdownMenuSeparator />
								<RecordingDetailHeaderMenuItem
									disabled={!exportAvailability.hasAnyExportable}
									onClick={() => void onExportAll()}
									data-testid="recording-detail-export-all"
								>
									{t("detail.exportAll")}
								</RecordingDetailHeaderMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
					{capabilities.canManageShare && access.share ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={RECORDING_DETAIL_HEADER_TEXT_ACTION_CLASS}
									data-testid="recording-detail-share-trigger"
								>
									<Share2 className="size-4" />
									{t("detail.share")}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className={RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS}
							>
								<RecordingDetailHeaderMenuItem onClick={onCreateShare}>
									{t("detail.shareCreate")}
								</RecordingDetailHeaderMenuItem>
								<RecordingDetailHeaderMenuItem onClick={onManageShare}>
									{t("detail.shareManage")}
								</RecordingDetailHeaderMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}

					{capabilities.canDelete ||
					capabilities.canMoveGroup ||
					canShowOpenProject ||
					canShowCopyToProject ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={RECORDING_DETAIL_HEADER_ICON_ACTION_CLASS}
									aria-label={t("card.moreActions")}
									data-testid="recording-detail-more-trigger"
								>
									<Ellipsis className="size-5" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className={RECORDING_DETAIL_HEADER_MENU_CONTENT_CLASS}
							>
								{canShowOpenProject ? (
									<RecordingDetailHeaderMenuItem
										icon={<FolderOpen />}
										onClick={onOpenProject}
										data-testid="recording-detail-open-project"
									>
										{t("card.openProject")}
									</RecordingDetailHeaderMenuItem>
								) : null}
								{capabilities.canMoveGroup ? (
									<RecordingDetailHeaderMenuItem
										icon={<FolderInput />}
										onClick={onMoveGroup}
									>
										{t("card.moveToGroup")}
									</RecordingDetailHeaderMenuItem>
								) : null}
								{canShowCopyToProject ? (
									<RecordingDetailHeaderMenuItem
										icon={<Copy />}
										disabled={!copyAvailability.canCopy}
										title={
											!copyAvailability.canCopy
												? t("copy.unavailable")
												: undefined
										}
										onClick={onCopyToProject}
										data-testid="recording-detail-copy-to-project"
									>
										{t("card.copyToProject")}
									</RecordingDetailHeaderMenuItem>
								) : null}
								{capabilities.canDelete ? (
									<>
										<DropdownMenuSeparator />
										<RecordingDetailHeaderMenuItem
											icon={<Trash2 />}
											className="text-destructive focus:text-destructive [&_svg]:text-destructive"
											onClick={onDelete}
										>
											{t("actions.deleteTitle")}
										</RecordingDetailHeaderMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
			</div>
		</div>
	)
}
