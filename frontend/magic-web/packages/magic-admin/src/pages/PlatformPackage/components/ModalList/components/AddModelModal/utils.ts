import { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import { TFunction } from "i18next"
import {
	BILLING_OBJECT_TO_LEGACY_COST_FIELD_MAP,
	BILLING_OBJECT_TO_LEGACY_PRICE_FIELD_MAP,
	BillingDimension,
	LangConfig,
	TEXT_TOKEN_COST_FIELDS,
	TEXT_TOKEN_COST_TO_PRICE_FIELD,
	TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE,
	TEXT_TOKEN_PRICE_FIELDS,
	TEXT_TOKEN_PRICE_TO_COST_OBJECT,
	TextTokenCostField,
	TextTokenPriceField,
} from "./constant"
import { normalizePersistedBillingType, NormalizedPricingTemplate } from "./pricingTemplate"
import {
	buildEnabledMap,
	buildModeMap,
	getPricingEnabledField,
	getPricingModeField,
	getPricingSourceField,
	getPricingStepsField,
	getPricingValueField,
	isFollowPricingMode,
	resolveFinalPricingSourceField,
} from "../OfficialModelConfig/utils"

type Config = AiManage.Config
export type PricingFormStep = { max?: number | string | null; price?: number | string | null }
type FollowPricingFormStep = { price?: number | string | null }

export type ImportSourceModel = AiManage.ModelInfo & {
	provider_name?: string
	service_provider_name?: string
	provider_code?: string
}

/** 旧 billing_type 值归一化为新 billing_type 值 */
export const normalizeBillingType = normalizePersistedBillingType

/** 获取初始模型信息 */
export const getDefaultModelInfo = ({
	modelType,
	category,
}: {
	modelType?: AiModel.ModelTypeGroup | null
	category?: AiModel.ServiceProviderCategory | null
}) => {
	const defaultBillingType = normalizeBillingType(category)
	const isLLM = category === AiModel.ServiceProviderCategory.LLM

	return {
		id: "",
		icon: "",
		model_type: modelType ?? AiModel.ModelTypeGroup.LargeLanguageModel,
		config: {
			billing_currency: AiManage.BillingCurrency.CNY,
			billing_type: defaultBillingType,
			...(isLLM
				? {
						vector_size: 0,
						max_tokens: 128000,
						max_output_tokens: 64000,
						temperature: 0.7,
						temperature_type: AiModel.ModelTemperatureType.Recommended,
					}
				: {}),
		},
		translate: LangConfig,
	}
}

/** 构建模型初始值 */
export const buildAddModelInitialValues = ({
	info,
	modelType,
	category,
	defaultPricingTemplate,
}: {
	info?: AiManage.ModelInfo | null
	modelType?: AiModel.ModelTypeGroup | null
	category?: AiModel.ServiceProviderCategory | null
	defaultPricingTemplate?: NormalizedPricingTemplate | null
}) => {
	if (info) {
		const { config, ...rest } = info
		const model_power = [
			config.support_function ? AiModel.ModelPower.SupportTool : undefined,
			config.support_multi_modal ? AiModel.ModelPower.SupportVision : undefined,
			config.support_deep_think ? AiModel.ModelPower.SupportThink : undefined,
		].filter(Boolean)

		const pricingConfig = defaultPricingTemplate
			? defaultPricingTemplate.supportsLadder
				? buildInitialLlmPricingConfig(config)
				: buildInitialGenericPricingConfig(config, defaultPricingTemplate)
			: {}

		return {
			...rest,
			id: rest.id,
			model_power,
			visible_applications: rest?.visible_applications?.join(","),
			translate: rest.translate,
			config: {
				...config,
				...pricingConfig,
				billing_type: defaultPricingTemplate?.persistBillingType ?? config.billing_type,
				temperature_type: config.creativity
					? AiModel.ModelTemperatureType.Recommended
					: AiModel.ModelTemperatureType.Fixed,
				temperature: config.creativity || config.temperature,
			},
		}
	}

	const defaultModelInfo = getDefaultModelInfo({ modelType, category })
	if (!defaultPricingTemplate) return defaultModelInfo

	return {
		...defaultModelInfo,
		config: {
			...defaultModelInfo.config,
			billing_type: defaultPricingTemplate.persistBillingType,
		},
	}
}

/** 构建阶梯定价的表单初始值。 */
export const buildInitialLlmPricingConfig = (config: Config) => {
	const { price: priceTierMap, cost: costTierMap } = buildTextTokenBillingTierMaps(
		config.billing_tiers,
	)

	// 构建四个计价项的表单初始值
	return TEXT_TOKEN_PRICE_FIELDS.reduce(
		(acc, field) => {
			;(["price", "cost"] as BillingDimension[]).forEach((dimension) => {
				const tierMap = dimension === "price" ? priceTierMap : costTierMap
				const peerTierMap = dimension === "price" ? priceTierMap : costTierMap
				const currentTier = tierMap[field]
				/* 旧版定价字段 */
				const legacyField = getLegacyPricingField(field, dimension)
				/* 价格字段 */
				const valueField = getPricingValueField(field, dimension)
				/* 定价模式字段 */
				const modeField = getPricingModeField(field, dimension)
				/* 定价阶梯字段 */
				const stepsField = getPricingStepsField(field, dimension)
				/* 定价开关字段 */
				const enabledField = getPricingEnabledField(field, dimension)
				/* 定价阶梯规则 */
				const tierRules = currentTier?.pricing_rules
				const resolvedMode = currentTier
					? resolvePricingModeFromTier(currentTier, peerTierMap)
					: AiManage.PricingMode.Fixed

				acc[enabledField] =
					Boolean(tierRules?.length) ||
					(config[legacyField] !== null && config[legacyField] !== undefined)

				acc[valueField] =
					currentTier?.pricing_mode === AiManage.BillingMode.Fixed
						? tierRules?.[0]?.price
						: config[legacyField]

				acc[modeField] = resolvedMode

				acc[stepsField] =
					currentTier?.pricing_mode === AiManage.BillingMode.Tiered
						? isFollowPricingMode(resolvedMode)
							? buildFollowPricingPriceStepsFromRules(tierRules)
							: buildFormPricingStepsFromRules(tierRules)
						: undefined
			})

			return acc
		},
		{} as Record<string, unknown>,
	)
}

/** 获取旧版扁平定价字段值（按 billing_type，不嗅探 billing_object） */
const getLegacyGenericPricingValue = (
	config: Config,
	dimension: BillingDimension,
	billingType?: string | null,
	category?: AiModel.ServiceProviderCategory | null,
) => {
	const normalizedType = normalizePersistedBillingType(
		category,
		billingType ?? config.billing_type,
	)

	if (normalizedType === AiManage.BillingType.ImageCount) {
		return dimension === "price" ? config.time_pricing : config.time_cost
	}

	if (
		normalizedType === AiManage.BillingType.ImageTokens ||
		normalizedType === AiManage.BillingType.ImageTokensWithThought
	) {
		return dimension === "price" ? config.output_pricing : config.output_cost
	}

	if (
		normalizedType === AiManage.BillingType.VideoDuration ||
		normalizedType === AiManage.BillingType.KelingVideoResolutionMediaConditionDurationPricing
	) {
		return dimension === "price" ? config.second_pricing : config.second_cost
	}

	return undefined
}

/** 构建通用计费类型的表单初始值（非 TextTokens 类型/非阶梯定价类型） */
export const buildInitialGenericPricingConfig = (
	config: Config,
	template?: NormalizedPricingTemplate | null,
) => {
	if (!template?.genericGroups?.length) return {}
	/* 是否使用旧版定价字段 */
	const shouldUseLegacyFields = !config.billing_tiers?.length
	const billingType = config.billing_type ?? template.persistBillingType

	const acc: Record<string, unknown> = {}
	for (const group of template.genericGroups) {
		for (const row of group.rows) {
			if (row.priceField) {
				acc[row.priceField] = shouldUseLegacyFields
					? getLegacyGenericPricingValue(config, "price", billingType, template.category)
					: findTierFixedPrice(config.billing_tiers, row.priceField)
			}
			if (row.costField) {
				acc[row.costField] = shouldUseLegacyFields
					? getLegacyGenericPricingValue(config, "cost", billingType, template.category)
					: findTierFixedPrice(config.billing_tiers, row.costField)
			}
		}
	}
	return acc
}

/** 判断 billing_object 是否为定价字段 */
const isTextTokenPriceObject = (
	billingObject?: string | null,
): billingObject is TextTokenPriceField =>
	TEXT_TOKEN_PRICE_FIELDS.includes(billingObject as TextTokenPriceField)

/** 判断 billing_object 是否为成本字段。 */
const isTextTokenCostObject = (
	billingObject?: string | null,
): billingObject is TextTokenCostField =>
	TEXT_TOKEN_COST_FIELDS.includes(billingObject as TextTokenCostField)

/** 讲 billing_object 归一化为前端使用的售价字段。 */
const toTextTokenPriceField = (
	billingObject?: AiManage.BillingTierObject | string | null,
): TextTokenPriceField | undefined => {
	if (!billingObject) return undefined
	if (isTextTokenPriceObject(billingObject)) {
		return billingObject
	}
	if (isTextTokenCostObject(billingObject)) {
		return TEXT_TOKEN_COST_TO_PRICE_FIELD[billingObject]
	}
	return undefined
}

/** 获取旧版扁平定价字段名。 */
export const getLegacyPricingField = (
	field: TextTokenPriceField,
	dimension: BillingDimension = "price",
) =>
	dimension === "price"
		? BILLING_OBJECT_TO_LEGACY_PRICE_FIELD_MAP[field]
		: BILLING_OBJECT_TO_LEGACY_COST_FIELD_MAP[field]

/** 将后端 pricing_rules 转换为表单中的阶梯输入结构。 */
export const buildFormPricingStepsFromRules = (rules?: AiManage.PricingRule[] | null) => {
	return rules?.map((rule) => ({
		max: rule.max ?? undefined,
		price: rule.price ?? undefined,
	}))
}

export const buildFollowPricingPriceStepsFromRules = (
	rules?: AiManage.PricingRule[] | null,
): FollowPricingFormStep[] | undefined => rules?.map((rule) => ({ price: rule.price ?? undefined }))

export const deriveFollowTierBounds = (
	sourceSteps?: PricingFormStep[] | null,
): Array<Pick<PricingFormStep, "max">> =>
	sourceSteps?.map((step) => ({ max: step.max ?? undefined })) ?? []

export const mergeFollowBoundsWithPrices = (
	bounds?: Array<Pick<PricingFormStep, "max">> | null,
	prices?: FollowPricingFormStep[] | null,
): PricingFormStep[] =>
	bounds?.map((bound, index) => ({
		max: bound.max ?? undefined,
		price: prices?.[index]?.price,
	})) ?? []

/** 将表单里的阶梯输入转换为后端 billing_rules。 */
export const buildBillingRules = (steps?: PricingFormStep[] | null) => {
	if (!steps?.length) return []

	return steps.map((step, index) => ({
		min: index === 0 ? 0 : Number(steps[index - 1]?.max ?? 0),
		max:
			step.max === undefined || step.max === null || step.max === ""
				? null
				: Number(step.max),
		price: Number(step.price ?? 0),
	}))
}

/** 将固定价格转换为后端要求的单条固定 billing_rule。 */
export const buildFixedBillingRules = (price?: number | string | null) => {
	if (price === undefined || price === null || price === "") return []

	return [
		{
			min: null,
			max: null,
			price: Number(price),
		},
	]
}

export const buildFollowBillingRules = (
	sourceSteps?: PricingFormStep[] | null,
	prices?: FollowPricingFormStep[] | null,
) => buildBillingRules(mergeFollowBoundsWithPrices(deriveFollowTierBounds(sourceSteps), prices))

/** 根据单个 billing tier 推断前端应展示的定价模式。 */
export const resolvePricingModeFromTier = (
	tier: AiManage.BillingTier,
	billingTierMap: Partial<Record<TextTokenPriceField, AiManage.BillingTier>>,
) => {
	if (tier.pricing_mode === AiManage.BillingMode.Fixed) {
		return AiManage.PricingMode.Fixed
	}

	/* 当前定价字段 */
	const currentField = toTextTokenPriceField(tier.billing_object)
	/* 区间跟随字段 */
	const followField = toTextTokenPriceField(tier.follow_object)

	if (!currentField || !followField) return AiManage.PricingMode.Fixed
	if (currentField === followField) return AiManage.PricingMode.Ladder

	/* 区间跟随字段对应的tier */
	const sourceTier = billingTierMap[followField]
	if (!sourceTier || sourceTier.pricing_mode !== AiManage.BillingMode.Tiered) {
		return AiManage.PricingMode.Fixed
	}

	return TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE[followField]
}

export type TextTokenBillingTierMaps = {
	price: Partial<Record<TextTokenPriceField, AiManage.BillingTier>>
	cost: Partial<Record<TextTokenPriceField, AiManage.BillingTier>>
}

/** 将 TextTokens 的 billing_tiers 按售价 / 成本拆成两份映射。
 * parameters:
 * - billingTiers: AiManage.BillingTier[] | null | undefined
 * return:
 * - TextTokenBillingTierMaps: {
 *   price: Partial<Record<TextTokenPriceField, AiManage.BillingTier>>
 *   cost: Partial<Record<TextTokenPriceField, AiManage.BillingTier>>
 * }
 *
 */
export const buildTextTokenBillingTierMaps = (
	billingTiers?: AiManage.BillingTier[] | null,
): TextTokenBillingTierMaps => {
	const price: TextTokenBillingTierMaps["price"] = {}
	const cost: TextTokenBillingTierMaps["cost"] = {}

	if (!billingTiers?.length) {
		return { price, cost }
	}

	for (const tier of billingTiers) {
		const field = toTextTokenPriceField(tier.billing_object)
		if (!field) continue
		if (isTextTokenCostObject(tier.billing_object)) {
			cost[field] = tier
		} else {
			price[field] = tier
		}
	}

	return { price, cost }
}

/** 从 billing_tiers 中查找指定 billingObject 的固定价格 */
const findTierFixedPrice = (
	tiers: AiManage.BillingTier[] | null | undefined,
	billingObject: string,
): number | string | undefined => {
	const tier = tiers?.find((t) => t.billing_object === billingObject)
	if (!tier || tier.pricing_mode !== AiManage.BillingMode.Fixed) return undefined
	return tier.pricing_rules?.[0]?.price
}

/** 通用计费类型的 billing_tiers 提交构建（非 TextTokens 类型） */
export const buildSubmitGenericPricingConfig = (
	config: Record<string, any>,
	template?: NormalizedPricingTemplate | null,
) => {
	if (!template?.genericGroups?.length) return { billing_tiers: null }

	const tiers: AiManage.BillingTier[] = []
	for (const group of template.genericGroups) {
		for (const row of group.rows) {
			if (row.priceField) {
				const priceValue = config[row.priceField]
				if (priceValue !== undefined && priceValue !== null && priceValue !== "") {
					tiers.push({
						billing_object: row.priceField,
						follow_object: row.priceField,
						pricing_mode: AiManage.BillingMode.Fixed,
						pricing_rules: [{ min: null, max: null, price: Number(priceValue) }],
					})
				}
			}
			if (row.costField) {
				const costValue = config[row.costField]
				if (costValue !== undefined && costValue !== null && costValue !== "") {
					tiers.push({
						billing_object: row.costField,
						follow_object: row.costField,
						pricing_mode: AiManage.BillingMode.Fixed,
						pricing_rules: [{ min: null, max: null, price: Number(costValue) }],
					})
				}
			}
		}
	}

	return { billing_tiers: tiers.length ? tiers : null }
}

/** 判断 billing_type 是否为 TextTokens（含旧值兼容） */
export const isTextTokensBillingType = (billingType?: string | null) =>
	billingType === AiManage.BillingType.TextTokens || billingType === AiManage.BillingType.ByTokens

const buildDimensionPayload = (
	field: TextTokenPriceField,
	config: Record<string, any>,
	dimension: BillingDimension,
) => {
	const mode = config[getPricingModeField(field, dimension)]
	const steps = config[getPricingStepsField(field, dimension)]
	const enabled = config[getPricingEnabledField(field, dimension)]
	const modes = buildModeMap(config, dimension)
	const enabledMap = buildEnabledMap(config, dimension)
	const sourceField = getPricingSourceField(mode)
	const finalSourceField = resolveFinalPricingSourceField(field, modes, enabledMap)
	const valueField = getPricingValueField(field, dimension)

	if (!enabled) {
		return null
	}

	if (mode === AiManage.PricingMode.Ladder) {
		return {
			follow_object: field,
			mode: AiManage.BillingMode.Tiered,
			rules: buildBillingRules(steps),
		}
	}

	// 跟随定价
	if (isFollowPricingMode(mode)) {
		if (!sourceField || !finalSourceField) {
			return null
		}

		// 获取源定价步长
		const sourceSteps = config[getPricingStepsField(finalSourceField, dimension)]

		return {
			follow_object: finalSourceField,
			mode: AiManage.BillingMode.Tiered,
			rules: buildFollowBillingRules(sourceSteps, steps),
		}
	}

	return {
		follow_object: field,
		mode: AiManage.BillingMode.Fixed,
		rules: buildFixedBillingRules(config[valueField]),
	}
}

const buildBillingTierForDimension = (
	field: TextTokenPriceField,
	config: Record<string, any>,
	dimension: BillingDimension,
): AiManage.BillingTier | null => {
	const payload = buildDimensionPayload(field, config, dimension)
	if (!payload) return null

	const billingObject = dimension === "price" ? field : TEXT_TOKEN_PRICE_TO_COST_OBJECT[field]
	const followObject =
		dimension === "price"
			? payload.follow_object
			: TEXT_TOKEN_PRICE_TO_COST_OBJECT[payload.follow_object]

	return {
		billing_object: billingObject,
		follow_object: followObject,
		pricing_mode: payload.mode,
		pricing_rules: payload.rules,
	}
}

/** 构建最终提交给后端的计价配置。 */
export const buildSubmitPricingConfig = (config: Record<string, any>) => {
	const billingTiersPayload = TEXT_TOKEN_PRICE_FIELDS.flatMap((field) => {
		const priceTier = buildBillingTierForDimension(field, config, "price")
		const costTier = buildBillingTierForDimension(field, config, "cost")
		return [priceTier, costTier].filter(Boolean) as AiManage.BillingTier[]
	})

	return {
		billing_tiers: billingTiersPayload.length ? billingTiersPayload : null,
	}
}

export const getModelPowerFromConfig = (config: Config) => {
	return [
		config.support_function ? AiModel.ModelPower.SupportTool : undefined,
		config.support_multi_modal ? AiModel.ModelPower.SupportVision : undefined,
		config.support_deep_think ? AiModel.ModelPower.SupportThink : undefined,
	].filter(Boolean)
}

export const getImportSourceProviderName = (source: ImportSourceModel) => {
	return (
		source.provider_name ||
		source.service_provider_name ||
		source.provider_code ||
		source.service_provider_config_id
	)
}

/** 获取模型类型组 */
export const getModelTypeGroup = (
	t: TFunction,
	category?: AiModel.ServiceProviderCategory | null,
) => {
	switch (category) {
		case AiModel.ServiceProviderCategory.LLM:
			return [
				{
					label: t("form.chatModel"),
					value: AiModel.ModelTypeGroup.LargeLanguageModel,
				},
				{
					label: t("form.EmbeddingModel"),
					value: AiModel.ModelTypeGroup.Embedding,
				},
			]
		case AiModel.ServiceProviderCategory.VLM:
			return [
				{
					label: t("textToImage"),
					value: AiModel.ModelTypeGroup.TextToImage,
				},
				{
					label: t("imageToImage"),
					value: AiModel.ModelTypeGroup.ImageToImage,
				},
				{
					label: t("imageEnhance"),
					value: AiModel.ModelTypeGroup.ImageEnhance,
				},
			]
		case AiModel.ServiceProviderCategory.VGM:
			return [
				{
					label: t("textToVideo"),
					value: AiModel.ModelTypeGroup.TextToVideo,
				},
			]
		default:
			return []
	}
}
