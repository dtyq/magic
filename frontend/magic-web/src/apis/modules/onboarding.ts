/**
 * New-user-benefits ("新手引导奖励") backend contract.
 *
 * Lives next to the guide engine it serves — the card, the reward list and the completion call are
 * one feature, so these endpoints sit with their only caller instead of in a generic api bucket.
 * See the backend's 《前端接口对接文档》 for the wire contract.
 *
 * Two things about this API shape the code below:
 *
 * 1. **HTTP status is always 200.** Success and failure are both `200`; the verdict is the business
 *    `code` in the envelope (`1000` = ok). The shared client already throws on any non-`1000` code
 *    and throws the *envelope itself* rather than an `Error`, so a caller reads `error.code`. The
 *    helper below tolerates both that shape and an `Error` carrying the envelope on `.response`
 *    (the iframe client's shape), because nothing guarantees which client serves this endpoint.
 * 2. **Failure modes are all business codes**, so every caller has to branch on them: `9300`/`9301`
 *    mean "this organization/deployment does not have the feature" and must hide the surface
 *    silently, while `9306`/`9307` are "try again" and must keep the task unfinished.
 *
 * Only the two HTTP calls and the wire types live here. The codes and the helpers that read a
 * failure apart are in `./onboarding-codes`, which imports nothing — see its header for why that
 * split matters. Importing *this* module is what pulls in an HTTP client.
 */
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"

export const ONBOARDING_API_BASE = "/api/v1/onboarding"

/** Task lifecycle as the backend reports it. Only `COMPLETED` means the user finished the task. */
export type OnboardingTaskStatusCode = "PENDING" | "COMPLETED" | "EXPIRED"

/** Where the reward for a completed task stands. Only meaningful once `status` is `COMPLETED`. */
export type OnboardingRewardStatus = "PENDING" | "GRANTED" | "FAILED"

/** Audience segment assigned by the onboarding backend for operational analysis. */
export type OnboardingParticipantType = "new_register" | "registered_unused"

export interface OnboardingTask {
	/** Backend task code. The mapping onto this client's guided flows lives beside the guide engine. */
	code: string
	/** Points a completion pays. */
	points: number
	/** How long the task stays claimable, counted from the moment the user's progress was created. */
	validity_days: number
	status: OnboardingTaskStatusCode
	reward_status: OnboardingRewardStatus
	completed_at: string | null
	reward_granted_at: string | null
	/** ISO 8601 UTC — the client converts to local time when it has to show a deadline. */
	expires_at: string
}

export interface OnboardingTaskListData {
	/** Backend-owned audience classification; the client forwards it without re-deriving it. */
	participant_type: OnboardingParticipantType
	/**
	 * Display order, decided by backend configuration. A user whose progress predates a task keeps
	 * the shorter list, so this is authoritative for both order and count.
	 */
	tasks: OnboardingTask[]
}

export interface OnboardingCompletionData {
	/** Points actually granted by this call. Repeated calls are idempotent and pay the same amount. */
	points: number
}

/*
 * The codes and the failure-reading helpers live in `./onboarding-codes`, which imports nothing.
 * Re-exported here so this module stays the single import a caller needs.
 */
export * from "./onboarding-codes"

/**
 * The user's reward list. `enableErrorMessagePrompt` is off on purpose: a failure here is the
 * caller's to interpret — `9300`/`9301` hide the card, anything else retries or stays quiet — and
 * the generic toast would report a hidden feature as an error.
 */
export function getOnboardingTasks() {
	return magicClient.get<OnboardingTaskListData>(`${ONBOARDING_API_BASE}/tasks`, {
		enableErrorMessagePrompt: false,
	})
}

/**
 * Complete a task and claim its points in one call. Idempotent server-side, and deliberately silent
 * on failure so the caller can decide whether to offer a retry instead of promising one.
 */
export function completeOnboardingTask(taskCode: string) {
	return magicClient.put<OnboardingCompletionData>(
		`${ONBOARDING_API_BASE}/tasks/${encodeURIComponent(taskCode)}/completion`,
		undefined,
		{ enableErrorMessagePrompt: false },
	)
}
