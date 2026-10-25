import type { RefObject } from "react"
import { cn } from "@/utils/cn"
import type { FlatColorSegment } from "@/pages/superMagic/pages/AudioRecordings/utils/chapter-color-segments"
import { RecordingDetailAudioBar } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/player"
import { MOBILE_RECORDING_PLAYER_BOTTOM } from "../utils/mobile-recording-player-layout"

interface MobileRecordingAudioPlayerProps {
	audioRef: RefObject<HTMLAudioElement>
	audioUrl: string
	currentSec: number
	duration: number
	playing: boolean
	expanded: boolean
	playbackRate?: number
	colorSegments?: FlatColorSegment[]
	scrollSignal?: number
	onToggle: () => void
	onSeek: (seconds: number) => void
	onExpandedChange: (expanded: boolean) => void
	onPlaybackRateChange?: (rate: number) => void
	hidden?: boolean
}

/** Mobile fixed-bottom shell around the shared recording detail audio bar. */
export function MobileRecordingAudioPlayer({
	audioRef,
	audioUrl,
	currentSec,
	duration,
	playing,
	expanded,
	playbackRate = 1,
	colorSegments,
	scrollSignal = 0,
	onToggle,
	onSeek,
	onExpandedChange,
	onPlaybackRateChange,
	hidden = false,
}: MobileRecordingAudioPlayerProps) {
	if (!audioUrl) return null

	return (
		<div
			// Keep a 24px CSS fallback for browsers that cannot evaluate env(), then let the inline rule use the real safe area.
			className={cn("fixed inset-x-3 bottom-6 z-20", hidden && "hidden")}
			style={{ bottom: MOBILE_RECORDING_PLAYER_BOTTOM }}
			data-testid="mobile-recording-audio-player"
			aria-hidden={hidden}
		>
			<RecordingDetailAudioBar
				audioRef={audioRef}
				audioUrl={audioUrl}
				durationSec={duration}
				currentSec={currentSec}
				playing={playing}
				expanded={expanded}
				rate={playbackRate}
				colorSegments={colorSegments}
				chrome="shadow"
				scrollSignal={scrollSignal}
				onExpandedChange={onExpandedChange}
				onTogglePlay={onToggle}
				onSeek={onSeek}
				onPlaybackRateChange={(rate) => onPlaybackRateChange?.(rate)}
			/>
		</div>
	)
}
