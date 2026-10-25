import type { Canvas } from "../core/Canvas"
import { CLEARED_MEDIA_COMPLIANCE_PATCH } from "./elementContent"

/** 媒体源替换时需解绑素材并清空 workspace 合规字段。 */
export const CLEARED_MEDIA_ASSET_COMPLIANCE_PATCH = {
	assetId: undefined,
	...CLEARED_MEDIA_COMPLIANCE_PATCH,
} as const

/** 素材库删除或远端失效时解绑 assetId，保留 src。 */
export const CLEARED_ASSET_BINDING_PATCH = CLEARED_MEDIA_ASSET_COMPLIANCE_PATCH

export function isMediaSourceChanged(
	currentSrc: string | undefined,
	nextSrc: string | undefined,
): boolean {
	const current = currentSrc?.trim() ?? ""
	const next = nextSrc?.trim() ?? ""
	if (!next) return false
	return current !== next
}

/**
 * 构建媒体 src 变更 patch：仅当资源身份变化时清 assetId 与合规字段，其余业务字段由 extra 传入。
 */
export function buildMediaSourceReplacementPatch<T extends { src?: string }>(
	currentSrc: string | undefined,
	nextSrc: string,
	extra: Partial<T> = {},
): Partial<T> {
	if (!isMediaSourceChanged(currentSrc, nextSrc)) {
		return extra
	}
	return {
		...extra,
		...CLEARED_MEDIA_ASSET_COMPLIANCE_PATCH,
		src: nextSrc,
	}
}

/** 在已有 patch 上补全 src 变更时的素材/合规清空逻辑。 */
export function mergeMediaSourceReplacementFields<
	TContent extends { src?: string },
	TPatch extends Partial<TContent>,
>(current: TContent, patch: TPatch): TPatch {
	if (typeof patch.src !== "string") return patch
	return buildMediaSourceReplacementPatch(current.src, patch.src, patch) as TPatch
}

/** 持久化前显式删除 workspace 合规字段（绑定素材库时保留 assetId）。 */
export function purgeWorkspaceMediaComplianceFields(content: {
	complianceStatus?: unknown
	complianceFailedReason?: unknown
	complianceCheckId?: unknown
}): void {
	delete content.complianceStatus
	delete content.complianceFailedReason
	delete content.complianceCheckId
}

/** 替换完成后停止旧 workspace 合规轮询并刷新画布合规状态。 */
export function finalizeMediaSourceReplacement(
	canvas: Pick<Canvas, "assetCompliancePollingManager" | "refreshMediaComplianceFailedTags">,
	options: {
		previousSrc?: string
		nextSrc?: string
		previousComplianceCheckId?: string
		previousAssetId?: string
	},
): void {
	if (!isMediaSourceChanged(options.previousSrc, options.nextSrc)) return
	const pollingIds = new Set(
		[options.previousComplianceCheckId, options.previousAssetId]
			.map((id) => id?.trim())
			.filter((id): id is string => Boolean(id)),
	)
	for (const pollingId of pollingIds) {
		canvas.assetCompliancePollingManager?.stop(pollingId)
	}
	canvas.refreshMediaComplianceFailedTags?.()
}
