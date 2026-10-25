import type { AssetComplianceResponse } from "@/apis"
import type {
	CanvasAssetComplianceState,
	CanvasAssetComplianceStatus,
} from "../../../public/magic-types"
import { assetDetailStore } from "./AssetDetailStore"

export interface CanvasAssetComplianceStatusSource {
	assetCompliancePollingManager?: {
		getState: (assetId: string) => CanvasAssetComplianceState | undefined
	}
	assetResourceManager?: {
		getCachedResource: (assetId: string) =>
			| {
					complianceStatus?: CanvasAssetComplianceStatus | null
					complianceFailedReason?: string | null
			  }
			| undefined
	}
}

export interface MediaComplianceContentLike {
	assetId?: string
	complianceStatus?: CanvasAssetComplianceStatus | null
	complianceFailedReason?: string | null
}

export function getMediaAssetId(
	content: MediaComplianceContentLike | undefined,
): string | undefined {
	const assetId = content?.assetId?.trim()
	return assetId || undefined
}

/**
 * Runtime status is authoritative for asset-backed media because the Canvas
 * DSL deliberately does not persist compliance state for existing assets.
 */
export function resolveMediaComplianceStatus(
	canvas: CanvasAssetComplianceStatusSource,
	content: MediaComplianceContentLike | undefined,
): CanvasAssetComplianceStatus | undefined {
	const assetId = getMediaAssetId(content)
	if (!assetId) return content?.complianceStatus ?? undefined

	const pollingStatus = canvas.assetCompliancePollingManager?.getState(assetId)?.status
	if (pollingStatus) return pollingStatus

	const cachedStatus = canvas.assetResourceManager?.getCachedResource(assetId)?.complianceStatus
	if (cachedStatus) return cachedStatus

	const detailStatus = assetDetailStore.getCached(assetId)?.compliance_status
	if (detailStatus !== undefined && detailStatus !== null) {
		return normalizeAssetComplianceStatus(detailStatus)
	}

	return content?.complianceStatus ?? undefined
}

function normalizeComplianceFailedReason(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const reason = value.trim()
	return reason || undefined
}

/**
 * Resolve the latest failure message using the same source precedence as the
 * status resolver. The caller still gates this value on `FAILED`, so a stale
 * reason cannot be shown while a newer PROCESSING/PASS state is active.
 */
export function resolveMediaComplianceFailedReason(
	canvas: CanvasAssetComplianceStatusSource,
	content: MediaComplianceContentLike | undefined,
): string | undefined {
	const assetId = getMediaAssetId(content)
	if (!assetId) return normalizeComplianceFailedReason(content?.complianceFailedReason)

	const pollingReason = canvas.assetCompliancePollingManager?.getState(assetId)?.failedReason
	const normalizedPollingReason = normalizeComplianceFailedReason(pollingReason)
	if (normalizedPollingReason) return normalizedPollingReason

	const cachedReason =
		canvas.assetResourceManager?.getCachedResource(assetId)?.complianceFailedReason
	const normalizedCachedReason = normalizeComplianceFailedReason(cachedReason)
	if (normalizedCachedReason) return normalizedCachedReason

	const detailReason = assetDetailStore.getCached(assetId)?.compliance_failed_reason
	const normalizedDetailReason = normalizeComplianceFailedReason(detailReason)
	if (normalizedDetailReason) return normalizedDetailReason

	return normalizeComplianceFailedReason(content?.complianceFailedReason)
}

export function normalizeAssetComplianceStatus(value: unknown): CanvasAssetComplianceStatus {
	if (value === "PROCESSING") return "PROCESSING"
	if (value === "PASS" || value === "PASSED") return "PASS"
	if (value === "FAILED") return "FAILED"
	return "UNVERIFIED"
}

export function toCanvasAssetComplianceState(
	response: AssetComplianceResponse,
): CanvasAssetComplianceState {
	return {
		assetId: response.asset_id,
		status: normalizeAssetComplianceStatus(response.compliance_status),
		failedReason: response.compliance_failed_reason,
	}
}
