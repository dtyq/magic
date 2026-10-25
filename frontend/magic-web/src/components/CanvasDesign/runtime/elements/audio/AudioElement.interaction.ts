import {
	ELEMENT_CONTROL_INTERACTION_LIMITS,
	canInteractWithElementControls,
} from "../../interaction/element-control/ElementControlInteractionPolicy"
import type { ElementControlInteractionPolicy } from "../../interaction/element-control/ElementControlInteractionPolicy"

export type AudioControlInteractionMode = "full" | "compact"

export type AudioControlAction =
	| { type: "toggle-playback" }
	| { type: "seek-backward" }
	| { type: "seek-forward" }
	| { type: "seek-progress" }
	| { type: "scrub-progress" }

export type AudioElementControlInteractionPolicy =
	ElementControlInteractionPolicy<AudioControlAction>

export const AUDIO_CONTROL_INTERACTION = {
	desktop: {
		compactMinWidth: ELEMENT_CONTROL_INTERACTION_LIMITS.desktop.minWidth,
		compactMinHeight: ELEMENT_CONTROL_INTERACTION_LIMITS.desktop.minHeight,
		fullMinWidth: 320,
		fullMinHeight: 180,
		compactProgressHitHeight: 16,
	},
	coarsePointer: {
		compactMinWidth: ELEMENT_CONTROL_INTERACTION_LIMITS.coarsePointer.minWidth,
		compactMinHeight: ELEMENT_CONTROL_INTERACTION_LIMITS.coarsePointer.minHeight,
		fullMinWidth: 400,
		fullMinHeight: 240,
		compactProgressHitHeight: 24,
	},
} as const

export interface AudioControlInteractionPolicy {
	mode: AudioControlInteractionMode
	controlsEnabled: boolean
	progressMinimumScreenHeight: number
}

/** 根据元素最终屏幕尺寸决定内部播放器与元素拖动之间的交互优先级。 */
export function resolveAudioControlInteractionPolicy(options: {
	screenWidth: number
	screenHeight: number
	coarsePointer: boolean
}): AudioControlInteractionPolicy {
	const config = options.coarsePointer
		? AUDIO_CONTROL_INTERACTION.coarsePointer
		: AUDIO_CONTROL_INTERACTION.desktop
	const screenWidth = Math.max(0, options.screenWidth)
	const screenHeight = Math.max(0, options.screenHeight)

	if (screenWidth < config.compactMinWidth || screenHeight < config.compactMinHeight) {
		return {
			mode: "compact",
			controlsEnabled: canInteractWithElementControls({
				screenWidth,
				screenHeight,
				coarsePointer: options.coarsePointer,
			}),
			progressMinimumScreenHeight: config.compactProgressHitHeight,
		}
	}

	if (screenWidth < config.fullMinWidth || screenHeight < config.fullMinHeight) {
		return {
			mode: "compact",
			controlsEnabled: true,
			progressMinimumScreenHeight: config.compactProgressHitHeight,
		}
	}

	return {
		mode: "full",
		controlsEnabled: true,
		progressMinimumScreenHeight: options.coarsePointer ? 44 : 32,
	}
}
