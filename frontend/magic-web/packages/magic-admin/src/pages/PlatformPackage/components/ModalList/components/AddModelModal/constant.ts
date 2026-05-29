import { AiManage } from "@admin/types/aiManage"
export const defaultLang = {
	zh_CN: "",
	en_US: "",
}
export const LangConfig = {
	name: defaultLang,
	description: defaultLang,
}

/** TextTokens 售价侧计费字段 */
export const TEXT_TOKEN_PRICE_FIELDS = [
	AiManage.BillingObject.InputToken,
	AiManage.BillingObject.OutputToken,
	AiManage.BillingObject.CacheWriteToken,
	AiManage.BillingObject.CacheHitToken,
] as const satisfies readonly AiManage.TextTokenBillingObject[]

/** TextTokens 成本侧计费字段 */
export const TEXT_TOKEN_COST_FIELDS = [
	AiManage.BillingObjectCost.InputCost,
	AiManage.BillingObjectCost.OutputCost,
	AiManage.BillingObjectCost.CacheWriteCost,
	AiManage.BillingObjectCost.CacheHitCost,
] as const satisfies readonly AiManage.TextTokenBillingObjectCost[]

export type TextTokenPriceField = AiManage.TextTokenBillingObject
export type TextTokenCostField = AiManage.TextTokenBillingObjectCost

/** 定价维度 */
export type BillingDimension = "price" | "cost"

/** 默认定价步长 */
export const DEFAULT_PRICING_STEPS = [
	{ max: 32, price: 1 },
	{ max: 128, price: 1 },
	{ max: undefined, price: 1 },
]

/** TextTokens 售价字段 -> 跟随模式 */
export const TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE: Record<
	TextTokenPriceField,
	AiManage.PricingMode
> = {
	[AiManage.BillingObject.InputToken]: AiManage.PricingMode.FollowInput,
	[AiManage.BillingObject.OutputToken]: AiManage.PricingMode.FollowOutput,
	[AiManage.BillingObject.CacheWriteToken]: AiManage.PricingMode.FollowCacheWrite,
	[AiManage.BillingObject.CacheHitToken]: AiManage.PricingMode.FollowCacheHit,
}

/** 新版定价字段 -> 旧版定价字段 */
export const BILLING_OBJECT_TO_LEGACY_PRICE_FIELD_MAP: Record<
	TextTokenPriceField,
	AiManage.LegacyPricingField
> = {
	[AiManage.BillingObject.InputToken]: AiManage.LegacyPricingField.InputPricing,
	[AiManage.BillingObject.OutputToken]: AiManage.LegacyPricingField.OutputPricing,
	[AiManage.BillingObject.CacheWriteToken]: AiManage.LegacyPricingField.CacheWritePricing,
	[AiManage.BillingObject.CacheHitToken]: AiManage.LegacyPricingField.CacheHitPricing,
}

/** 新版定价字段 -> 旧版成本字段 */
export const BILLING_OBJECT_TO_LEGACY_COST_FIELD_MAP: Record<
	TextTokenPriceField,
	AiManage.LegacyCostField
> = {
	[AiManage.BillingObject.InputToken]: AiManage.LegacyCostField.InputCost,
	[AiManage.BillingObject.OutputToken]: AiManage.LegacyCostField.OutputCost,
	[AiManage.BillingObject.CacheWriteToken]: AiManage.LegacyCostField.CacheWriteCost,
	[AiManage.BillingObject.CacheHitToken]: AiManage.LegacyCostField.CacheHitCost,
}

/** TextTokens 售价字段 -> billing_tiers 中成本项 billing_object / follow_object */
export const TEXT_TOKEN_PRICE_TO_COST_OBJECT: Record<TextTokenPriceField, TextTokenCostField> = {
	[AiManage.BillingObject.InputToken]: AiManage.BillingObjectCost.InputCost,
	[AiManage.BillingObject.OutputToken]: AiManage.BillingObjectCost.OutputCost,
	[AiManage.BillingObject.CacheWriteToken]: AiManage.BillingObjectCost.CacheWriteCost,
	[AiManage.BillingObject.CacheHitToken]: AiManage.BillingObjectCost.CacheHitCost,
}

/** TextTokens 成本字段 -> 售价字段 */
export const TEXT_TOKEN_COST_TO_PRICE_FIELD: Record<TextTokenCostField, TextTokenPriceField> = {
	[AiManage.BillingObjectCost.InputCost]: AiManage.BillingObject.InputToken,
	[AiManage.BillingObjectCost.OutputCost]: AiManage.BillingObject.OutputToken,
	[AiManage.BillingObjectCost.CacheWriteCost]: AiManage.BillingObject.CacheWriteToken,
	[AiManage.BillingObjectCost.CacheHitCost]: AiManage.BillingObject.CacheHitToken,
}

export const TEXT_TOKEN_FOLLOW_MODE_TO_SOURCE_FIELD: Partial<
	Record<AiManage.PricingMode, TextTokenPriceField>
> = {
	[AiManage.PricingMode.FollowInput]: AiManage.BillingObject.InputToken,
	[AiManage.PricingMode.FollowOutput]: AiManage.BillingObject.OutputToken,
	[AiManage.PricingMode.FollowCacheWrite]: AiManage.BillingObject.CacheWriteToken,
	[AiManage.PricingMode.FollowCacheHit]: AiManage.BillingObject.CacheHitToken,
}

/** 旧值，仅用于读取兼容 */
export const DEPRECATED_BILLING_TYPES = new Set<string>([
	AiManage.BillingType.ByTokens,
	AiManage.BillingType.ByTimes,
	AiManage.BillingType.ByPerSecond,
])

/* 表单单位 i18n key */
export const UNIT_KEY_MAP = {
	/** 按张计费 */
	PerImage: "perImage",
	/** 按秒计费 */
	PerSecond: "perSecond",
	/** 按百万 Token 计费 */
	MillionTokens: "millionTokens",
}

/** billing_type -> 表单单位 i18n key */
export const BILLING_TYPE_UNIT_KEY: Record<string, string> = {
	[AiManage.BillingType.ImageCount]: UNIT_KEY_MAP.PerImage,
	[AiManage.BillingType.ImageTokens]: UNIT_KEY_MAP.MillionTokens,
	[AiManage.BillingType.ImageTokensWithThought]: UNIT_KEY_MAP.MillionTokens,
	[AiManage.BillingType.VideoDuration]: UNIT_KEY_MAP.PerSecond,
	[AiManage.BillingType.VideoTokens]: UNIT_KEY_MAP.MillionTokens,
	[AiManage.BillingType.KelingVideoResolutionMediaConditionDurationPricing]:
		UNIT_KEY_MAP.PerSecond,
	[AiManage.BillingType.VolcengineArkVideoResolutionReferenceVideoTokenMatrix]:
		UNIT_KEY_MAP.MillionTokens,
}

/** billing_type -> 模板级分组标题 i18n key（整模板同一分组时使用） */
export const BILLING_TYPE_GROUP_LABEL_KEY: Record<string, string> = {
	[AiManage.BillingType.ImageCount]: "form.imageCountPriceGroup",
	[AiManage.BillingType.ImageTokens]: "form.imageTokenPriceGroup",
	[AiManage.BillingType.ImageTokensWithThought]: "form.imageTokenPriceGroup",
	[AiManage.BillingType.VideoDuration]: "form.videoDurationPriceGroup",
	[AiManage.BillingType.KelingVideoResolutionMediaConditionDurationPricing]:
		"form.videoDurationPriceGroup",
}

/** 成本侧 billing_object 后缀：旧版 `_cost`，新版 `.cost` */
export const COST_OBJECT_SUFFIXES = ["_cost", ".cost"] as const

/** @deprecated 使用 COST_OBJECT_SUFFIXES / getMatchedCostObjectSuffix */
export const COST_SUFFIX = COST_OBJECT_SUFFIXES[0]
