import {
	getMobileRecordingPlayerBottomClearance,
	MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT,
	MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT,
} from "@/pages/superMagicMobile/pages/AudioRecordingDetail/utils/mobile-recording-player-layout"

export const MOBILE_AUDIO_SHARE_CREATED_BY_BADGE_BOTTOM =
	"calc(max(24px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) + 40px + 12px)"

/** Lifts the share brand badge above the mobile audio player only for the readonly audio share shell. */
export function resolveMobileAudioShareCreatedByBadgeBottom(params: {
	defaultBottom: string
	isMobile: boolean
	shouldRenderAudioShareShell: boolean
	playerExpanded?: boolean
}): string {
	const { defaultBottom, isMobile, shouldRenderAudioShareShell, playerExpanded = false } = params

	if (!shouldRenderAudioShareShell || !isMobile) {
		return defaultBottom
	}

	return getMobileRecordingPlayerBottomClearance(
		playerExpanded
			? MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT
			: MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT,
	)
}
