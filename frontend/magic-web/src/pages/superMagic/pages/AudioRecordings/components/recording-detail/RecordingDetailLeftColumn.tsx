import { useMemo } from "react"
import type { RefObject } from "react"
import type { FlatColorSegment } from "../../utils/chapter-color-segments"
import { filterTranscriptSegmentsBySpeakerIds } from "../../utils/speaker-filter"
import { parseTranscriptMarkdown } from "../../utils/transcript-parser"
import type { RecordingTranscriptSegment } from "../../types/recording-detail"
import { RecordingDetailAudioPlayer } from "./RecordingDetailAudioPlayer"
import { RecordingDetailTranscriptPanel } from "./RecordingDetailTranscriptPanel"

interface RecordingDetailLeftColumnProps {
	searchScopeKey: string
	audioRef: RefObject<HTMLAudioElement>
	audioUrl: string
	transcriptMarkdown?: string
	currentSec: number
	currentTime: number
	duration: number
	playing: boolean
	expanded: boolean
	playbackRate: number
	colorSegments?: FlatColorSegment[]
	speakerNameMap: Record<string, string>
	selectedSpeakerIds: string[]
	onSelectedSpeakerIdsChange: (speakerIds: string[]) => void
	showSpeakerFilter?: boolean
	onToggle: () => void
	onSeek: (seconds: number) => void
	onPlaySegment: (segment: RecordingTranscriptSegment) => void
	onExpandedChange: (expanded: boolean) => void
	onPlaybackRateChange: (rate: number) => void
	onOpenSpeakerSettings: () => void
	isSummarizing?: boolean
}

/** Left workbench column combining inline player and transcript list. */
export function RecordingDetailLeftColumn({
	searchScopeKey,
	audioRef,
	audioUrl,
	transcriptMarkdown,
	currentSec,
	currentTime,
	duration,
	playing,
	expanded,
	playbackRate,
	colorSegments,
	speakerNameMap,
	selectedSpeakerIds,
	onSelectedSpeakerIdsChange,
	showSpeakerFilter = true,
	onToggle,
	onSeek,
	onPlaySegment,
	onExpandedChange,
	onPlaybackRateChange,
	onOpenSpeakerSettings,
	isSummarizing = false,
}: RecordingDetailLeftColumnProps) {
	const segments = useMemo(
		() => (transcriptMarkdown ? parseTranscriptMarkdown(transcriptMarkdown) : []),
		[transcriptMarkdown],
	)
	const availableSpeakerIds = useMemo(
		() =>
			Array.from(
				new Set(segments.flatMap((segment) => (segment.speaker ? [segment.speaker] : []))),
			),
		[segments],
	)
	const visibleSegments = useMemo(
		() => filterTranscriptSegmentsBySpeakerIds(segments, selectedSpeakerIds),
		[segments, selectedSpeakerIds],
	)

	return (
		<div className="flex h-full min-h-0 flex-col gap-4">
			<RecordingDetailAudioPlayer
				audioRef={audioRef}
				audioUrl={audioUrl}
				currentSec={currentSec}
				duration={duration}
				playing={playing}
				expanded={expanded}
				playbackRate={playbackRate}
				colorSegments={colorSegments}
				onToggle={onToggle}
				onSeek={onSeek}
				onExpandedChange={onExpandedChange}
				onPlaybackRateChange={onPlaybackRateChange}
			/>
			<RecordingDetailTranscriptPanel
				searchScopeKey={searchScopeKey}
				segments={visibleSegments}
				availableSpeakerIds={availableSpeakerIds}
				playing={playing}
				currentTime={currentTime}
				selectedSpeakerIds={selectedSpeakerIds}
				speakerNameMap={speakerNameMap}
				showSpeakerFilter={showSpeakerFilter}
				totalSegmentsCount={segments.length}
				onSegmentClick={(segment) =>
					onPlaySegment({
						...segment,
					})
				}
				onSelectedSpeakerIdsChange={onSelectedSpeakerIdsChange}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				isSummarizing={isSummarizing}
			/>
		</div>
	)
}
