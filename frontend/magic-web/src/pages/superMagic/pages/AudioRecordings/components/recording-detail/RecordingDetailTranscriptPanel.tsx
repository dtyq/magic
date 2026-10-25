import { useEffect, useMemo, useRef, useState } from "react"
import { Search, UsersRound, X } from "lucide-react"
import { useDebounce } from "ahooks"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { RecordingTranscriptSegment } from "../../types/recording-detail"
import {
	filterTranscriptSegmentsBySearchQuery,
	normalizeTranscriptSearchQuery,
	splitTranscriptTextBySearchQuery,
} from "../../utils/transcript-search"
import { formatRecordingTime } from "../../utils/time"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { RecordingDetailEmptyState } from "./RecordingDetailEmptyState"
import { RecordingDetailRegionEmptySlot } from "./RecordingDetailRegionEmptySlot"
import { useRecordingDetailCapabilities } from "./RecordingDetailProvider"
import {
	getTranscriptSegmentRowClassName,
	type TranscriptPlaybackVisualState,
	getTranscriptSegmentTextClassName,
	getTranscriptSegmentTimeClassName,
	getTranscriptSpeakerChipToneClassName,
} from "./transcript-segment-styles"
import { RecordingSpeakerFilterControl } from "./RecordingSpeakerFilterControl"

const TRANSCRIPT_HEADER_ACTION_BASE_CLASS =
	"inline-flex shrink-0 items-center justify-center border border-black/10 bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/30"
const TRANSCRIPT_SEARCH_DEBOUNCE_WAIT = 300
const TRANSCRIPT_HEADER_PILL_ACTION_CLASS = `${TRANSCRIPT_HEADER_ACTION_BASE_CLASS} h-8 rounded-full px-3 text-[12px] font-medium leading-none`

/** Centers a transcript row inside its dedicated scroll port without moving ancestor layouts. */
function centerTranscriptSegment(scrollPort: HTMLDivElement, segment: HTMLElement) {
	const scrollPortRect = scrollPort.getBoundingClientRect()
	const segmentRect = segment.getBoundingClientRect()
	const segmentTop = scrollPort.scrollTop + segmentRect.top - scrollPortRect.top
	const centeredScrollTop = segmentTop - (scrollPort.clientHeight - segmentRect.height) / 2
	const maxScrollTop = Math.max(0, scrollPort.scrollHeight - scrollPort.clientHeight)

	// Native scrollIntoView may also scroll overflow-hidden ancestors, so scroll only this list viewport.
	scrollPort.scrollTo({
		top: Math.min(Math.max(0, centeredScrollTop), maxScrollTop),
		behavior: "smooth",
	})
}

interface RecordingDetailTranscriptPanelProps {
	searchScopeKey: string
	segments: RecordingTranscriptSegment[]
	availableSpeakerIds: string[]
	playing: boolean
	currentTime: number
	selectedSpeakerIds: string[]
	speakerNameMap: Record<string, string>
	showSpeakerFilter?: boolean
	totalSegmentsCount?: number
	onSegmentClick: (segment: RecordingTranscriptSegment) => void
	onSelectedSpeakerIdsChange: (speakerIds: string[]) => void
	onOpenSpeakerSettings: () => void
	isSummarizing?: boolean
}

/** Renders seekable transcript segments with playback highlight and speaker pills. */
export function RecordingDetailTranscriptPanel({
	searchScopeKey,
	segments,
	availableSpeakerIds,
	playing,
	currentTime,
	selectedSpeakerIds,
	speakerNameMap,
	showSpeakerFilter = true,
	totalSegmentsCount,
	onSegmentClick,
	onSelectedSpeakerIdsChange,
	onOpenSpeakerSettings,
	isSummarizing = false,
}: RecordingDetailTranscriptPanelProps) {
	const { t } = useTranslation("audioRecordings")
	const capabilities = useRecordingDetailCapabilities()
	const [searchOpen, setSearchOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const normalizedInputSearchQuery = useMemo(
		() => normalizeTranscriptSearchQuery(searchQuery),
		[searchQuery],
	)
	const debouncedSearchQuery = useDebounce(searchQuery, {
		wait: TRANSCRIPT_SEARCH_DEBOUNCE_WAIT,
	})
	const normalizedSearchQuery = useMemo(
		// Clearing or entering whitespace should restore the transcript without waiting for the debounce timer.
		() =>
			normalizedInputSearchQuery ? normalizeTranscriptSearchQuery(debouncedSearchQuery) : "",
		[debouncedSearchQuery, normalizedInputSearchQuery],
	)
	const visibleSegments = useMemo(
		() => filterTranscriptSegmentsBySearchQuery(segments, normalizedSearchQuery),
		[normalizedSearchQuery, segments],
	)
	const hasTranscript = (totalSegmentsCount ?? segments.length) > 0
	const activeSegmentId = useMemo(
		// Playback highlight only represents live playback, not a paused seek position.
		() => (playing ? findActiveSegmentId(visibleSegments, currentTime) : null),
		[visibleSegments, currentTime, playing],
	)
	const listRef = useRef<HTMLDivElement>(null)
	const scrollPortRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		// Search is temporary view state and must not leak into a different recording.
		setSearchOpen(false)
		setSearchQuery("")
	}, [searchScopeKey])

	useEffect(() => {
		if (!activeSegmentId || !listRef.current || !scrollPortRef.current) return
		const node = listRef.current.querySelector(`[data-segment-id="${activeSegmentId}"]`)
		if (node instanceof HTMLElement) {
			centerTranscriptSegment(scrollPortRef.current, node)
		}
	}, [activeSegmentId])
	const speakerLabels = useMemo(
		() =>
			Object.fromEntries(
				availableSpeakerIds.map((speakerId) => [
					speakerId,
					speakerNameMap[speakerId] ?? speakerId,
				]),
			),
		[availableSpeakerIds, speakerNameMap],
	)
	const countLabel =
		totalSegmentsCount != null && totalSegmentsCount !== visibleSegments.length
			? t("detail.transcriptVisibleCount", {
					visibleCount: visibleSegments.length,
					totalCount: totalSegmentsCount,
				})
			: t("detail.transcriptSegmentCountSuffix", { count: visibleSegments.length })

	return (
		<div
			className="flex min-h-0 flex-1 flex-col overflow-hidden"
			data-testid="recording-detail-transcript-panel"
		>
			<div className="flex items-center justify-between px-2 pb-4 pt-2">
				<div className="flex min-w-0 items-baseline gap-2">
					<h2
						className="shrink-0 text-[18px] font-semibold leading-7 text-foreground"
						data-testid="recording-detail-transcript-title"
					>
						{t("detail.tabs.transcript")}
					</h2>
					<span
						className="truncate text-sm font-normal leading-5 text-muted-foreground"
						data-testid="recording-detail-transcript-count"
					>
						{countLabel}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{capabilities.canEditSpeakers ? (
						<button
							type="button"
							className={cn(
								TRANSCRIPT_HEADER_PILL_ACTION_CLASS,
								"gap-1.5 disabled:cursor-not-allowed disabled:opacity-50",
							)}
							onClick={onOpenSpeakerSettings}
							disabled={availableSpeakerIds.length === 0}
							data-testid="recording-detail-open-speaker-settings"
						>
							{/* Keep this decorative icon aligned with the prototype while the button text remains the accessible label. */}
							<UsersRound
								className="size-4 shrink-0"
								strokeWidth={2}
								aria-hidden="true"
								data-testid="recording-detail-speaker-settings-icon"
							/>
							{t("detail.openSpeakerSettings")}
						</button>
					) : null}
					<TranscriptSearchControl
						open={searchOpen}
						query={searchQuery}
						active={Boolean(normalizedInputSearchQuery)}
						disabled={!hasTranscript}
						onOpenChange={setSearchOpen}
						onQueryChange={setSearchQuery}
						searchLabel={t("detail.transcriptSearchLabel")}
						searchPlaceholder={t("detail.transcriptSearchPlaceholder")}
						clearLabel={t("detail.transcriptSearchClear")}
					/>
					{showSpeakerFilter ? (
						<RecordingSpeakerFilterControl
							speakerIds={availableSpeakerIds}
							selectedIds={selectedSpeakerIds}
							onChange={onSelectedSpeakerIdsChange}
							labels={speakerLabels}
							title={t("detail.speakerFilterTitle")}
							presentation="menu"
						/>
					) : null}
				</div>
			</div>

			<ScrollEdgeFadeContainer
				// The transcript should read like a plain content column, so fades blend into the page shell instead of a card.
				fadeColor="background"
				className="min-h-[320px] flex-1"
				scrollClassName="px-4 pb-3 [scrollbar-width:thin]"
				contentDeps={[visibleSegments.length, normalizedSearchQuery]}
				scrollPortRef={scrollPortRef}
			>
				{visibleSegments.length === 0 ? (
					<RecordingDetailRegionEmptySlot>
						{normalizedSearchQuery ? (
							<p
								className="text-center text-sm text-muted-foreground"
								data-testid="recording-detail-transcript-search-empty"
							>
								{t("detail.emptyTranscriptSearch")}
							</p>
						) : totalSegmentsCount != null && totalSegmentsCount > 0 ? (
							<p
								className="text-center text-sm text-muted-foreground"
								data-testid="recording-detail-transcript-filter-empty"
							>
								{t("detail.emptyTranscriptFiltered")}
							</p>
						) : (
							<RecordingDetailEmptyState
								variant={isSummarizing ? "summaryGenerating" : "noTranscript"}
								compact
							/>
						)}
					</RecordingDetailRegionEmptySlot>
				) : (
					<div ref={listRef} className="flex flex-col gap-3 pb-4">
						{visibleSegments.map((segment) => {
							const isActive = segment.id === activeSegmentId
							// Non-playing transcript rows should render at full reading contrast; dimming is reserved for live playback context.
							const visualState: TranscriptPlaybackVisualState = !playing
								? "idle"
								: isActive
									? "active"
									: "dimmed"
							return (
								<div
									key={segment.id}
									role="button"
									tabIndex={0}
									data-segment-id={segment.id}
									// Keep desktop rows on a stable box model and express focus through text contrast.
									className={cn(
										getTranscriptSegmentRowClassName("desktop"),
										"transition-colors",
									)}
									onClick={() => onSegmentClick(segment)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault()
											onSegmentClick(segment)
										}
									}}
									data-testid="recording-detail-transcript-segment"
								>
									<div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium">
										<span
											className={getTranscriptSegmentTimeClassName(
												visualState,
											)}
										>
											{formatRecordingTime(segment.start)}
										</span>
										{segment.speaker ? (
											<TranscriptSpeakerChip
												speakerId={segment.speaker}
												label={
													speakerNameMap[segment.speaker] ??
													segment.speaker
												}
												visualState={visualState}
												canEdit={capabilities.canEditSpeakers}
												onOpenSpeakerSettings={onOpenSpeakerSettings}
											/>
										) : null}
									</div>
									<p
										className={getTranscriptSegmentTextClassName(
											visualState,
											"desktop",
										)}
									>
										<TranscriptHighlightedText
											text={segment.text}
											query={normalizedSearchQuery}
										/>
									</p>
								</div>
							)
						})}
					</div>
				)}
			</ScrollEdgeFadeContainer>
		</div>
	)
}

interface TranscriptSearchControlProps {
	open: boolean
	query: string
	active: boolean
	disabled: boolean
	searchLabel: string
	searchPlaceholder: string
	clearLabel: string
	onOpenChange: (open: boolean) => void
	onQueryChange: (query: string) => void
}

/** Renders a compact dropdown search that persists its active query when the menu closes. */
function TranscriptSearchControl({
	open,
	query,
	active,
	disabled,
	searchLabel,
	searchPlaceholder,
	clearLabel,
	onOpenChange,
	onQueryChange,
}: TranscriptSearchControlProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						TRANSCRIPT_HEADER_ACTION_BASE_CLASS,
						"relative size-8 rounded-full disabled:cursor-not-allowed disabled:opacity-50",
					)}
					aria-label={searchLabel}
					disabled={disabled}
					data-testid="recording-detail-open-transcript-search"
				>
					<Search className="size-4" strokeWidth={2} aria-hidden="true" />
					{active ? (
						<span
							className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background"
							data-testid="recording-detail-transcript-search-active"
						/>
					) : null}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="right"
				align="start"
				sideOffset={8}
				className="w-64 rounded-xl border-border/80 p-2"
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					inputRef.current?.focus()
				}}
				data-testid="recording-detail-transcript-search-menu"
			>
				<div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-foreground/30">
					<Search
						className="size-4 shrink-0 text-muted-foreground"
						strokeWidth={2}
						aria-hidden="true"
					/>
					<input
						ref={inputRef}
						type="search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault()
								onOpenChange(false)
							}
							event.stopPropagation()
						}}
						className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
						placeholder={searchPlaceholder}
						aria-label={searchLabel}
						data-testid="recording-detail-transcript-search-input"
					/>
					{query ? (
						<button
							type="button"
							className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							aria-label={clearLabel}
							onClick={() => onQueryChange("")}
							data-testid="recording-detail-transcript-search-clear"
						>
							<X className="size-3.5" strokeWidth={2} aria-hidden="true" />
						</button>
					) : null}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Renders all literal query matches without changing the transcript's original text. */
function TranscriptHighlightedText({ text, query }: { text: string; query: string }) {
	if (!query) return text

	return splitTranscriptTextBySearchQuery(text, query).map((part, index) =>
		part.matched ? (
			<mark
				key={`${index}-${part.text}`}
				className="rounded-sm bg-warning/25 px-0.5 text-inherit"
				data-testid="recording-detail-transcript-search-highlight"
			>
				{part.text}
			</mark>
		) : (
			part.text
		),
	)
}

import { resolveSpeakerChipStyle } from "../../utils/resolve-speaker-chip-style"

/** Renders a prototype-style speaker pill; opens settings on click when editing is allowed. */
function TranscriptSpeakerChip({
	speakerId,
	label,
	visualState,
	canEdit,
	onOpenSpeakerSettings,
}: {
	speakerId: string
	label: string
	visualState: TranscriptPlaybackVisualState
	canEdit: boolean
	onOpenSpeakerSettings: () => void
}) {
	const chipStyle = resolveSpeakerChipStyle(speakerId)
	const chipClassName = cn(
		"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 text-foreground",
		chipStyle.chip,
		getTranscriptSpeakerChipToneClassName(visualState),
		canEdit ? "transition-opacity hover:opacity-80" : undefined,
	)
	const chipContent = (
		<>
			<span className={cn("mr-1 size-1.5 shrink-0 rounded-full", chipStyle.dot)} />
			{label}
		</>
	)

	if (!canEdit) {
		return (
			<span className={chipClassName} data-testid="recording-detail-transcript-speaker-chip">
				{chipContent}
			</span>
		)
	}

	return (
		<button
			type="button"
			className={chipClassName}
			onClick={(event) => {
				event.stopPropagation()
				onOpenSpeakerSettings()
			}}
			data-testid="recording-detail-transcript-speaker-chip"
		>
			{chipContent}
		</button>
	)
}

/** Finds the segment currently playing based on the shared audio currentTime. */
function findActiveSegmentId(
	segments: RecordingTranscriptSegment[],
	currentTime: number,
): string | null {
	for (const segment of segments) {
		const end = segment.end ?? segment.start
		if (currentTime >= segment.start && currentTime < end) return segment.id
	}
	return null
}
