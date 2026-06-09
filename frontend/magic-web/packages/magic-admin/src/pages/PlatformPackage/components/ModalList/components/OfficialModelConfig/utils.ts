import { AiManage } from "@admin/types/aiManage"
import {
	BILLING_OBJECT_TO_LEGACY_COST_FIELD_MAP,
	BillingDimension,
	DEFAULT_PRICING_STEPS,
	TEXT_TOKEN_FOLLOW_MODE_TO_SOURCE_FIELD,
	TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE,
	TextTokenPriceField,
	TEXT_TOKEN_PRICE_FIELDS,
} from "../AddModelModal/constant"

type PricingSteps = Array<{ max?: number | string | null; price?: number | string | null }>
export type PricingModeMap = Record<TextTokenPriceField, AiManage.PricingMode>
export type PricingStepsMap = Record<TextTokenPriceField, PricingSteps>
export type PricingEnabledMap = Record<TextTokenPriceField, boolean>
type PricingFormStepLike = { max?: number | string | null; price?: number | string | null }

export const DIMENSIONS: BillingDimension[] = ["price", "cost"]

/** 获取表单固定值字段名。 */
export const getPricingValueField = (
	field: TextTokenPriceField,
	dimension: BillingDimension = "price",
) => (dimension === "price" ? field : BILLING_OBJECT_TO_LEGACY_COST_FIELD_MAP[field])

/** 获取定价模式表单字段名。 */
export const getPricingModeField = (
	field: TextTokenPriceField,
	dimension: BillingDimension = "price",
) => (dimension === "price" ? `${field}_mode` : `${field}_cost_mode`)

/** 获取定价阶梯表单字段名。 */
export const getPricingStepsField = (
	field: TextTokenPriceField,
	dimension: BillingDimension = "price",
) => (dimension === "price" ? `${field}_steps` : `${field}_cost_steps`)

/** 获取定价开关表单字段名。 */
export const getPricingEnabledField = (field: string, dimension: BillingDimension = "price") =>
	dimension === "price" ? `${field}_enabled` : `${field}_cost_enabled`

/** 判断当前模式是否为“跟随其他对象阶梯”。 */
export const isFollowPricingMode = (mode?: AiManage.PricingMode | null) => {
	return (
		mode === AiManage.PricingMode.FollowInput ||
		mode === AiManage.PricingMode.FollowOutput ||
		mode === AiManage.PricingMode.FollowCacheWrite ||
		mode === AiManage.PricingMode.FollowCacheHit
	)
}

/** 根据跟随模式反查其对应的源定价字段。 */
export const getPricingSourceField = (mode?: AiManage.PricingMode | null) => {
	if (!mode) return undefined
	return TEXT_TOKEN_FOLLOW_MODE_TO_SOURCE_FIELD[mode]
}

/** 根据字段反查其跟随模式。 */
export const getPricingFollowModeByField = (field: TextTokenPriceField) =>
	TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE[field]

/** 构建定价模式映射。 */
export const buildModeMap = (
	watchedConfig: Record<string, any>,
	dimension: BillingDimension,
): PricingModeMap => {
	return TEXT_TOKEN_PRICE_FIELDS.reduce((acc, field) => {
		acc[field] = watchedConfig[getPricingModeField(field, dimension)]
		return acc
	}, {} as PricingModeMap)
}

/** 构建定价开关映射。 */
export const buildEnabledMap = (
	watchedConfig: Record<string, any>,
	dimension: BillingDimension,
): PricingEnabledMap => {
	return TEXT_TOKEN_PRICE_FIELDS.reduce((acc, field) => {
		acc[field] = watchedConfig[getPricingEnabledField(field, dimension)] ?? true
		return acc
	}, {} as PricingEnabledMap)
}

/** 将跟随模式下的价格列表恢复成独立阶梯的完整结构。
 * 切回独立阶梯模式时，需要把“仅价格”的 steps
 * 恢复成“边界 + 价格”的完整阶梯结构，方便后续编辑边界。
 * 处理顺序：
 * 1. 已经是完整阶梯数据：直接复用。
 * 2. 只有价格列表：使用源阶梯边界补齐，并尽量保留用户已填写的价格。
 * 3. 没有任何可用数据：回退到默认阶梯。
 */
export const buildIndependentLadderSteps = (
	currentSteps: PricingFormStepLike[] = [],
	sourcePricingSteps: PricingFormStepLike[] = [],
): PricingFormStepLike[] => {
	const hasCurrentSteps = currentSteps.length > 0
	const hasExplicitBounds = currentSteps.some((step) => step?.max !== undefined)

	if (!hasCurrentSteps) {
		return DEFAULT_PRICING_STEPS
	}

	if (hasExplicitBounds) {
		return currentSteps
	}

	if (sourcePricingSteps.length > 0) {
		return sourcePricingSteps.map((step, index) => ({
			max: step.max ?? undefined,
			price: currentSteps[index]?.price,
		}))
	}

	return DEFAULT_PRICING_STEPS
}

/** 将字段 mode 归一化为最终应该落到表单里的模式。
 * 处理顺序：
 * 1. 非跟随模式：直接返回。
 * 2. 跟随模式：反查其对应的源定价字段，并返回其跟随模式。
 * 3. 如果源定价字段不存在，则返回区间定价
 */
export const resolveEffectivePricingMode = (
	field: TextTokenPriceField,
	modeMap: Partial<Record<TextTokenPriceField, AiManage.PricingMode | undefined>>,
	enabledMap: Partial<Record<TextTokenPriceField, boolean | undefined>> = {},
): AiManage.PricingMode => {
	const mode = modeMap[field]

	if (!isFollowPricingMode(mode)) {
		return mode ?? AiManage.PricingMode.Fixed
	}

	const finalSourceField = resolveFinalPricingSourceField(field, modeMap, enabledMap)
	return finalSourceField
		? getPricingFollowModeByField(finalSourceField)
		: AiManage.PricingMode.Ladder
}

type PricingCascadePatch = {
	modePatch: Partial<Record<string, AiManage.PricingMode>>
	stepsPatch: Partial<Record<string, PricingSteps>>
	resetFields: TextTokenPriceField[]
}

type buildPricingCascadePatchParams = {
	changedField: TextTokenPriceField
	dimension: BillingDimension
	previousModes: PricingModeMap
	previousStepsMap: PricingStepsMap
	previousEnabledMap: PricingEnabledMap
	nextMode?: AiManage.PricingMode
	nextEnabled?: boolean
}

/**
 * 构建一次定价依赖变更后需要级联写回的 patch。
 *
 * 触发入口有两类：
 * 1. `nextMode`: 当前字段的定价模式发生变化，例如 Ladder -> FollowX / FollowX -> Fixed。
 * 2. `nextEnabled`: 当前字段的开关状态发生变化，例如某个作为 source 的阶梯定价被关闭。
 *
 * 处理目标：
 * 1. 先把本次变更合并进 `nextModes` / `nextEnabledMap`，得到“变更后的快照”。
 * 2. 基于这个快照，逐个字段计算“最终应该落到表单里的目标 mode”：
 *    - 仍有合法且启用中的阶梯来源：拍平成最终 FollowX，支持 A -> B -> C。
 *    - 最终来源失效（例如上游改成 Fixed，或上游 Ladder 被关闭）：回退为独立 Ladder。
 * 3. 若某个依赖字段从 Follow 回退成 Ladder，还需要补一份 `stepsPatch`，
 *    将原先“仅价格”的 follow steps 恢复成“边界 + 价格”的完整阶梯结构。
 *
 * 返回值说明：
 * - `modePatch`: 需要回写到 `*_mode` / `*_cost_mode` 的字段。
 * - `stepsPatch`: 仅在 Follow -> Ladder 回退时，额外回写对应的 `*_steps` / `*_cost_steps`。
 * - `resetFields`: 本次因 source 失效而被自动回退的字段，用于上层决定是否提示“请重新配置”。
 */
export const buildPricingCascadePatch = ({
	changedField,
	dimension,
	previousModes,
	previousStepsMap,
	previousEnabledMap,
	nextMode,
	nextEnabled,
}: buildPricingCascadePatchParams): PricingCascadePatch => {
	const nextModes = {
		...previousModes,
	}
	const nextEnabledMap = {
		...previousEnabledMap,
	}
	if (nextMode !== undefined) {
		nextModes[changedField] = nextMode
	}
	if (nextEnabled !== undefined) {
		nextEnabledMap[changedField] = nextEnabled
	}
	const modePatch: PricingCascadePatch["modePatch"] = {}
	const stepsPatch: PricingCascadePatch["stepsPatch"] = {}
	const resetFields: TextTokenPriceField[] = []

	TEXT_TOKEN_PRICE_FIELDS.forEach((field) => {
		// currentMode 表示当前快照中的 mode；targetMode 表示按规则归一化后的最终 mode。
		const currentMode = nextModes[field]
		const targetMode = resolveEffectivePricingMode(field, nextModes, nextEnabledMap)
		if (currentMode === targetMode) return

		// 先记录 mode 变更，并同步更新 nextModes，保证后续字段的推导基于最新快照。
		modePatch[getPricingModeField(field, dimension)] = targetMode
		nextModes[field] = targetMode

		if (
			field !== changedField &&
			isFollowPricingMode(currentMode) &&
			targetMode === AiManage.PricingMode.Ladder
		) {
			resetFields.push(field)
			// 依赖字段从 Follow 回退到独立 Ladder 时，尽量沿用“变更前还能拿到的源边界”，
			// 把仅价格的 follow steps 恢复成完整阶梯，避免表单出现空阶梯。
			const previousSourceField = resolveFinalPricingSourceField(
				field,
				previousModes,
				previousEnabledMap,
			)
			const previousSourceSteps = previousSourceField
				? (previousStepsMap[previousSourceField] ?? [])
				: []
			stepsPatch[getPricingStepsField(field, dimension)] = buildIndependentLadderSteps(
				previousStepsMap[field] ?? [],
				previousSourceSteps,
			)
		}
	})

	return { modePatch, stepsPatch, resetFields }
}

/** 解析字段最终跟随到的可用阶梯来源，遇到 fixed/状态关闭/无效链路/环时返回 undefined。 */
export const resolveFinalPricingSourceField = (
	field: TextTokenPriceField,
	modeMap: Partial<Record<TextTokenPriceField, AiManage.PricingMode | undefined>>,
	enabledMap: Partial<Record<TextTokenPriceField, boolean | undefined>> = {},
	visited = new Set<TextTokenPriceField>(),
): TextTokenPriceField | undefined => {
	if (visited.has(field)) return undefined
	visited.add(field)

	const mode = modeMap[field]
	if (mode === AiManage.PricingMode.Ladder) {
		return (enabledMap[field] ?? true) ? field : undefined
	}

	const sourceField = getPricingSourceField(mode)
	if (!sourceField || sourceField === field) {
		return undefined
	}

	return resolveFinalPricingSourceField(sourceField, modeMap, enabledMap, visited)
}

/** 构建定价阶梯映射。 */
export const buildStepsMap = (
	watchedConfig: Record<string, any>,
	dimension: BillingDimension,
): PricingStepsMap => {
	return TEXT_TOKEN_PRICE_FIELDS.reduce((acc, field) => {
		acc[field] = watchedConfig[getPricingStepsField(field, dimension)] ?? []
		return acc
	}, {} as PricingStepsMap)
}
