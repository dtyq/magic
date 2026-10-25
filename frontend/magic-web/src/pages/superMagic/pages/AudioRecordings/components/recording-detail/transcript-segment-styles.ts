import { cn } from "@/utils/cn"

type TranscriptSegmentDensity = "desktop" | "mobile"
export type TranscriptPlaybackVisualState = "idle" | "active" | "dimmed"

/** Keeps transcript rows on a fixed box model so playback highlighting never shifts surrounding content. */
export function getTranscriptSegmentRowClassName(density: TranscriptSegmentDensity) {
	return cn(
		"rounded-xl text-left",
		// Desktop rows intentionally stay airy and borderless to match the latest PC prototype transcript column.
		density === "desktop" ? "cursor-pointer px-2 py-2.5" : "px-3 py-2",
	)
}

/** Keeps non-playing transcript rows readable and reserves dimming for live playback context only. */
export function getTranscriptSegmentTimeClassName(state: TranscriptPlaybackVisualState) {
	return cn(
		"shrink-0 tabular-nums transition-colors",
		state === "dimmed" ? "text-foreground/35" : "text-foreground",
	)
}

/** Uses dimming only during playback so paused transcripts keep the prototype's normal reading baseline. */
export function getTranscriptSegmentTextClassName(
	state: TranscriptPlaybackVisualState,
	density: TranscriptSegmentDensity,
) {
	return cn(
		density === "desktop" ? "whitespace-pre-wrap text-sm leading-6" : "text-[16px] leading-6",
		"transition-colors",
		state === "dimmed" ? "text-foreground/65" : "text-foreground",
	)
}

/** Speaker chips stay fully readable while idle and only soften on non-active rows during playback. */
export function getTranscriptSpeakerChipToneClassName(state: TranscriptPlaybackVisualState) {
	return cn("transition-opacity", state === "dimmed" && "opacity-70")
}
