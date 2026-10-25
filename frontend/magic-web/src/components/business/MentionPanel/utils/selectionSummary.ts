import type {
	MentionItem,
	MentionPanelSelectionAssetType,
	MentionPanelSelectionSummary,
} from "../types"

export type MentionPanelSelectionSummaryCounts = Record<MentionPanelSelectionAssetType, number>

function normalizeCount(value: number | undefined): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

/**
 * Merge committed resource counts with the current session's pending entries.
 * Pending entries can come from several folders, so this calculation deliberately
 * lives outside the breadcrumb renderer and applies the host's duplicate check once.
 */
export function getMentionPanelSelectionSummaryCounts(
	selectionSummary: MentionPanelSelectionSummary | undefined,
	pendingEntries: Iterable<{ item: MentionItem }>,
): MentionPanelSelectionSummaryCounts | undefined {
	if (!selectionSummary) return undefined

	const counts: MentionPanelSelectionSummaryCounts = {
		image: normalizeCount(selectionSummary.currentCounts.image),
		video: normalizeCount(selectionSummary.currentCounts.video),
		audio: normalizeCount(selectionSummary.currentCounts.audio),
	}

	for (const { item } of pendingEntries) {
		if (selectionSummary.isItemAlreadySelected?.(item)) continue
		const assetType = selectionSummary.getItemAssetType?.(item)
		if (assetType) counts[assetType] += 1
	}

	return counts
}

/**
 * 判断某个「新增」项是否还能被暂存进多选会话。
 *
 * 已提交（isItemAlreadySelected）的引用不占新槽；未归类到 image/video/audio
 * 的项不参与限制。容量以「已提交数量 + 当前暂存数量」为基准，per-type 与
 * totalLimit（总上限）任一命中即拦截。
 */
export function canAcceptPendingItem(
	item: MentionItem,
	selectionSummary: MentionPanelSelectionSummary | undefined,
	pendingEntries: Iterable<{ item: MentionItem }>,
): boolean {
	if (!selectionSummary) return true

	// 已提交的引用不占新槽位。
	if (selectionSummary.isItemAlreadySelected?.(item)) return true

	const assetType = selectionSummary.getItemAssetType?.(item)
	if (!assetType) return true

	const counts = getMentionPanelSelectionSummaryCounts(selectionSummary, pendingEntries)
	if (!counts) return true

	const limit = selectionSummary.limits[assetType]
	if (typeof limit === "number" && Number.isFinite(limit) && counts[assetType] + 1 > limit) {
		return false
	}

	const totalLimit = selectionSummary.totalLimit
	if (
		typeof totalLimit === "number" &&
		Number.isFinite(totalLimit) &&
		counts.image + counts.video + counts.audio + 1 > totalLimit
	) {
		return false
	}

	return true
}
