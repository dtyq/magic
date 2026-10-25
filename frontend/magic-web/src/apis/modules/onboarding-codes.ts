/**
 * The onboarding endpoint's *values*: its business codes, and the predicates that read a failed
 * request apart.
 *
 * Split out of `onboarding.ts` deliberately. The guide engine re-exports these to components that
 * want nothing from this feature except a string or a branch — `SlidesTemplateCanvasItemsLayer` is
 * the clearest case, it imports an anchor constant and nothing else. Whatever is reachable from a
 * module ends up in that component's module graph, and `onboarding.ts` pulls in the HTTP client:
 * a canvas that only needs a constant was paying for a network stack, which showed up as a minute
 * of extra collection time on every test that touched it.
 *
 * So: this file imports **nothing**. The client-facing calls stay in `onboarding.ts`, which
 * re-exports everything below so callers that expect one module keep working.
 */

/** Business codes, as documented. Success is handled by the client; the rest are branch points. */
export const ONBOARDING_RESPONSE_CODE = {
	SUCCESS: 1000,
	/** Missing/invalid `Authorization`. Handled globally by the auth interceptor. */
	AUTH_TOKEN_MISSING: 2179,
	/** Not a personal organization or not a SaaS commercial deployment: the feature does not exist. */
	ORGANIZATION_UNSUPPORTED: 9300,
	/** Feature switch off: the feature does not exist here either. */
	FEATURE_DISABLED: 9301,
	/** The task code is unknown to this deployment. */
	TASK_NOT_FOUND: 9302,
	/** The task is completed by a system event, never by this call. */
	TASK_NOT_MANUALLY_COMPLETABLE: 9303,
	/** Past `expires_at`: the task can no longer be completed. */
	TASK_EXPIRED: 9304,
	/** Server-side progress data is corrupt. Retrying is pointless; the user needs support. */
	PROGRESS_BROKEN: 9305,
	/** Granting the points failed. The task stays completed-but-ungranted and may be retried. */
	REWARD_GRANT_FAILED: 9306,
	/** Concurrent request. May be retried. */
	TOO_FREQUENT: 9307,
} as const

/**
 * The codes that mean "this deployment simply does not offer the feature". They are not errors to
 * report: the surface is expected to disappear, and nothing should be shown or logged as a failure.
 */
export function isOnboardingUnsupportedCode(code: number | null) {
	return (
		code === ONBOARDING_RESPONSE_CODE.ORGANIZATION_UNSUPPORTED ||
		code === ONBOARDING_RESPONSE_CODE.FEATURE_DISABLED
	)
}

/**
 * The codes worth asking the user to try again. Everything else is either final (expired, unknown
 * task) or needs support (`9305`), and retrying those only wastes the user's patience.
 */
export function isOnboardingRetryableCode(code: number | null) {
	return (
		code === ONBOARDING_RESPONSE_CODE.REWARD_GRANT_FAILED ||
		code === ONBOARDING_RESPONSE_CODE.TOO_FREQUENT
	)
}

/**
 * Pull the business code out of whatever a rejected request produced. The app client throws the raw
 * envelope (`{ code, message, data }`); transport-level failures throw an `Error`, sometimes with
 * the envelope attached — both end up as "no code", which callers treat as a network failure.
 */
export function readOnboardingErrorCode(error: unknown): number | null {
	if (!error || typeof error !== "object") return null
	const direct = (error as { code?: unknown }).code
	if (typeof direct === "number") return direct
	const nested = (error as { response?: { code?: unknown } }).response?.code
	return typeof nested === "number" ? nested : null
}

/**
 * The backend's own message, when it sent one.
 *
 * **Diagnostics only — never render this.** The contract states the endpoint does no language
 * negotiation, so `message` is a single language chosen by the deployment; putting it on screen
 * would drop a Chinese sentence into an English UI. User-facing copy comes from our own locale
 * files, keyed off the business code instead.
 */
export function readOnboardingErrorMessage(error: unknown): string | null {
	if (!error || typeof error !== "object") return null
	const direct = (error as { message?: unknown }).message
	if (typeof direct === "string" && direct) return direct
	const nested = (error as { response?: { message?: unknown } }).response?.message
	return typeof nested === "string" && nested ? nested : null
}
