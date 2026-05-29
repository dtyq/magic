import { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import {
	TEXT_TOKEN_COST_TO_PRICE_FIELD,
	TEXT_TOKEN_PRICE_TO_COST_OBJECT,
	TEXT_TOKEN_PRICE_FIELDS,
	TextTokenCostField,
	TextTokenPriceField,
	BILLING_TYPE_UNIT_KEY,
	BILLING_TYPE_GROUP_LABEL_KEY,
	DEPRECATED_BILLING_TYPES,
	COST_OBJECT_SUFFIXES,
	UNIT_KEY_MAP,
} from "./constant"

// 标准化 Token 定价项
export interface NormalizedTokenPricingItem {
	billingObject: TextTokenPriceField
	costObject: TextTokenCostField
	priceLabel: string
	costLabel: string
	unitKey: string
}

// 标准化通用定价项行
export interface NormalizedGenericPricingRow {
	key: string
	displayLabel: string
	groupLabelKey?: string
	unitKey: string
	priceField?: string
	priceLabel?: string
	costField?: string
	costLabel?: string
}
// 标准化通用定价项分组
export interface NormalizedGenericPricingGroup {
	groupLabelKey?: string
	rows: NormalizedGenericPricingRow[]
}
// 标准化定价模板
export interface NormalizedPricingTemplate {
	templateCode: string
	templateLabel: string
	persistBillingType: AiManage.PersistBillingType
	category: AiModel.ServiceProviderCategory
	supportsLadder: boolean
	tokenItems: NormalizedTokenPricingItem[]
	genericGroups: NormalizedGenericPricingGroup[]
}

/** 匹配 billing_object 上的成本后缀 */
export const getMatchedCostObjectSuffix = (billingObject: string): string | undefined =>
	COST_OBJECT_SUFFIXES.find((suffix) => billingObject.endsWith(suffix))

/** 是否为成本侧 billing_object */
export const isCostBillingObject = (billingObject: string) =>
	Boolean(getMatchedCostObjectSuffix(billingObject))

/** 将成本 billing_object 归一化为与售价配对的 base key */
export const resolveBaseBillingObject = (billingObject: string): string => {
	const mappedPriceField = TEXT_TOKEN_COST_TO_PRICE_FIELD[billingObject as TextTokenCostField]
	if (mappedPriceField) return mappedPriceField

	const suffix = getMatchedCostObjectSuffix(billingObject)
	if (suffix) return billingObject.slice(0, -suffix.length)

	return billingObject
}

/** 解析表单单位：billing_type 优先，category 次之，billing_object 兜底 */
const resolveUnitKey = (
	billingType: string,
	category: AiModel.ServiceProviderCategory,
	billingObject: string,
) => {
	if (BILLING_TYPE_UNIT_KEY[billingType]) {
		return BILLING_TYPE_UNIT_KEY[billingType]
	}

	if (category === AiModel.ServiceProviderCategory.VLM) {
		if (billingType === AiManage.BillingType.ByTimes) return UNIT_KEY_MAP.PerImage
		return UNIT_KEY_MAP.MillionTokens
	}

	if (category === AiModel.ServiceProviderCategory.VGM) {
		if (billingType === AiManage.BillingType.VideoTokens || billingType.includes("Token")) {
			return UNIT_KEY_MAP.MillionTokens
		}
		return UNIT_KEY_MAP.PerSecond
	}

	if (billingObject.includes("count")) return UNIT_KEY_MAP.PerImage

	if (billingObject.includes("duration")) return UNIT_KEY_MAP.PerSecond

	return UNIT_KEY_MAP.MillionTokens
}

/** 基于 billing_object 推断分组（兜底，多用于 VGM Token 矩阵等多分组模板） */
const getGroupLabelKeyFromBillingObject = (
	category: AiModel.ServiceProviderCategory,
	baseBillingObject: string,
): string | undefined => {
	if (category === AiModel.ServiceProviderCategory.VLM) {
		if (baseBillingObject.includes("count")) return "form.imageCountPriceGroup"
		return "form.imageTokenPriceGroup"
	}

	if (category === AiModel.ServiceProviderCategory.VGM) {
		if (baseBillingObject.includes("duration")) return "form.videoDurationPriceGroup"
		if (baseBillingObject.includes("token")) {
			return "form.videoCommonTokenPriceGroup"
		}
		return "form.commonPriceGroup"
	}

	return undefined
}

/** 解析分组标题：billing_type 模板级配置优先，billing_object 兜底 */
const resolveGroupLabelKey = (
	billingType: string,
	category: AiModel.ServiceProviderCategory,
	baseBillingObject: string,
) =>
	BILLING_TYPE_GROUP_LABEL_KEY[billingType] ??
	getGroupLabelKeyFromBillingObject(category, baseBillingObject)

/** 构建通用定价项分组 */
const buildGenericGroups = (
	rows: NormalizedGenericPricingRow[],
): NormalizedGenericPricingGroup[] => {
	return rows.reduce<NormalizedGenericPricingGroup[]>((acc, row) => {
		const lastGroup = acc[acc.length - 1]
		if (lastGroup?.groupLabelKey === row.groupLabelKey) {
			lastGroup.rows.push(row)
			return acc
		}

		acc.push({
			groupLabelKey: row.groupLabelKey,
			rows: [row],
		})
		return acc
	}, [])
}

/** 标准化旧计费类型（旧值兼容） */
const normalizeDeprecatedBillingType = (
	category: AiModel.ServiceProviderCategory | null | undefined,
	rawType: AiManage.BillingType,
): AiManage.PersistBillingType => {
	if (rawType === AiManage.BillingType.ByTokens) {
		return category === AiModel.ServiceProviderCategory.VLM
			? AiManage.BillingType.ImageTokens
			: AiManage.BillingType.TextTokens
	}
	if (rawType === AiManage.BillingType.ByTimes) return AiManage.BillingType.ImageCount
	if (rawType === AiManage.BillingType.ByPerSecond) return AiManage.BillingType.VideoDuration
	return rawType
}

/** 获取默认计费类型（兜底） */
const getDefaultBillingTypeByCategory = (
	category: AiModel.ServiceProviderCategory | null | undefined,
): AiManage.PersistBillingType => {
	switch (category) {
		case AiModel.ServiceProviderCategory.LLM:
			return AiManage.BillingType.TextTokens
		case AiModel.ServiceProviderCategory.VLM:
			return AiManage.BillingType.ImageTokens
		case AiModel.ServiceProviderCategory.VGM:
			return AiManage.BillingType.VideoDuration
		default:
			return AiManage.BillingType.TextTokens
	}
}

/** 标准化计费类型（旧值兼容） */
export const normalizePersistedBillingType = (
	category: AiModel.ServiceProviderCategory | null | undefined,
	rawType?: string | null,
): AiManage.PersistBillingType => {
	// 没有传入计费类型，则使用默认计费类型
	if (!rawType) {
		return getDefaultBillingTypeByCategory(category)
	}

	// 旧值兼容
	if (DEPRECATED_BILLING_TYPES.has(rawType)) {
		return normalizeDeprecatedBillingType(category, rawType as AiManage.BillingType)
	}

	return rawType
}

/** 是否为标准文本 Tokens 模板 */
const isStandardTextTokensTemplate = (rows: NormalizedGenericPricingRow[]) =>
	TEXT_TOKEN_PRICE_FIELDS.every((field) =>
		rows.some(
			(row) =>
				row.priceField === field &&
				row.costField === TEXT_TOKEN_PRICE_TO_COST_OBJECT[field],
		),
	)

const matchTemplateByBillingType = (templates: NormalizedPricingTemplate[], billingType: string) =>
	templates.find(
		(template) =>
			template.persistBillingType === billingType || template.templateCode === billingType,
	)

/** 标准化定价模板 */
export const normalizePricingTemplates = (
	templates: AiManage.ModelPricingTemplate[] | undefined,
	category: AiModel.ServiceProviderCategory,
): NormalizedPricingTemplate[] => {
	if (!templates?.length) return []

	return templates.map((template) => {
		const rowMap = new Map<string, NormalizedGenericPricingRow>()

		for (const item of template.items) {
			const baseBillingObject = resolveBaseBillingObject(item.billing_object)
			const row =
				rowMap.get(baseBillingObject) ??
				({
					key: baseBillingObject,
					displayLabel: item.label,
					groupLabelKey: resolveGroupLabelKey(
						template.billing_type,
						category,
						baseBillingObject,
					),
					unitKey: resolveUnitKey(template.billing_type, category, baseBillingObject),
				} satisfies NormalizedGenericPricingRow)

			if (isCostBillingObject(item.billing_object)) {
				row.costField = item.billing_object
				row.costLabel = item.label
			} else {
				row.priceField = item.billing_object
				row.priceLabel = item.label
				row.displayLabel = item.label
			}

			rowMap.set(baseBillingObject, row)
		}

		const rows = Array.from(rowMap.values())
		/** 是否支持阶梯定价 */
		const supportsLadder =
			template.billing_type === AiManage.BillingType.TextTokens &&
			category === AiModel.ServiceProviderCategory.LLM &&
			isStandardTextTokensTemplate(rows)

		/** 文本 Tokens 定价项 */
		const tokenItems = supportsLadder
			? TEXT_TOKEN_PRICE_FIELDS.map((field) => {
					const row = rows.find((item) => item.priceField === field)
					return {
						billingObject: field,
						costObject: TEXT_TOKEN_PRICE_TO_COST_OBJECT[field],
						priceLabel: row?.priceLabel ?? row?.displayLabel ?? field,
						costLabel: row?.costLabel ?? `${row?.displayLabel ?? field} Cost`,
						unitKey: "millionTokens",
					}
				})
			: []

		/** 通用定价项 */
		const genericRows = supportsLadder
			? []
			: rows.filter((row) => row.priceField || row.costField)

		return {
			templateCode: template.code,
			templateLabel: template.label,
			persistBillingType: template.billing_type,
			category,
			supportsLadder,
			tokenItems,
			genericGroups: buildGenericGroups(genericRows),
		}
	})
}

/** 根据计费类型查找定价模板 */
export const findPricingTemplateByBillingType = (
	templates: NormalizedPricingTemplate[],
	category: AiModel.ServiceProviderCategory | null | undefined,
	billingType?: string | null,
) => {
	if (!templates.length) return undefined
	if (!billingType) return templates[0]

	// 精确匹配
	const exactMatch = matchTemplateByBillingType(templates, billingType)
	if (exactMatch) return exactMatch

	// 标准化匹配
	const normalizedType = normalizePersistedBillingType(category, billingType)
	if (normalizedType !== billingType) {
		const normalizedMatch = matchTemplateByBillingType(templates, normalizedType)
		if (normalizedMatch) return normalizedMatch
	}

	// 仅用于 LLM 文本 Tokens 模板，精确匹配
	if (
		billingType === AiManage.BillingType.ByTokens &&
		category === AiModel.ServiceProviderCategory.LLM
	) {
		return templates.find((template) => template.supportsLadder) ?? templates[0]
	}

	// 兜底匹配
	return matchTemplateByBillingType(templates, normalizedType) ?? templates[0]
}
