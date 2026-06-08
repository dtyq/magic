import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import {
	AudioLines,
	CheckCircle2,
	Clock,
	Ellipsis,
	FileAudio,
	Loader2,
	PenLine,
	Smartphone,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { AudioProjectListItem } from "@/types/audioProject"
import {
	formatRecordingCreatedTime,
	formatRecordingDuration,
	isAudioProjectPreviewReady,
	resolveRecordingDisplayName,
	resolveRecordingSourceLabel,
} from "../utils/audio-recordings-utils"
import {
	canClickSummaryButton,
	getSummaryButtonVariant,
	shouldShowSummaryButton,
} from "../utils/summary-action-utils"

interface AudioRecordingCardProps {
	item: AudioProjectListItem
	onOpen?: (item: AudioProjectListItem) => void
	onSummarize?: (item: AudioProjectListItem) => void
	onRename?: (item: AudioProjectListItem) => void
	onDelete?: (item: AudioProjectListItem) => void
	isSubmitting?: boolean
}

const COLLAPSED_TAG_LIMIT = 2

const cardMetaBadgeClassName =
	"inline-flex max-w-full items-center gap-1 rounded-full border-transparent bg-muted px-2.5 py-0.5 text-xs font-normal text-muted-foreground"

interface HorizontalScrollFadeState {
	canScrollStart: boolean
	canScrollEnd: boolean
}

/** Tracks horizontal overflow and maps vertical wheel to sideways scroll for a meta strip */
function useHorizontalScrollWithFade<T extends HTMLElement>() {
	const scrollRef = useRef<T>(null)
	const [fadeState, setFadeState] = useState<HorizontalScrollFadeState>({
		canScrollStart: false,
		canScrollEnd: false,
	})

	const updateFadeState = useCallback(() => {
		const element = scrollRef.current
		if (!element) return

		const { scrollLeft, scrollWidth, clientWidth } = element
		const maxScrollLeft = scrollWidth - clientWidth
		const hasOverflow = maxScrollLeft > 1

		setFadeState({
			canScrollStart: hasOverflow && scrollLeft > 1,
			canScrollEnd: hasOverflow && scrollLeft < maxScrollLeft - 1,
		})
	}, [])

	useEffect(() => {
		const element = scrollRef.current
		if (!element) return

		updateFadeState()

		const handleWheel = (event: WheelEvent) => {
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
			if (element.scrollWidth <= element.clientWidth) return
			event.preventDefault()
			element.scrollLeft += event.deltaY
		}

		element.addEventListener("scroll", updateFadeState, { passive: true })
		element.addEventListener("wheel", handleWheel, { passive: false })

		const resizeObserver = new ResizeObserver(updateFadeState)
		resizeObserver.observe(element)

		return () => {
			element.removeEventListener("scroll", updateFadeState)
			element.removeEventListener("wheel", handleWheel)
			resizeObserver.disconnect()
		}
	}, [updateFadeState])

	return { scrollRef, ...fadeState, refreshFadeState: updateFadeState }
}

interface CardTagsRowProps {
	tags: string[]
	cardId: string
	isExpanded: boolean
	onExpand: () => void
	onCollapse: () => void
	moreTagsLabel: string
	collapseTagsLabel: string
}

/** Renders collapsed or expanded tag badges with optional horizontal wheel scroll */
function CardTagsRow({
	tags,
	cardId,
	isExpanded,
	onExpand,
	onCollapse,
	moreTagsLabel,
	collapseTagsLabel,
}: CardTagsRowProps) {
	const hiddenTagCount = Math.max(0, tags.length - COLLAPSED_TAG_LIMIT)
	const visibleTags = isExpanded ? tags : tags.slice(0, COLLAPSED_TAG_LIMIT)

	if (tags.length === 0) return null

	const handleExpandClick = (event: MouseEvent) => {
		event.stopPropagation()
		onExpand()
	}

	const handleCollapseClick = (event: MouseEvent) => {
		event.stopPropagation()
		onCollapse()
	}

	return (
		<>
			{visibleTags.map((tag) => (
				<span
					key={tag}
					className={cn(
						cardMetaBadgeClassName,
						"max-w-[120px] shrink-0 truncate border border-border/60 bg-background",
					)}
				>
					{tag}
				</span>
			))}

			{!isExpanded && hiddenTagCount > 0 ? (
				<button
					type="button"
					className={cn(
						cardMetaBadgeClassName,
						"cursor-pointer border border-border/60 bg-background hover:bg-muted/80",
					)}
					onClick={handleExpandClick}
					data-testid={`audio-recording-card-${cardId}-tags-expand`}
				>
					{moreTagsLabel}
				</button>
			) : null}

			{isExpanded && hiddenTagCount > 0 ? (
				<button
					type="button"
					className={cn(
						cardMetaBadgeClassName,
						"cursor-pointer border border-border/60 bg-background hover:bg-muted/80",
					)}
					onClick={handleCollapseClick}
					data-testid={`audio-recording-card-${cardId}-tags-collapse`}
				>
					{collapseTagsLabel}
				</button>
			) : null}
		</>
	)
}

interface CardActionMenuProps {
	cardId: string
	label: string
	renameLabel: string
	deleteLabel: string
	onRename?: () => void
	onDelete?: () => void
}

/** Renders rename/delete actions behind the card ellipsis menu */
function CardActionMenu({
	cardId,
	label,
	renameLabel,
	deleteLabel,
	onRename,
	onDelete,
}: CardActionMenuProps) {
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

	const handleTriggerClick = useCallback((event: MouseEvent) => {
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
					data-testid={`audio-recording-card-${cardId}-more-actions`}
				>
					<Ellipsis className="h-4 w-4" aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[120px]">
				<DropdownMenuItem
					onClick={handleRename}
					data-testid={`audio-recording-card-${cardId}-action-rename`}
				>
					<PenLine className="h-4 w-4" aria-hidden />
					{renameLabel}
				</DropdownMenuItem>
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
	onOpen,
	onSummarize,
	onRename,
	onDelete,
	isSubmitting = false,
}: AudioRecordingCardProps) {
	const { t } = useTranslation("audioRecordings")
	const [tagsExpanded, setTagsExpanded] = useState(false)
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
	const tags = item.tags ?? []
	const {
		scrollRef: metaScrollRef,
		canScrollStart,
		canScrollEnd,
		refreshFadeState,
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

	const handleTagsExpand = useCallback(() => {
		setTagsExpanded(true)
		requestAnimationFrame(() => refreshFadeState())
	}, [refreshFadeState])

	const handleTagsCollapse = useCallback(() => {
		setTagsExpanded(false)
		requestAnimationFrame(() => refreshFadeState())
	}, [refreshFadeState])

	const handleRename = useCallback(() => {
		onRename?.(item)
	}, [item, onRename])

	const handleDelete = useCallback(() => {
		onDelete?.(item)
	}, [item, onDelete])

	const displayName = resolveRecordingDisplayName(item.project_name, item.created_at)
	const sourceLabel = resolveRecordingSourceLabel(item, {
		sourceRecorded: t("card.sourceRecorded"),
		sourceImported: t("card.sourceImported"),
		sourceDevice: t("card.sourceDevice"),
	})
	const createdLabel = formatRecordingCreatedTime(item.created_at)
	const durationLabel = formatRecordingDuration(item.duration)
	const SourceIcon = item.audio_source === "imported" ? Upload : Smartphone
	const summaryButtonLabel =
		summaryButtonVariant === "retry" ? t("card.retrySummary") : t("card.summarize")

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
				"flex min-h-[132px] min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 transition-all",
				isReady ? "cursor-pointer hover:border-border hover:shadow-sm" : "cursor-default",
			)}
			data-testid={`audio-recording-card-${item.id}`}
			data-card-status={item.card_status}
			data-summarized={isReady ? "1" : "0"}
		>
			{/* Header: icon + title */}
			<div className="flex min-w-0 items-center gap-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground"
					aria-hidden
				>
					<FileAudio className="h-[18px] w-[18px]" />
				</div>
				<h3 className="min-w-0 flex-1 truncate text-base font-semibold leading-6 text-foreground">
					{displayName}
				</h3>
			</div>

			{/* Metadata row: created time (left) + duration (right) */}
			<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
				<span
					className="inline-flex min-w-0 items-center gap-1.5"
					data-testid={`audio-recording-card-${item.id}-created-at`}
				>
					<Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
					<span className="truncate">{createdLabel}</span>
				</span>
				<span
					className="inline-flex shrink-0 items-center gap-1.5"
					data-testid={`audio-recording-card-${item.id}-duration`}
				>
					<AudioLines className="h-3.5 w-3.5 shrink-0" aria-hidden />
					<span>{durationLabel}</span>
				</span>
			</div>

			{/* Footer: single row — scrollable meta strip with edge fades; actions pinned right */}
			<div className="mt-auto flex min-w-0 items-center gap-2">
				<div className="relative min-w-0 flex-1">
					<div
						ref={metaScrollRef}
						className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						data-testid={`audio-recording-card-${item.id}-meta-row`}
					>
						<div
							className="flex shrink-0 items-center gap-1.5"
							data-testid={`audio-recording-card-${item.id}-source-row`}
						>
							{item.card_status === "summarized" ? (
								<span
									className={cn(cardMetaBadgeClassName, "shrink-0")}
									data-testid={`audio-recording-card-${item.id}-status-summarized`}
								>
									<CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
									{t("card.summarized")}
								</span>
							) : null}

							<span
								className={cn(cardMetaBadgeClassName, "max-w-[140px] shrink-0")}
								data-testid={`audio-recording-card-${item.id}-source`}
							>
								<SourceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
								<span className="truncate">{sourceLabel}</span>
							</span>
						</div>

						{tags.length > 0 ? (
							<div
								className="flex shrink-0 flex-nowrap items-center gap-1.5"
								data-testid={`audio-recording-card-${item.id}-tags`}
							>
								<CardTagsRow
									tags={tags}
									cardId={item.id}
									isExpanded={tagsExpanded}
									onExpand={handleTagsExpand}
									onCollapse={handleTagsCollapse}
									moreTagsLabel={t("card.moreTags", {
										count: Math.max(0, tags.length - COLLAPSED_TAG_LIMIT),
									})}
									collapseTagsLabel={t("card.collapseTags")}
								/>
							</div>
						) : null}
					</div>

					{canScrollStart ? (
						<div
							className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card via-card/70 to-transparent"
							data-testid={`audio-recording-card-${item.id}-meta-fade-start`}
							aria-hidden
						/>
					) : null}

					{canScrollEnd ? (
						<div
							className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card via-card/70 to-transparent"
							data-testid={`audio-recording-card-${item.id}-meta-fade-end`}
							aria-hidden
						/>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{showSummarizingSpinner ? (
						<span
							className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
							data-testid={`audio-recording-card-${item.id}-status-summarizing`}
						>
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
							{t("card.summarizing")}
						</span>
					) : null}

					{showSummaryButton ? (
						<Button
							type="button"
							size="sm"
							className="h-8 shrink-0 gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-medium text-background hover:bg-foreground/90"
							disabled={!canClickSummary}
							onClick={handleSummarizeClick}
							data-testid={`audio-recording-card-${item.id}-summary-button`}
						>
							{isSubmitting ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
							) : (
								<Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
							)}
							{summaryButtonLabel}
						</Button>
					) : null}

					{item.card_status === "not_summarized" && !showSummaryButton ? (
						<span
							className="inline-flex shrink-0 items-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
							data-testid={`audio-recording-card-${item.id}-status-not-summarized`}
						>
							{t("card.notSummarized")}
						</span>
					) : null}

					<CardActionMenu
						cardId={item.id}
						label={t("card.moreActions")}
						renameLabel={t("card.rename")}
						deleteLabel={t("card.delete")}
						onRename={handleRename}
						onDelete={handleDelete}
					/>
				</div>
			</div>
		</div>
	)
}

export default memo(AudioRecordingCard)
