import { useMemo, useState, type CSSProperties, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { cn } from "@/utils/cn"
import { RecordingSpeakerFilterControl } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingSpeakerFilterControl"
import { RecordingDetailRegionEmptySlot } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailRegionEmptySlot"
import {
	getTranscriptSegmentRowClassName,
	type TranscriptPlaybackVisualState,
	getTranscriptSegmentTextClassName,
	getTranscriptSegmentTimeClassName,
	getTranscriptSpeakerChipToneClassName,
} from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/transcript-segment-styles"
import { filterTranscriptSegmentsBySpeakerIds } from "@/pages/superMagic/pages/AudioRecordings/utils/speaker-filter"
import type { MobileRecordingSourceTab, RecordingTranscriptSegment } from "../types"
import { parseTranscriptMarkdown } from "../utils/transcript-parser"
import { formatRecordingTime } from "../utils/time"
import { MobileRecordingMarkdownContent } from "./MobileRecordingMarkdownContent"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"

interface MobileRecordingSourcePanelProps {
	transcriptContent?: string
	notesContent?: string
	playing: boolean
	currentTime: number
	scrollPaddingBottom: CSSProperties["paddingBottom"]
	availableSpeakerIds?: string[]
	selectedSpeakerIds?: string[]
	speakerNameMap: Record<string, string>
	onSelectedSpeakerIdsChange?: (speakerIds: string[]) => void
	onOpenSpeakerSettings: () => void
	onSeek: (seconds: number) => void
	onContentScroll?: () => void
	attachmentTree?: AttachmentFile[]
	notesFilePath?: string
	searchScopeRef?: RefObject<HTMLDivElement | null>
	onActiveTabChange?: (tab: MobileRecordingSourceTab) => void
	isGenerating?: boolean
	/** Allows embedded previews to provide one outer tab row instead of this source switcher. */
	showTabBar?: boolean
	/** Hides notes in readonly shares when the notes file was not included in the share. */
	showNotesTab?: boolean
	activeTab?: MobileRecordingSourceTab
}

/** Shows completed source attachments: transcript timeline and readonly notes markdown. */
export function MobileRecordingSourcePanel({
	transcriptContent,
	notesContent,
	playing,
	currentTime,
	scrollPaddingBottom,
	availableSpeakerIds,
	selectedSpeakerIds,
	speakerNameMap,
	onSelectedSpeakerIdsChange,
	onOpenSpeakerSettings,
	onSeek,
	onContentScroll,
	attachmentTree = [],
	notesFilePath,
	searchScopeRef,
	onActiveTabChange,
	isGenerating = false,
	showTabBar = true,
	showNotesTab = true,
	activeTab: controlledActiveTab,
}: MobileRecordingSourcePanelProps) {
	const { t } = useTranslation("audioRecordings")
	const [activeTab, setActiveTab] = useState<MobileRecordingSourceTab>("transcript")
	const requestedActiveTab = controlledActiveTab ?? activeTab
	const resolvedActiveTab =
		showNotesTab || requestedActiveTab !== "notes" ? requestedActiveTab : "transcript"
	const segments = useMemo(
		() => parseTranscriptMarkdown(transcriptContent ?? ""),
		[transcriptContent],
	)
	const visibleSegments = useMemo(
		() =>
			selectedSpeakerIds
				? filterTranscriptSegmentsBySpeakerIds(segments, selectedSpeakerIds)
				: segments,
		[segments, selectedSpeakerIds],
	)
	const hasTranscriptContent = segments.length > 0
	const hasNotesContent = Boolean(notesContent?.trim())
	const activeTabHasContent =
		resolvedActiveTab === "transcript" ? hasTranscriptContent : hasNotesContent
	const speakerLabels = useMemo(
		() =>
			Object.fromEntries(
				(availableSpeakerIds ?? []).map((speakerId) => [
					speakerId,
					speakerNameMap[speakerId] ?? speakerId,
				]),
			),
		[availableSpeakerIds, speakerNameMap],
	)

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="mobile-recording-source-panel">
			{/* Keep the source switcher height stable when the transcript-only speaker filter appears. */}
			{showTabBar ? (
				<div className="sticky top-0 z-10 flex min-h-[68px] items-center gap-2 bg-[#f7f7f8] px-4 py-3">
					<div className="flex min-w-0 flex-1">
						<SourceTabButton
							active={resolvedActiveTab === "transcript"}
							label={t("detail.tabs.transcript")}
							onClick={() => {
								setActiveTab("transcript")
								onActiveTabChange?.("transcript")
							}}
						/>
						{showNotesTab ? (
							<SourceTabButton
								active={resolvedActiveTab === "notes"}
								label={t("detail.tabs.notes")}
								onClick={() => {
									setActiveTab("notes")
									onActiveTabChange?.("notes")
								}}
							/>
						) : null}
					</div>
					{resolvedActiveTab === "transcript" &&
					availableSpeakerIds &&
					selectedSpeakerIds &&
					onSelectedSpeakerIdsChange ? (
						<RecordingSpeakerFilterControl
							speakerIds={availableSpeakerIds}
							selectedIds={selectedSpeakerIds}
							onChange={onSelectedSpeakerIdsChange}
							labels={speakerLabels}
							title={t("detail.speakerFilterTitle")}
							presentation="sheet"
						/>
					) : null}
				</div>
			) : null}

			{/* 来源正文统一收敛为唯一滚动口，避免外层 main 与内层内容区同时滚动导致阴影错位。 */}
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				scrollClassName="px-4"
				contentDeps={[resolvedActiveTab, segments.length, hasNotesContent]}
				onScroll={onContentScroll}
			>
				<div
					ref={searchScopeRef}
					data-search-scope="mobile-recording-source"
					className={cn(
						"flex min-h-full flex-col",
						// Keep both source tabs on the same height chain so their empty states
						// center within the exact same viewport above the floating player.
						!activeTabHasContent && "flex-1",
					)}
					style={{ paddingBottom: scrollPaddingBottom }}
				>
					{resolvedActiveTab === "transcript" ? (
						<TranscriptList
							segments={visibleSegments}
							playing={playing}
							currentTime={currentTime}
							speakerNameMap={speakerNameMap}
							emptyText={
								hasTranscriptContent
									? t("detail.emptyTranscriptFiltered")
									: isGenerating
										? t("detail.summarizingHint")
										: t("detail.emptySummary")
							}
							onOpenSpeakerSettings={onOpenSpeakerSettings}
							onSeek={onSeek}
						/>
					) : hasNotesContent ? (
						<div className="pb-8">
							<MobileRecordingMarkdownContent
								content={notesContent ?? ""}
								className="px-3"
								layout="mobile"
								speakerNameMap={speakerNameMap}
								onSpeakerClick={onOpenSpeakerSettings}
								onTimeClick={onSeek}
								attachments={attachmentTree}
								relativeFilePath={notesFilePath}
							/>
						</div>
					) : (
						// Reuse the shared detail empty-slot wrapper so the notes empty state
						// stays centered within the same source viewport as the transcript tab.
						<RecordingDetailRegionEmptySlot>
							<p className="text-center text-sm text-muted-foreground">
								{isGenerating
									? t("detail.summarizingHint")
									: t("detail.emptySummary")}
							</p>
						</RecordingDetailRegionEmptySlot>
					)}
				</div>
			</ScrollEdgeFadeContainer>
		</div>
	)
}

/** Segmented source tab button that mirrors the prototype's compact second-level tabs. */
function SourceTabButton({
	active,
	label,
	onClick,
}: {
	active: boolean
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			className={cn(
				"inline-flex h-8 shrink-0 items-center rounded-full px-5 text-[14px] font-medium leading-none transition-colors",
				active
					? "bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
					: "text-muted-foreground",
			)}
			onClick={onClick}
		>
			{label}
		</button>
	)
}

/** Renders transcript segments and highlights the row matching the current playback time. */
function TranscriptList({
	segments,
	playing,
	currentTime,
	speakerNameMap,
	emptyText,
	onOpenSpeakerSettings,
	onSeek,
}: {
	segments: RecordingTranscriptSegment[]
	playing: boolean
	currentTime: number
	speakerNameMap: Record<string, string>
	emptyText: string
	onOpenSpeakerSettings: () => void
	onSeek: (seconds: number) => void
}) {
	const { t } = useTranslation("audioRecordings")

	if (segments.length === 0) {
		// The transcript tab shares the same full-height centering behavior as the notes tab
		// so empty source pages align with the detail prototype's visual balance.
		return (
			<RecordingDetailRegionEmptySlot>
				<p className="text-center text-sm text-muted-foreground">{emptyText}</p>
			</RecordingDetailRegionEmptySlot>
		)
	}

	return (
		<div className="flex flex-col gap-3">
			{segments.map((segment) => {
				const active =
					playing &&
					currentTime >= segment.start &&
					(segment.end == null || currentTime < segment.end)
				const visualState: TranscriptPlaybackVisualState = !playing
					? "idle"
					: active
						? "active"
						: "dimmed"
				// Use a keyboard-accessible div instead of a button so the nested speaker action
				// can remain interactive without triggering invalid button-in-button DOM.
				const handleSeek = () => onSeek(segment.start)

				return (
					<div
						key={segment.id}
						role="button"
						tabIndex={0}
						// Keep every row on the same box model so playback focus never shifts the list alignment.
						className={cn(
							getTranscriptSegmentRowClassName("mobile"),
							"transition-colors active:bg-muted/35",
						)}
						onClick={handleSeek}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								handleSeek()
							}
						}}
						data-testid="mobile-recording-transcript-item"
					>
						<div className="mb-2 flex items-center gap-2 text-[12px] font-medium">
							<span className={getTranscriptSegmentTimeClassName(visualState)}>
								{formatRecordingTime(segment.start)}
							</span>
							{segment.speaker ? (
								<button
									type="button"
									// Highlight the current sentence through chip contrast instead of inserting a new card.
									className={cn(
										"inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[12px] leading-4 text-foreground active:opacity-70",
										getTranscriptSpeakerChipToneClassName(visualState),
									)}
									onClick={(event) => {
										event.stopPropagation()
										onOpenSpeakerSettings()
									}}
									aria-label={t("detail.openSpeakerSettings")}
								>
									<span className="mr-1 size-1.5 rounded-full bg-blue-500" />
									{speakerNameMap[segment.speaker] ?? segment.speaker}
								</button>
							) : null}
						</div>
						<p className={getTranscriptSegmentTextClassName(visualState, "mobile")}>
							{segment.text}
						</p>
					</div>
				)
			})}
		</div>
	)
}
