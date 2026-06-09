import { Form, FormInstance } from "antd"
import { useMemo } from "react"
import { AiManage } from "@admin/types/aiManage"
import {
	getPricingEnabledField,
	getPricingModeField,
	getPricingStepsField,
	getPricingValueField,
	isFollowPricingMode,
	PricingEnabledMap,
	PricingModeMap,
	resolveFinalPricingSourceField,
} from "../utils"
import { BillingDimension, TextTokenPriceField } from "../../AddModelModal/constant"
import { PricingFormStep } from "../../AddModelModal/utils"

type PricingFieldPath = [string, string]

interface UseTokenPricingSectionStateArgs {
	field: TextTokenPriceField
	dimension: BillingDimension
	form: FormInstance
}

export const useTokenPricingSectionState = ({
	field,
	dimension,
	form,
}: UseTokenPricingSectionStateArgs) => {
	const enabledFieldName = getPricingEnabledField(field, dimension)
	const valueFieldName = getPricingValueField(field, dimension)
	const modeFieldName = getPricingModeField(field, dimension)
	const stepsFieldName = getPricingStepsField(field, dimension)

	const enabledField = useMemo(
		() => ["config", enabledFieldName] as PricingFieldPath,
		[enabledFieldName],
	)
	const valueField = useMemo(
		() => ["config", valueFieldName] as PricingFieldPath,
		[valueFieldName],
	)
	const modeField = useMemo(() => ["config", modeFieldName] as PricingFieldPath, [modeFieldName])
	const stepsField = useMemo(
		() => ["config", stepsFieldName] as PricingFieldPath,
		[stepsFieldName],
	)

	const enabled = Form.useWatch(enabledField, form) ?? true
	const mode = Form.useWatch(modeField, form) ?? AiManage.PricingMode.Fixed
	const watchedSteps = Form.useWatch(stepsField, form)
	const currentSteps = useMemo(() => watchedSteps ?? [], [watchedSteps])

	const inputMode = Form.useWatch(
		["config", getPricingModeField(AiManage.BillingObject.InputToken, dimension)],
		form,
	)
	const outputMode = Form.useWatch(
		["config", getPricingModeField(AiManage.BillingObject.OutputToken, dimension)],
		form,
	)
	const cacheWriteMode = Form.useWatch(
		["config", getPricingModeField(AiManage.BillingObject.CacheWriteToken, dimension)],
		form,
	)
	const cacheHitMode = Form.useWatch(
		["config", getPricingModeField(AiManage.BillingObject.CacheHitToken, dimension)],
		form,
	)

	const inputEnabled = Form.useWatch(
		["config", getPricingEnabledField(AiManage.BillingObject.InputToken, dimension)],
		form,
	)
	const outputEnabled = Form.useWatch(
		["config", getPricingEnabledField(AiManage.BillingObject.OutputToken, dimension)],
		form,
	)
	const cacheWriteEnabled = Form.useWatch(
		["config", getPricingEnabledField(AiManage.BillingObject.CacheWriteToken, dimension)],
		form,
	)
	const cacheHitEnabled = Form.useWatch(
		["config", getPricingEnabledField(AiManage.BillingObject.CacheHitToken, dimension)],
		form,
	)

	/* 对应价格的模式映射 */
	const modeMap = useMemo(
		() =>
			({
				[AiManage.BillingObject.InputToken]: inputMode ?? AiManage.PricingMode.Fixed,
				[AiManage.BillingObject.OutputToken]: outputMode ?? AiManage.PricingMode.Fixed,
				[AiManage.BillingObject.CacheWriteToken]:
					cacheWriteMode ?? AiManage.PricingMode.Fixed,
				[AiManage.BillingObject.CacheHitToken]: cacheHitMode ?? AiManage.PricingMode.Fixed,
			}) as PricingModeMap,
		[inputMode, outputMode, cacheWriteMode, cacheHitMode],
	)

	/* 对应价格的开关映射 */
	const enabledMap = useMemo(
		() =>
			({
				[AiManage.BillingObject.InputToken]: inputEnabled ?? true,
				[AiManage.BillingObject.OutputToken]: outputEnabled ?? true,
				[AiManage.BillingObject.CacheWriteToken]: cacheWriteEnabled ?? true,
				[AiManage.BillingObject.CacheHitToken]: cacheHitEnabled ?? true,
			}) as PricingEnabledMap,
		[inputEnabled, outputEnabled, cacheWriteEnabled, cacheHitEnabled],
	)

	/* 源定价字段 */
	const sourceField = useMemo(
		() => resolveFinalPricingSourceField(field, modeMap, enabledMap),
		[field, modeMap, enabledMap],
	)

	/* 对应价格的源定价步长字段 */
	const resolvedSourceStepsField = useMemo(
		() =>
			sourceField && sourceField !== field
				? (["config", getPricingStepsField(sourceField, dimension)] as PricingFieldPath)
				: (["config", "__unused_source_steps__"] as PricingFieldPath),
		[sourceField, field, dimension],
	)

	/* 要监听的源定价步长字段 */
	const watchedResolvedSourceSteps = Form.useWatch(resolvedSourceStepsField, form)

	/* 对应价格的源定价步长 */
	const sourcePricingSteps = useMemo<PricingFormStep[]>(() => {
		if (!sourceField) return []
		if (sourceField === field) return currentSteps
		return watchedResolvedSourceSteps ?? []
	}, [sourceField, field, currentSteps, watchedResolvedSourceSteps])

	/* 是否为跟随模式 */
	const isFollowMode = isFollowPricingMode(mode)
	/* 是否为阶梯模式 */
	const isLadder = mode === AiManage.PricingMode.Ladder

	/* 跟随模式的定价步长，只保留price字段 */
	const followPricingSteps = useMemo(
		() =>
			sourcePricingSteps.map((_, index: number) => ({
				price: currentSteps?.[index]?.price,
			})),
		[currentSteps, sourcePricingSteps],
	)

	return {
		currentSteps,
		enabled,
		enabledField,
		enabledMap,
		followPricingSteps,
		isFollowMode,
		isLadder,
		mode,
		modeField,
		modeMap,
		sourceField,
		sourcePricingSteps,
		stepsField,
		stepsFieldName,
		valueField,
		watchedResolvedSourceSteps,
	}
}
