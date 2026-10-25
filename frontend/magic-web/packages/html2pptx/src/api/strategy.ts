import type { MediaPolicy } from "./options"

export type ResolvedMediaPolicyMode = Exclude<NonNullable<MediaPolicy["mode"]>, "auto">

export interface ResolveMediaPolicyModeOptions {
	/** A two-pass SlideIR/font/auto-size flow must be able to reopen media after collection. */
	requiresReplay?: boolean
	/** The host knows that at least one URL may expire before replay. */
	hasExpiringUrls?: boolean
}

/** Resolve `auto` once before the export starts so preflight and the runner use one policy. */
export function resolveStreamingMediaPolicyMode(
	policy: MediaPolicy | undefined,
	options: ResolveMediaPolicyModeOptions = {},
): ResolvedMediaPolicyMode {
	const requested = policy?.mode
	if (requested && requested !== "auto") return requested
	if (options.requiresReplay || options.hasExpiringUrls) return "rolling-stage"
	return "direct-stream"
}
