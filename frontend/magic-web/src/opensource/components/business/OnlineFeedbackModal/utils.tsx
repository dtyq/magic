import type { OnlineFeedbackModalType } from "./types"

export const OnlineFeedbackModalContainerId = "online-feedback-modal-container"

/**
 * No-op for opensource build. Full impl in enterprise overlay.
 */
export function showOnlineFeedbackModal(_options?: {
	defaultValue?: string
	type?: OnlineFeedbackModalType
	details?: unknown
}): Promise<null> {
	return Promise.resolve(null)
}
