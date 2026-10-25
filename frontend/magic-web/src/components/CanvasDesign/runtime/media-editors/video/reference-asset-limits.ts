import type { VideoInputModeConfig, VideoInputModeVariant } from "../../../public/magic-types"

export type ReferenceAssetKind = "image" | "video" | "audio"
export type ReferenceAssetField = "reference_images" | "reference_videos" | "reference_audios"

export interface ReferenceAssetLike {
	assetType: ReferenceAssetKind
}

export interface ReferenceAssetRange {
	min: number
	max: number
}

export interface ReferenceAssetLimits {
	reference_images: ReferenceAssetRange
	reference_videos: ReferenceAssetRange
	reference_audios: ReferenceAssetRange
	total: ReferenceAssetRange
	variantCode?: string
}

export interface ReferenceAssetCounts {
	images: number
	videos: number
	audios: number
}

export interface ReferenceAssetValidationIssue {
	field: "total" | ReferenceAssetField
	rule: "min" | "max"
	expected: number
	actual: number
	reason?: "variant"
}

/** Backward-compatible names used by the video editor public model helpers. */
export type VideoReferenceAssetLimits = ReferenceAssetLimits
export type VideoReferenceAssetValidationIssue = ReferenceAssetValidationIssue
export type VideoReferenceAssetLike = ReferenceAssetLike

interface ResolveReferenceAssetLimitsOptions {
	/** `omni_reference` 不把 mode 级 max_count 当作独立总上限。 */
	ignoreModeMaxCountForTotal?: boolean
	preserveIncompatibleVariants?: boolean
}

function countsToAssets(counts: ReferenceAssetCounts): ReferenceAssetLike[] {
	return [
		...Array.from({ length: counts.images }, () => ({ assetType: "image" as const })),
		...Array.from({ length: counts.videos }, () => ({ assetType: "video" as const })),
		...Array.from({ length: counts.audios }, () => ({ assetType: "audio" as const })),
	]
}

function normalizeFieldRange(raw?: { min?: number; max?: number }): ReferenceAssetRange {
	return {
		min: Number.isFinite(raw?.min) ? Math.max(0, Number(raw?.min)) : 0,
		max: Number.isFinite(raw?.max) ? Math.max(0, Number(raw?.max)) : Infinity,
	}
}

function fieldForKind(kind: ReferenceAssetKind): ReferenceAssetField {
	if (kind === "image") return "reference_images"
	if (kind === "video") return "reference_videos"
	return "reference_audios"
}

/**
 * Validate a picker batch incrementally. Unlike submit-time validation this
 * permits a draft that has not reached a variant minimum yet, while rejecting
 * any addition that exceeds total/per-kind maxima or makes every variant
 * impossible.
 */
export function validateReferenceAssetAdditionsByCounts(
	modeConfig: VideoInputModeConfig | undefined,
	currentCounts: ReferenceAssetCounts,
	additions: readonly ReferenceAssetKind[],
	options: ResolveReferenceAssetLimitsOptions = {},
): boolean {
	let counts = { ...currentCounts }
	for (const kind of additions) {
		if (!canAddReferenceAssetByCounts(modeConfig, counts, kind, options)) return false
		if (kind === "image") counts = { ...counts, images: counts.images + 1 }
		if (kind === "video") counts = { ...counts, videos: counts.videos + 1 }
		if (kind === "audio") counts = { ...counts, audios: counts.audios + 1 }
	}
	return true
}

export function countReferenceAssets(
	assets: readonly ReferenceAssetLike[] = [],
): ReferenceAssetCounts {
	return assets.reduce(
		(acc, item) => {
			if (item.assetType === "image") acc.images += 1
			if (item.assetType === "video") acc.videos += 1
			if (item.assetType === "audio") acc.audios += 1
			return acc
		},
		{ images: 0, videos: 0, audios: 0 },
	)
}

export const countVideoReferenceAssetInfosByKind = countReferenceAssets

function getDefaultRanges(modeConfig: VideoInputModeConfig | undefined) {
	const fallbackMax = modeConfig?.max_count
	return {
		reference_images: modeConfig?.supported_fields?.includes("reference_images")
			? normalizeFieldRange({
					max: modeConfig.reference_images?.max_count ?? fallbackMax,
				})
			: normalizeFieldRange({ max: 0 }),
		reference_videos: modeConfig?.supported_fields?.includes("reference_videos")
			? normalizeFieldRange({ max: fallbackMax })
			: normalizeFieldRange({ max: 0 }),
		reference_audios: modeConfig?.supported_fields?.includes("reference_audios")
			? normalizeFieldRange({ max: fallbackMax })
			: normalizeFieldRange({ max: 0 }),
	}
}

function getVariantRange(
	variant: VideoInputModeVariant | undefined,
	field: ReferenceAssetField,
	defaultRange: ReferenceAssetRange,
): ReferenceAssetRange {
	return variant?.limits?.[field] ? normalizeFieldRange(variant.limits[field]) : defaultRange
}

function isVariantCompatibleForCounts(
	variant: VideoInputModeVariant,
	counts: ReferenceAssetCounts,
	defaultRanges: Record<ReferenceAssetField, ReferenceAssetRange>,
): boolean {
	return (
		counts.images <=
			getVariantRange(variant, "reference_images", defaultRanges.reference_images).max &&
		counts.videos <=
			getVariantRange(variant, "reference_videos", defaultRanges.reference_videos).max &&
		counts.audios <=
			getVariantRange(variant, "reference_audios", defaultRanges.reference_audios).max
	)
}

function isVariantSatisfiedForCounts(
	variant: VideoInputModeVariant,
	counts: ReferenceAssetCounts,
	defaultRanges: Record<ReferenceAssetField, ReferenceAssetRange>,
): boolean {
	return (
		[
			["reference_images", counts.images],
			["reference_videos", counts.videos],
			["reference_audios", counts.audios],
		] as Array<[ReferenceAssetField, number]>
	).every(([field, count]) => {
		const range = getVariantRange(variant, field, defaultRanges[field])
		return count >= range.min && count <= range.max
	})
}

function resolveVariantPenalty(
	variant: VideoInputModeVariant,
	counts: ReferenceAssetCounts,
	defaultRanges: Record<ReferenceAssetField, ReferenceAssetRange>,
) {
	const fields: Array<[ReferenceAssetField, number]> = [
		["reference_images", counts.images],
		["reference_videos", counts.videos],
		["reference_audios", counts.audios],
	]
	let penalty = 0
	let supportedPresentKinds = 0
	for (const [field, count] of fields) {
		const range = getVariantRange(variant, field, defaultRanges[field])
		if (count > 0 && range.max > 0) supportedPresentKinds += 1
		if (count > range.max) penalty += count - range.max
		if (count < range.min) penalty += range.min - count
	}
	return { penalty, supportedPresentKinds }
}

function resolveBestVariant(
	variants: VideoInputModeVariant[] | undefined,
	counts: ReferenceAssetCounts,
	defaultRanges: Record<ReferenceAssetField, ReferenceAssetRange>,
) {
	if (!variants?.length) return undefined
	let best: VideoInputModeVariant | undefined
	let bestPenalty = Infinity
	let bestSupportedKinds = -1
	for (const variant of variants) {
		const { penalty, supportedPresentKinds } = resolveVariantPenalty(
			variant,
			counts,
			defaultRanges,
		)
		if (
			penalty < bestPenalty ||
			(penalty === bestPenalty && supportedPresentKinds > bestSupportedKinds)
		) {
			best = variant
			bestPenalty = penalty
			bestSupportedKinds = supportedPresentKinds
		}
	}
	return best
}

function getVariantTotalMax(
	variant: VideoInputModeVariant,
	defaultRanges: Record<ReferenceAssetField, ReferenceAssetRange>,
): number {
	const maxes = (
		["reference_images", "reference_videos", "reference_audios"] as ReferenceAssetField[]
	).map((field) => getVariantRange(variant, field, defaultRanges[field]).max)
	if (maxes.some((max) => !Number.isFinite(max))) return Infinity
	return maxes.reduce((sum, max) => sum + max, 0)
}

export function resolveReferenceAssetLimits(
	modeConfig: VideoInputModeConfig | undefined,
	assets: ReferenceAssetLike[] = [],
	options: ResolveReferenceAssetLimitsOptions = {},
): ReferenceAssetLimits {
	const counts = countReferenceAssets(assets)
	const defaultRanges = getDefaultRanges(modeConfig)
	const variants = modeConfig?.variants
	const selectedVariant =
		assets.length > 0 ? resolveBestVariant(variants, counts, defaultRanges) : undefined
	const compatibleVariants = variants?.filter((variant) =>
		isVariantCompatibleForCounts(variant, counts, defaultRanges),
	)
	const resolveMax = (field: ReferenceAssetField) => {
		if (compatibleVariants && compatibleVariants.length > 0) {
			return Math.max(
				...compatibleVariants.map(
					(variant) => getVariantRange(variant, field, defaultRanges[field]).max,
				),
			)
		}
		return getVariantRange(selectedVariant, field, defaultRanges[field]).max
	}
	const referenceImages = {
		min: getVariantRange(selectedVariant, "reference_images", defaultRanges.reference_images)
			.min,
		max: resolveMax("reference_images"),
	}
	const referenceVideos = {
		min: getVariantRange(selectedVariant, "reference_videos", defaultRanges.reference_videos)
			.min,
		max: resolveMax("reference_videos"),
	}
	const referenceAudios = {
		min: getVariantRange(selectedVariant, "reference_audios", defaultRanges.reference_audios)
			.min,
		max: resolveMax("reference_audios"),
	}
	const fallbackTotalMax = [referenceImages.max, referenceVideos.max, referenceAudios.max].some(
		(max) => !Number.isFinite(max),
	)
		? Infinity
		: referenceImages.max + referenceVideos.max + referenceAudios.max
	const variantTotalMax = compatibleVariants?.length
		? Math.max(
				...compatibleVariants.map((variant) => getVariantTotalMax(variant, defaultRanges)),
			)
		: variants?.length
			? Math.max(...variants.map((variant) => getVariantTotalMax(variant, defaultRanges)))
			: fallbackTotalMax
	const totalMax = options.ignoreModeMaxCountForTotal
		? variantTotalMax
		: variants?.length && assets.length > 0
			? variantTotalMax
			: (modeConfig?.max_count ?? fallbackTotalMax)

	return {
		reference_images: referenceImages,
		reference_videos: referenceVideos,
		reference_audios: referenceAudios,
		total: normalizeFieldRange({ max: totalMax }),
		variantCode: assets.length > 0 ? selectedVariant?.code : undefined,
	}
}

export function canAddReferenceAsset(
	modeConfig: VideoInputModeConfig | undefined,
	assets: ReferenceAssetLike[],
	kind: ReferenceAssetKind,
	options: ResolveReferenceAssetLimitsOptions = {},
): boolean {
	return canAddReferenceAssetByCounts(modeConfig, countReferenceAssets(assets), kind, options)
}

export function canAddReferenceAssetByCounts(
	modeConfig: VideoInputModeConfig | undefined,
	currentCounts: ReferenceAssetCounts,
	kind: ReferenceAssetKind,
	options: ResolveReferenceAssetLimitsOptions = {},
): boolean {
	const supportedField = fieldForKind(kind)
	if (!modeConfig?.supported_fields?.includes(supportedField)) return false
	const counts = { ...currentCounts }
	if (kind === "image") counts.images += 1
	if (kind === "video") counts.videos += 1
	if (kind === "audio") counts.audios += 1
	const defaults = getDefaultRanges(modeConfig)
	const variants = modeConfig.variants
	const hasCompatibleVariant = variants?.length
		? variants.some((variant) => isVariantCompatibleForCounts(variant, counts, defaults))
		: true
	if (!hasCompatibleVariant) return false
	const limits = resolveReferenceAssetLimits(modeConfig, countsToAssets(currentCounts), options)
	const nextCount =
		kind === "image" ? counts.images : kind === "video" ? counts.videos : counts.audios
	const typeLimit = limits[supportedField].max
	if (Number.isFinite(typeLimit) && nextCount > typeLimit) return false
	if (!options.ignoreModeMaxCountForTotal && Number.isFinite(limits.total.max)) {
		const currentTotal = counts.images + counts.videos + counts.audios - 1
		if (currentTotal + 1 > limits.total.max) return false
	}
	return true
}

/**
 * 判断替换一个既有素材后，素材集合是否仍可继续构建合法变体。
 * 替换语义先扣除旧素材，再按新增素材执行增量容量检查；变体最小数量由提交阶段校验。
 */
export function canReplaceReferenceAssetByCounts(
	modeConfig: VideoInputModeConfig | undefined,
	currentCounts: ReferenceAssetCounts,
	replacedKind: ReferenceAssetKind,
	nextKind: ReferenceAssetKind,
	options: ResolveReferenceAssetLimitsOptions = {},
): boolean {
	const remainingCounts = { ...currentCounts }
	if (replacedKind === "image") remainingCounts.images -= 1
	if (replacedKind === "video") remainingCounts.videos -= 1
	if (replacedKind === "audio") remainingCounts.audios -= 1

	if (remainingCounts.images < 0 || remainingCounts.videos < 0 || remainingCounts.audios < 0)
		return false

	if (!canAddReferenceAssetByCounts(modeConfig, remainingCounts, nextKind, options)) {
		return false
	}

	// Replacement is an incremental edit. `canAddReferenceAssetByCounts` above
	// already checked supported fields, type/total maxima, and whether the new
	// counts can still fit at least one variant. Do not run the submit-time
	// completeness validation here: a draft may legitimately be missing a
	// variant minimum until the user adds the remaining reference assets.
	return true
}

export function validateReferenceAssetsByLimits(
	modeConfig: VideoInputModeConfig | undefined,
	assets: ReferenceAssetLike[] = [],
	options: ResolveReferenceAssetLimitsOptions = {},
): ReferenceAssetValidationIssue[] {
	const limits = resolveReferenceAssetLimits(modeConfig, assets, options)
	const counts = countReferenceAssets(assets)
	const issues: ReferenceAssetValidationIssue[] = []
	if (
		!options.ignoreModeMaxCountForTotal &&
		Number.isFinite(limits.total.max) &&
		assets.length > limits.total.max
	) {
		issues.push({
			field: "total",
			rule: "max",
			expected: limits.total.max,
			actual: assets.length,
		})
	}
	const checks: Array<[ReferenceAssetField, number, ReferenceAssetRange]> = [
		["reference_images", counts.images, limits.reference_images],
		["reference_videos", counts.videos, limits.reference_videos],
		["reference_audios", counts.audios, limits.reference_audios],
	]
	for (const [field, actual, range] of checks) {
		if (Number.isFinite(range.max) && actual > range.max) {
			issues.push({ field, rule: "max", expected: range.max, actual })
		}
		if (range.min > 0 && actual < range.min) {
			issues.push({ field, rule: "min", expected: range.min, actual })
		}
	}
	if (modeConfig?.variants?.length) {
		const defaults = getDefaultRanges(modeConfig)
		const satisfied = modeConfig.variants.some((variant) =>
			isVariantSatisfiedForCounts(variant, counts, defaults),
		)
		if (!satisfied) {
			issues.push({
				field: "total",
				rule: "max",
				expected: 0,
				actual: assets.length,
				reason: "variant",
			})
		}
	}
	return issues
}

export function clampReferenceAssetsToLimits<T extends ReferenceAssetLike>(
	assets: T[],
	modeConfig: VideoInputModeConfig | undefined,
	options: ResolveReferenceAssetLimitsOptions = {},
): T[] {
	if (modeConfig?.variants?.length) {
		const defaults = getDefaultRanges(modeConfig)
		const counts = countReferenceAssets(assets)
		const hasCompatibleVariant = modeConfig.variants.some((variant) =>
			isVariantCompatibleForCounts(variant, counts, defaults),
		)
		// 保留历史草稿/联动素材，交由提交前校验提示不可行组合，避免静默丢失用户素材。
		if (!hasCompatibleVariant && options.preserveIncompatibleVariants) return assets
	}
	const next: T[] = []
	for (const item of assets) {
		if (canAddReferenceAsset(modeConfig, next, item.assetType, options)) next.push(item)
	}
	return next
}
