import type { RefObject } from "react"
import type { FlatColorSegment } from "../../utils/chapter-color-segments"
import { RecordingDetailAudioBar } from "./player"
import { RecordingDetailEmptyState } from "./RecordingDetailEmptyState"

interface RecordingDetailAudioPlayerProps {
	audioRef: RefObject<HTMLAudioElement>
	audioUrl: string
	currentSec: number
	duration: number
	playing: boolean
	expanded: boolean
	playbackRate: number
	colorSegments?: FlatColorSegment[]
	onToggle: () => void
	onSeek: (seconds: number) => void
	onExpandedChange: (expanded: boolean) => void
	onPlaybackRateChange: (rate: number) => void
}

/** PC inline shell around the shared recording detail audio bar. */
export function RecordingDetailAudioPlayer({
	audioRef,
	audioUrl,
	currentSec,
	duration,
	playing,
	expanded,
	playbackRate,
	colorSegments,
	onToggle,
	onSeek,
	onExpandedChange,
	onPlaybackRateChange,
}: RecordingDetailAudioPlayerProps) {
	if (!audioUrl) {
		return (
			<div className="rounded-2xl border border-border bg-card p-4">
				<RecordingDetailEmptyState variant="noAudio" compact />
			</div>
		)
	}

	return (
		<div data-testid="recording-detail-audio-player">
			<RecordingDetailAudioBar
				audioRef={audioRef}
				audioUrl={audioUrl}
				durationSec={duration}
				currentSec={currentSec}
				playing={playing}
				expanded={expanded}
				rate={playbackRate}
				colorSegments={colorSegments}
				chrome="outlined"
				collapsedTransportControls
				rateMenuPlacement="down"
				onExpandedChange={onExpandedChange}
				onTogglePlay={onToggle}
				onSeek={onSeek}
				onPlaybackRateChange={onPlaybackRateChange}
			/>
		</div>
	)
}
