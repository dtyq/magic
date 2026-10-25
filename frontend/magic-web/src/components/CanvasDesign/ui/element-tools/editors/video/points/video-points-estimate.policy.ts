import type { GenerateVideoRequest } from "../../../../../public/magic-types"
import { hasVideoGenerationRequestEstimateIntent } from "../../../../../runtime/shared/videoGenerationRequestIntent"

export type VideoPointsEstimateBlockedReason =
	| "disabled"
	| "missing_request"
	| "missing_model"
	| "missing_signature"
	| "missing_estimator"
	| "missing_user_intent"
	| "pending_resource_deferrals"

export interface VideoPointsEstimateGate {
	canEstimate: boolean
	blockedReason: VideoPointsEstimateBlockedReason | null
}

interface ResolveVideoPointsEstimateGateOptions {
	enabled: boolean
	request: Partial<GenerateVideoRequest> | null
	signature: string | null
	hasEstimateVideoPoints: boolean
	hasPendingResourceDeferrals: boolean
}

export function resolveVideoPointsEstimateGate(
	options: ResolveVideoPointsEstimateGateOptions,
): VideoPointsEstimateGate {
	if (!options.enabled) return { canEstimate: false, blockedReason: "disabled" }
	if (!options.request) return { canEstimate: false, blockedReason: "missing_request" }
	if (!options.request.model_id) return { canEstimate: false, blockedReason: "missing_model" }
	if (!options.signature) return { canEstimate: false, blockedReason: "missing_signature" }
	if (!options.hasEstimateVideoPoints) {
		return { canEstimate: false, blockedReason: "missing_estimator" }
	}
	if (!hasVideoGenerationRequestEstimateIntent(options.request)) {
		return { canEstimate: false, blockedReason: "missing_user_intent" }
	}
	if (options.hasPendingResourceDeferrals) {
		return { canEstimate: false, blockedReason: "pending_resource_deferrals" }
	}
	return { canEstimate: true, blockedReason: null }
}
