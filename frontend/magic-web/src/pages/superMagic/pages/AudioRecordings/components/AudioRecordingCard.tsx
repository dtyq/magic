import { memo, useCallback, type KeyboardEvent, type MouseEvent } from "react"
import {
	AlertTriangle,
	AudioLines,
	CheckCircle2,
	Clock,
	CloudUpload,
	Copy,
	Ellipsis,
	FileAudio,
	FolderOpen,
	Loader,
	Loader2,
	PenLine,
	Timer,
	Sparkles,
	Trash2,
	RefreshCw,
	type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import { useHorizontalScrollWithFade } from "../hooks/useHorizontalScrollWithFade"
import type { AudioProjectListItem } from "@/types/audioProject"
import {
	formatRecordingCreatedTime,
	formatRecordingDuration,
	isRecordingDurationPending,
	isAudioProjectPreviewReady,
	resolveRecordingDisplayName,
	resolveRecordingSourceLabel,
	resolveRecordingSourceIcon,
} from "../utils/audio-recordings-utils"
import {
	canClickSummaryButton,
	getSummaryButtonVariant,
	shouldShowSummaryButton,
} from "../utils/summary-action-utils"
import { canCopyAudioProject } from "../utils/copy-availability"

interface AudioRecordingCardProps {
	item: AudioProjectListItem
	layout?: "desktop" | "mobile"
	onOpen?: (item: AudioProjectListItem) => void
	onSummarize?: (item: AudioProjectListItem) => void
	onOpenProject?: (item: AudioProjectListItem) => void
	onRename?: (item: AudioProjectListItem) => void
	onDelete?: (item: AudioProjectListItem) => void
	onCopyToProject?: (item: AudioProjectListItem) => void
	onMore?: (item: AudioProjectListItem) => void
	onRetry?: (item: AudioProjectListItem) => void
	onRetryMerge?: (item: AudioProjectListItem) => void
	onMoveToGroup?: (item: AudioProjectListItem) => void
	isSubmitting?: boolean
}

interface LinearProgressProps {
	value: number
	tone?: "default" | "destructive"
	indeterminate?: boolean
	height?: number
}

const UPLOAD_PROGRESS_NEUTRAL_TRACK = "rgba(24, 24, 27, 0.08)"
const UPLOAD_PROGRESS_NEUTRAL_FILL = "rgb(24, 24, 27)"
const UPLOAD_PROGRESS_DESTRUCTIVE = "rgb(239, 68, 68)"
/** Linear progress bar component for visual file uploads */
function LinearProgress({
	value,
	tone = "default",
	indeterminate = false,
	height = 6,
}: LinearProgressProps) {
	const pct = Math.max(0, Math.min(1, value)) * 100
	// The prototype uses a neutral ink-like upload fill instead of a product-blue progress bar.
	const fg = tone === "destructive" ? UPLOAD_PROGRESS_DESTRUCTIVE : UPLOAD_PROGRESS_NEUTRAL_FILL

	return (
		<div
			className="w-full overflow-hidden rounded-full"
			style={{
				height,
				// Keep the track very light so the dark fill remains the only strong upload emphasis.
				background: UPLOAD_PROGRESS_NEUTRAL_TRACK,
			}}
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(pct)}
		>
			<div
				className="h-full rounded-full transition-[width] duration-300 ease-out"
				style={{
					width: `${pct}%`,
					backgroundColor: fg,
					backgroundImage: indeterminate
						? `repeating-linear-gradient(45deg, ${fg} 0 8px, rgba(255, 255, 255, 0.08) 8px 16px)`
						: undefined,
					backgroundSize: indeterminate ? "32px 32px" : undefined,
					animation: indeterminate
						? "linear-progress-stripes 0.9s linear infinite"
						: undefined,
				}}
			/>
		</div>
	)
}

interface ProgressMetaProps {
	isTransferFailed: boolean
	pctText: number
}

/** Upload speed/status title row shown above progress bar */
function ProgressMeta({ isTransferFailed, pctText }: ProgressMetaProps) {
	const { t } = useTranslation("super")

	let label = ""
	let labelColor = ""
	let pctColor = ""
	let Icon = CloudUpload

	if (isTransferFailed) {
		label = t("mobile.recordingEntry.progress.transferFailed")
		labelColor = UPLOAD_PROGRESS_DESTRUCTIVE
		pctColor = UPLOAD_PROGRESS_DESTRUCTIVE
		Icon = AlertTriangle
	} else {
		label = t("mobile.recordingEntry.progress.uploading")
		// The prototype keeps the upload percentage at the same emphasis level as the label.
		labelColor = UPLOAD_PROGRESS_NEUTRAL_FILL
		pctColor = UPLOAD_PROGRESS_NEUTRAL_FILL
		Icon = CloudUpload
	}

	return (
		<div className="flex items-center justify-between gap-2 text-[13px] leading-5">
			<span
				className="inline-flex min-w-0 items-center gap-1.5 font-medium"
				style={{ color: labelColor }}
			>
				<Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
				<span className="truncate">{label}</span>
			</span>
			<span className="shrink-0 font-medium tabular-nums" style={{ color: pctColor }}>
				{pctText}%
			</span>
		</div>
	)
}

/** Outlined status chip for summarized recordings (prototype ChipOutline) */
function ChipOutline({
	icon: Icon,
	children,
	"data-testid": testId,
}: {
	icon: LucideIcon
	children: React.ReactNode
	"data-testid"?: string
}) {
	return (
		<span
			className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-[12px] font-medium leading-4 text-foreground"
			data-testid={testId}
		>
			<Icon className="size-3.5" strokeWidth={1.8} />
			{children}
		</span>
	)
}

/** Muted chip for source metadata (prototype ChipMuted) */
function ChipMuted({
	icon: Icon,
	children,
	"data-testid": testId,
}: {
	icon: LucideIcon
	children: React.ReactNode
	"data-testid"?: string
}) {
	return (
		<span
			className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-[12px] font-medium leading-4 text-muted-foreground"
			data-testid={testId}
		>
			<Icon className="size-3.5" strokeWidth={1.8} />
			{children}
		</span>
	)
}

/** Destructive chip used for failed summary / merge states to mirror the prototype emphasis. */
function ChipDestructive({
	icon: Icon,
	children,
	"data-testid": testId,
}: {
	icon: LucideIcon
	children: React.ReactNode
	"data-testid"?: string
}) {
	return (
		<span
			className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2.5 text-[12px] font-medium leading-4 text-destructive"
			data-testid={testId}
		>
			<Icon className="size-3.5" strokeWidth={1.8} />
			{children}
		</span>
	)
}

/** Disabled loading action that matches the prototype's dark pill for active summary generation. */
function SummaryLoadingButton({
	label,
	"data-testid": testId,
}: {
	label: string
	"data-testid"?: string
}) {
	return (
		<button
			type="button"
			disabled
			className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-foreground px-3 text-[13px] font-medium leading-5 text-background opacity-50"
			data-testid={testId}
		>
			<Loader className="h-3.5 w-3.5 animate-spin" aria-hidden />
			<span>{label}</span>
		</button>
	)
}

interface CardActionMenuProps {
	cardId: string
	label: string
	openProjectLabel: string
	renameLabel: string
	deleteLabel: string
	copyToProjectLabel: string
	copyUnavailableLabel: string
	moveToGroupLabel?: string
	onOpenProject?: () => void
	onRename?: () => void
	onDelete?: () => void
	onCopyToProject?: () => void
	onRegenerateSummary?: () => void
	onMoveToGroup?: () => void
	regenerateSummaryLabel?: string
	canCopyToProject?: boolean
}

/** Renders project navigation, rename, and delete actions behind the card ellipsis menu */
function CardActionMenu({
	cardId,
	label,
	openProjectLabel,
	renameLabel,
	deleteLabel,
	copyToProjectLabel,
	copyUnavailableLabel,
	moveToGroupLabel,
	onOpenProject,
	onRename,
	onDelete,
	onCopyToProject,
	onRegenerateSummary,
	onMoveToGroup,
	regenerateSummaryLabel,
	canCopyToProject = true,
}: CardActionMenuProps) {
	/** Routes to the recording project without triggering the card preview action. */
	const handleOpenProject = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onOpenProject?.()
		},
		[onOpenProject],
	)

	const handleRename = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onRename?.()
		},
		[onRename],
	)

	const handleDelete = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onDelete?.()
		},
		[onDelete],
	)

	const handleCopyToProject = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			if (!canCopyToProject) return
			onCopyToProject?.()
		},
		[canCopyToProject, onCopyToProject],
	)

	const handleRegenerateSummary = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onRegenerateSummary?.()
		},
		[onRegenerateSummary],
	)

	const handleMoveToGroup = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onMoveToGroup?.()
		},
		[onMoveToGroup],
	)

	const handleTriggerClick = useCallback((event: MouseEvent) => {
		event.stopPropagation()
	}, [])

	/** Keeps keyboard menu activation from bubbling to the card-level Enter/Space handler */
	const handleTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
		event.stopPropagation()
	}, [])

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label={label}
					onClick={handleTriggerClick}
					onKeyDown={handleTriggerKeyDown}
					data-testid={`audio-recording-card-${cardId}-more-actions`}
				>
					<Ellipsis className="h-4 w-4" aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[120px]">
				<DropdownMenuItem
					onClick={handleOpenProject}
					data-testid={`audio-recording-card-${cardId}-action-open-project`}
				>
					<FolderOpen className="h-4 w-4" aria-hidden />
					{openProjectLabel}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={handleRename}
					data-testid={`audio-recording-card-${cardId}-action-rename`}
				>
					<PenLine className="h-4 w-4" aria-hidden />
					{renameLabel}
				</DropdownMenuItem>
				{onMoveToGroup && moveToGroupLabel ? (
					<DropdownMenuItem
						onClick={handleMoveToGroup}
						data-testid={`audio-recording-card-${cardId}-action-move-to-group`}
					>
						<FolderOpen className="h-4 w-4" aria-hidden />
						{moveToGroupLabel}
					</DropdownMenuItem>
				) : null}
				{onCopyToProject ? (
					<DropdownMenuItem
						disabled={!canCopyToProject}
						title={!canCopyToProject ? copyUnavailableLabel : undefined}
						onClick={handleCopyToProject}
						data-testid={`audio-recording-card-${cardId}-action-copy-to-project`}
					>
						<Copy className="h-4 w-4" aria-hidden />
						{copyToProjectLabel}
					</DropdownMenuItem>
				) : null}
				{onRegenerateSummary ? (
					<DropdownMenuItem
						onClick={handleRegenerateSummary}
						data-testid={`audio-recording-card-${cardId}-action-regenerate`}
					>
						<Sparkles className="h-4 w-4" aria-hidden />
						{regenerateSummaryLabel}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					variant="destructive"
					onClick={handleDelete}
					data-testid={`audio-recording-card-${cardId}-action-delete`}
				>
					<Trash2 className="h-4 w-4" aria-hidden />
					{deleteLabel}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Renders a single audio recording card aligned with the recordings list prototype */
function AudioRecordingCard({
	item,
	layout = "desktop",
	onOpen,
	onSummarize,
	onOpenProject,
	onRename,
	onDelete,
	onCopyToProject,
	onMore,
	onRetry,
	onRetryMerge,
	onMoveToGroup,
	isSubmitting = false,
}: AudioRecordingCardProps) {
	const { t } = useTranslation("audioRecordings")
	const isReady = isAudioProjectPreviewReady(item)
	const showSummaryButton = shouldShowSummaryButton(item.current_phase, item.phase_status)
	const summaryButtonVariant = getSummaryButtonVariant(item.current_phase, item.phase_status)
	const canClickSummary = canClickSummaryButton(
		item.current_phase,
		item.phase_status,
		isSubmitting,
	)
	const showSummarizingSpinner =
		item.card_status === "summarizing" &&
		item.phase_status === "in_progress" &&
		!showSummaryButton
	const showProcessingIndicator =
		item.card_status === "processing" &&
		item.current_phase === "merging" &&
		item.phase_status === "in_progress"
	const showWaitingIndicator = item.card_status === "waiting" && item.current_phase === "waiting"
	const showMergeFailedIndicator =
		item.card_status === "merge_failed" &&
		item.current_phase === "merging" &&
		item.phase_status === "failed"
	const showSummaryFailedIndicator =
		item.card_status === "summary_failed" &&
		item.current_phase === "summarizing" &&
		item.phase_status === "failed"
	const copyAvailability = canCopyAudioProject(item)

	const isUploading = item.card_status === "uploading"
	const isUploadFailed = item.card_status === "upload_failed"
	const isProgressMode =
		isUploading ||
		isUploadFailed ||
		item.transferStatus === "transferring" ||
		item.transferStatus === "failed"

	const {
		scrollRef: metaScrollRef,
		canScrollStart,
		canScrollEnd,
	} = useHorizontalScrollWithFade<HTMLDivElement>()

	const handleClick = useCallback(() => {
		if (!isReady) return
		onOpen?.(item)
	}, [isReady, item, onOpen])

	const handleSummarizeClick = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			if (!canClickSummary) return
			onSummarize?.(item)
		},
		[canClickSummary, item, onSummarize],
	)

	const handleRename = useCallback(() => {
		onRename?.(item)
	}, [item, onRename])

	const handleDelete = useCallback(() => {
		onDelete?.(item)
	}, [item, onDelete])

	const handleCopyToProject = useCallback(() => {
		onCopyToProject?.(item)
	}, [item, onCopyToProject])

	const handleMoveToGroup = useCallback(() => {
		onMoveToGroup?.(item)
	}, [item, onMoveToGroup])

	/** Opens the backing project while keeping the recording preview as the card's primary action. */
	const handleOpenProject = useCallback(() => {
		onOpenProject?.(item)
	}, [item, onOpenProject])

	const handleRetryMerge = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation()
			onRetryMerge?.(item)
		},
		[item, onRetryMerge],
	)

	const displayName = resolveRecordingDisplayName(item.project_name, item.created_at)
	const sourceLabel = resolveRecordingSourceLabel(item, {
		sourceRecorded: t("card.sourceRecorded"),
		sourceImported: t("card.sourceImported"),
		sourceDevice: t("card.sourceDevice"),
		sourcePc: t("card.sourcePc"),
	})
	const createdLabel = formatRecordingCreatedTime(item.created_at)
	const isDurationPending = isRecordingDurationPending(item)
	const durationLabel = formatRecordingDuration(item.duration)
	const isMobile = layout === "mobile"
	const SourceIcon = resolveRecordingSourceIcon(item)

	const summaryButtonLabel =
		summaryButtonVariant === "retry"
			? t("card.retrySummary")
			: isMobile
				? t("card.generateSummary")
				: t("card.summarize")
	const showRetrySummaryButton = showSummaryButton && summaryButtonVariant === "retry"

	return (
		<div
			role={isReady ? "button" : undefined}
			tabIndex={isReady ? 0 : -1}
			onClick={isReady ? handleClick : undefined}
			onKeyDown={
				isReady
					? (event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								handleClick()
							}
						}
					: undefined
			}
			className={cn(
				"flex min-w-0 flex-col rounded-2xl bg-card shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] transition-shadow",
				isMobile
					? "gap-2.5 p-3.5"
					: "min-h-[132px] gap-3 p-4 hover:shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]",
				isReady ? "cursor-pointer" : "cursor-default",
			)}
			data-testid={
				isMobile ? `mobile-recording-card-${item.id}` : `audio-recording-card-${item.id}`
			}
			data-card-status={item.card_status}
			data-summarized={isReady ? "1" : "0"}
		>
			{/* Header: icon + title */}
			<div className="flex min-w-0 items-center gap-2.5">
				<div
					className={cn(
						"flex shrink-0 items-center justify-center rounded-lg bg-muted",
						isMobile ? "size-8" : "size-9",
					)}
					aria-hidden
				>
					<FileAudio
						className={cn(
							// Match the prototype by muting only the leading audio glyph, not the title row.
							"text-muted-foreground",
							isMobile ? "size-[18px]" : "size-5",
						)}
					/>
				</div>
				<h3 className="min-w-0 flex-1 truncate text-[16px] font-medium leading-5 text-foreground">
					{displayName}
				</h3>
			</div>

			{/* Metadata row OR Progress Bar row */}
			{isProgressMode ? (
				<div className="flex flex-col gap-2">
					<ProgressMeta
						isTransferFailed={item.transferStatus === "failed" || isUploadFailed}
						pctText={Math.round((item.transferProgress ?? 0) * 100)}
					/>
					<LinearProgress
						value={item.transferProgress ?? 0}
						tone={
							item.transferStatus === "failed" || isUploadFailed
								? "destructive"
								: "default"
						}
						indeterminate={
							item.transferStatus === "transferring" && item.transferProgress === 0
						}
					/>
				</div>
			) : (
				<div className="flex items-center justify-between gap-3 text-[13px] leading-5 text-muted-foreground">
					<span
						className="inline-flex min-w-0 items-center gap-1.5"
						data-testid={
							isMobile ? undefined : `audio-recording-card-${item.id}-created-at`
						}
					>
						<Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span className="truncate">{createdLabel}</span>
					</span>
					<span
						className="inline-flex shrink-0 items-center gap-1.5"
						data-testid={
							isMobile ? undefined : `audio-recording-card-${item.id}-duration`
						}
					>
						<AudioLines className="h-3.5 w-3.5 shrink-0" aria-hidden />
						{/* Static placeholder only — async pipeline progress is shown in the footer status chip. */}
						<span>{isDurationPending ? "--:--" : durationLabel}</span>
					</span>
				</div>
			)}

			{/* Footer: single row — scrollable meta strip with edge fades; actions pinned right */}
			<div className="mt-auto flex min-w-0 items-center gap-2">
				<div className="relative min-w-0 flex-1">
					<div
						ref={metaScrollRef}
						className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						data-testid={
							isMobile ? undefined : `audio-recording-card-${item.id}-meta-row`
						}
					>
						<div
							className="flex shrink-0 items-center gap-1.5"
							data-testid={
								isMobile ? undefined : `audio-recording-card-${item.id}-source-row`
							}
						>
							{item.card_status === "summarized" ? (
								<ChipOutline
									icon={CheckCircle2}
									data-testid={
										isMobile
											? undefined
											: `audio-recording-card-${item.id}-status-summarized`
									}
								>
									{t("card.summarized")}
								</ChipOutline>
							) : null}

							{showSummaryFailedIndicator ? (
								<ChipDestructive
									icon={AlertTriangle}
									data-testid={
										isMobile
											? `mobile-recording-card-status-summary-failed-${item.id}`
											: `audio-recording-card-${item.id}-status-summary-failed`
									}
								>
									{t("card.summaryFailed")}
								</ChipDestructive>
							) : null}

							{showMergeFailedIndicator ? (
								<ChipDestructive
									icon={AlertTriangle}
									data-testid={
										isMobile
											? `mobile-recording-card-status-merge-failed-${item.id}`
											: `audio-recording-card-${item.id}-status-merge-failed`
									}
								>
									{t("card.mergeFailed")}
								</ChipDestructive>
							) : null}

							<ChipMuted
								icon={SourceIcon}
								data-testid={
									isMobile ? undefined : `audio-recording-card-${item.id}-source`
								}
							>
								{sourceLabel}
							</ChipMuted>
						</div>
					</div>

					{canScrollStart ? (
						<div
							className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card via-card/70 to-transparent"
							data-testid={
								isMobile
									? undefined
									: `audio-recording-card-${item.id}-meta-fade-start`
							}
							aria-hidden
						/>
					) : null}

					{canScrollEnd ? (
						<div
							className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card via-card/70 to-transparent"
							data-testid={
								isMobile
									? undefined
									: `audio-recording-card-${item.id}-meta-fade-end`
							}
							aria-hidden
						/>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-1.5">
					{/* Upload Retry Option (Both Mobile and PC) */}
					{isProgressMode && (item.transferStatus === "failed" || isUploadFailed) ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={(event) => {
								event.stopPropagation()
								onRetry?.(item)
							}}
							className="h-8 shrink-0 gap-1 rounded-full border-destructive/20 bg-destructive/10 px-3 text-[13px] font-medium text-destructive hover:bg-destructive/20 hover:text-destructive"
							data-testid={
								isMobile
									? `mobile-recording-card-retry-${item.id}`
									: `audio-recording-card-retry-${item.id}`
							}
						>
							<RefreshCw className="h-3.5 w-3.5" />
							{t("card.retryUpload")}
						</Button>
					) : null}

					{!isProgressMode && showSummarizingSpinner ? (
						<SummaryLoadingButton
							label={t("card.summarizing")}
							data-testid={
								isMobile
									? `mobile-recording-card-summarize-${item.id}`
									: `audio-recording-card-${item.id}-status-summarizing`
							}
						/>
					) : null}

					{!isProgressMode && showProcessingIndicator ? (
						<SummaryLoadingButton
							label={t("card.processing")}
							data-testid={
								isMobile
									? `mobile-recording-card-summarize-${item.id}`
									: `audio-recording-card-${item.id}-status-processing`
							}
						/>
					) : null}

					{!isProgressMode && showWaitingIndicator ? (
						<span
							className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
							data-testid={
								isMobile
									? `mobile-recording-card-summarize-${item.id}`
									: `audio-recording-card-${item.id}-status-waiting`
							}
						>
							<Timer className="h-3.5 w-3.5" aria-hidden />
							{t("card.waiting")}
						</span>
					) : null}

					{!isProgressMode && showMergeFailedIndicator ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={handleRetryMerge}
							className={cn(
								"h-8 shrink-0 gap-1 rounded-full border border-destructive/30 bg-transparent px-3 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-100",
								isMobile && "text-[13px] leading-5",
								!isMobile && "text-[13px] leading-5",
							)}
							data-testid={
								isMobile
									? `mobile-recording-card-merge-retry-${item.id}`
									: `audio-recording-card-${item.id}-merge-retry-button`
							}
						>
							<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
							{t("card.retryMerge")}
						</Button>
					) : null}

					{!isProgressMode && showSummaryButton ? (
						<Button
							type="button"
							size="sm"
							className={cn(
								showRetrySummaryButton
									? "h-8 shrink-0 gap-1 rounded-full border border-destructive/30 bg-transparent px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
									: "h-8 shrink-0 gap-1 rounded-full bg-foreground px-3.5 text-background hover:bg-foreground/90",
								isMobile ? "text-[13px] leading-5" : "text-[13px] leading-5",
								showRetrySummaryButton ? "font-medium" : "font-medium",
							)}
							disabled={!canClickSummary}
							onClick={handleSummarizeClick}
							data-testid={
								isMobile
									? `mobile-recording-card-summarize-${item.id}`
									: `audio-recording-card-${item.id}-summary-button`
							}
						>
							{isSubmitting ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
							) : showRetrySummaryButton ? (
								<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
							) : (
								<Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
							)}
							{summaryButtonLabel}
						</Button>
					) : null}

					{item.card_status === "not_summarized" && !showSummaryButton ? (
						<span
							className="inline-flex shrink-0 items-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
							data-testid={
								isMobile
									? undefined
									: `audio-recording-card-${item.id}-status-not-summarized`
							}
						>
							{t("card.notSummarized")}
						</span>
					) : null}

					{isMobile ? (
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation()
								onMore?.(item)
							}}
							className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full active:bg-foreground/[0.06]"
							aria-label={t("card.moreActions")}
							data-testid={`mobile-recording-card-more-${item.id}`}
						>
							<Ellipsis className="size-5 text-muted-foreground" />
						</button>
					) : (
						<CardActionMenu
							cardId={item.id}
							label={t("card.moreActions")}
							openProjectLabel={t("card.openProject")}
							renameLabel={t("card.rename")}
							deleteLabel={t("card.delete")}
							copyToProjectLabel={t("card.copyToProject")}
							copyUnavailableLabel={t("copy.unavailable")}
							moveToGroupLabel={t("card.moveToGroup")}
							onOpenProject={handleOpenProject}
							onRename={handleRename}
							onDelete={handleDelete}
							onCopyToProject={handleCopyToProject}
							canCopyToProject={copyAvailability.canCopy}
							onMoveToGroup={handleMoveToGroup}
							regenerateSummaryLabel={t("card.regenerateSummary")}
							onRegenerateSummary={
								item.card_status === "summarized" && onSummarize
									? () => onSummarize(item)
									: undefined
							}
						/>
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(AudioRecordingCard)
