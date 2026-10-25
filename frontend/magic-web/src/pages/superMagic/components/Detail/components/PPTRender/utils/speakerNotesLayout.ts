export const SPEAKER_NOTES_MIN_HEIGHT = 100
export const SPEAKER_NOTES_FALLBACK_PARENT_HEIGHT = 650
export const SPEAKER_NOTES_IN_FLOW_MAX_RATIO = 0.4
export const SPEAKER_NOTES_OVERLAY_MAX_RATIO = 0.92

export function getSpeakerNotesParentHeight(parentHeight: number) {
	return parentHeight > 0 ? parentHeight : SPEAKER_NOTES_FALLBACK_PARENT_HEIGHT
}

export function clampSpeakerNotesHeight(nextHeight: number, parentHeight: number) {
	const resolvedParentHeight = getSpeakerNotesParentHeight(parentHeight)
	return Math.max(
		SPEAKER_NOTES_MIN_HEIGHT,
		Math.min(nextHeight, resolvedParentHeight * SPEAKER_NOTES_OVERLAY_MAX_RATIO),
	)
}

export function getSpeakerNotesInFlowHeight(height: number, parentHeight: number) {
	return Math.min(
		height,
		getSpeakerNotesParentHeight(parentHeight) * SPEAKER_NOTES_IN_FLOW_MAX_RATIO,
	)
}

export function isSpeakerNotesOverlay(height: number, parentHeight: number) {
	return height > getSpeakerNotesParentHeight(parentHeight) * SPEAKER_NOTES_IN_FLOW_MAX_RATIO
}
