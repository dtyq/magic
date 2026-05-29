import { memo, useEffect, useMemo } from "react"
import { Alert, Flex, Form } from "antd"
import { AiManage } from "@admin/types/aiManage"
import { useTranslation } from "react-i18next"
import { MagicInputNumber, MagicSelect, MagicSwitch } from "@admin-components"
import { useStyles } from "../styles"
import {
	buildIndependentLadderSteps,
	getPricingStepsField,
	isFollowPricingMode,
	resolveFinalPricingSourceField,
} from "../utils"
import {
	BillingDimension,
	TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE,
	TEXT_TOKEN_PRICE_FIELDS,
	TextTokenPriceField,
} from "../../AddModelModal/constant"
import { DefaultOptionType } from "antd/es/select"
import PricingStepItem from "./PricingStepItem"
import { useTokenPricingSectionState } from "./useTokenPricingSectionState"

interface TokenPricingSectionProps {
	/** 定价字段 */
	field: TextTokenPriceField
	/** 价格还是成本 */
	dimension?: BillingDimension
	/** 标签 */
	label: string
	/** 描述 */
	desc?: string
	/** 前缀 */
	addonBefore: string
	/** mode 变更后的级联联动 */
	onModeChange?: (
		field: TextTokenPriceField,
		dimension: BillingDimension,
		nextMode: AiManage.PricingMode,
	) => void
	/** enabled 变更后的级联联动 */
	onEnabledChange?: (
		field: TextTokenPriceField,
		dimension: BillingDimension,
		nextEnabled: boolean,
	) => void
}

const TokenPricingSection = memo(
	({
		field,
		dimension = "price",
		label,
		desc,
		addonBefore,
		onModeChange,
		onEnabledChange,
	}: TokenPricingSectionProps) => {
		const { t } = useTranslation("admin/ai/model")
		const { styles } = useStyles()
		const form = Form.useFormInstance()
		const {
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
		} = useTokenPricingSectionState({
			field,
			dimension,
			form,
		})
		/** 定价方式选项 */
		const modeOptions = useMemo(() => {
			const options: DefaultOptionType[] = [
				{ label: t("form.fixedPrice"), value: AiManage.PricingMode.Fixed },
				{ label: t("form.tieredPricing"), value: AiManage.PricingMode.Ladder },
			]

			TEXT_TOKEN_PRICE_FIELDS.filter((item) => item !== field).forEach((sourceField) => {
				const sourceMode = modeMap[sourceField]
				const labelKeySuffix =
					sourceField === AiManage.BillingObject.InputToken
						? "Input"
						: sourceField === AiManage.BillingObject.OutputToken
							? "Output"
							: sourceField === AiManage.BillingObject.CacheWriteToken
								? "CacheWrite"
								: "CacheHit"

				options.push({
					label: t(
						`form.follow${labelKeySuffix}Tiered${
							dimension === "cost" ? "Cost" : "Pricing"
						}`,
					),
					value: TEXT_TOKEN_PRICE_FIELD_TO_FOLLOW_MODE[sourceField],
					disabled:
						sourceMode !== AiManage.PricingMode.Ladder || !enabledMap[sourceField],
				})
			})
			return options
		}, [dimension, enabledMap, field, modeMap, t])

		const followSourceDisplayName = useMemo(() => {
			if (!sourceField) return ""
			switch (sourceField) {
				case AiManage.BillingObject.InputToken:
					return dimension === "cost" ? t("form.inputCost") : t("form.inputPrice")
				case AiManage.BillingObject.OutputToken:
					return dimension === "cost" ? t("form.outputCost") : t("form.outputPrice")
				case AiManage.BillingObject.CacheWriteToken:
					return dimension === "cost"
						? t("form.cacheWriteCost")
						: t("form.cacheWritePrice")
				case AiManage.BillingObject.CacheHitToken:
					return dimension === "cost" ? t("form.cacheHitCost") : t("form.cacheHitPrice")
				default:
					return ""
			}
		}, [sourceField, dimension, t])

		const followValueKindLabel =
			dimension === "cost" ? t("form.billingCost") : t("form.billingPrice")

		const rules = useMemo(() => {
			return enabled ? [{ required: true, message: "" }] : []
		}, [enabled])

		useEffect(() => {
			if (!isFollowMode) return
			if (!sourceField) return
			if (sourceField !== field && watchedResolvedSourceSteps === undefined) return

			// 跟随模式下，需要同步源定价步长
			const shouldSyncSteps =
				currentSteps.length !== sourcePricingSteps.length ||
				currentSteps.some((step: { max?: unknown }) => step?.max !== undefined)

			if (!shouldSyncSteps) return

			form.setFieldValue(["config", stepsFieldName], followPricingSteps)
		}, [
			watchedResolvedSourceSteps,
			currentSteps,
			followPricingSteps,
			form,
			isFollowMode,
			sourceField,
			sourcePricingSteps.length,
			stepsFieldName,
			field,
		])

		const handleAddStep = (
			index: number,
			add: (defaultValue?: Record<string, unknown>, insertIndex?: number) => void,
		) => {
			add(
				{
					max: undefined,
					price: undefined,
				},
				index + 1,
			)
		}

		/** 删除一档后，新的最后一档不应保留原「中间档」的 max（最后一档表示无上限） */
		const handleRemoveStep = (index: number, remove: (index: number | number[]) => void) => {
			remove(index)
			const steps = [...(form.getFieldValue(stepsField) ?? [])]
			if (steps.length === 0) return
			const lastIdx = steps.length - 1
			const last = steps[lastIdx]
			const m = last?.max
			if (last != null && m != null && m !== "") {
				steps[lastIdx] = { ...last, max: undefined }
			}
			form.setFieldValue(stepsField, steps)
		}

		const handleModeChange = (nextMode: AiManage.PricingMode) => {
			// 阶梯模式
			if (nextMode === AiManage.PricingMode.Ladder) {
				const nextSteps = buildIndependentLadderSteps(currentSteps, sourcePricingSteps)
				form.setFieldValue(["config", stepsFieldName], nextSteps)
			} else if (isFollowPricingMode(nextMode)) {
				const nextModeMap = {
					...modeMap,
					[field]: nextMode,
				}
				const nextSourceField = resolveFinalPricingSourceField(
					field,
					nextModeMap,
					enabledMap,
				)
				const nextSourceSteps = nextSourceField
					? (form.getFieldValue([
							"config",
							getPricingStepsField(nextSourceField, dimension),
						]) ?? [])
					: []
				const nextFollowSteps = nextSourceSteps.map((_: any, index: number) => ({
					price: currentSteps?.[index]?.price,
				}))
				// 跟随模式，快速同步源定价步长
				form.setFieldValue(["config", stepsFieldName], nextFollowSteps)
			}
			onModeChange?.(field, dimension, nextMode)
		}

		const handleEnabledChange = (nextEnabled: boolean) => {
			onEnabledChange?.(field, dimension, nextEnabled)
		}

		return (
			<Form.Item
				label={
					<Flex gap={10} align="center">
						{label}
						<Form.Item name={enabledField} noStyle valuePropName="checked" initialValue>
							<MagicSwitch size="small" onChange={handleEnabledChange} />
						</Form.Item>
					</Flex>
				}
				className={styles.formItem}
			>
				<Flex vertical gap={6}>
					<Form.Item name={modeField} noStyle initialValue={AiManage.PricingMode.Fixed}>
						<MagicSelect
							className={styles.pricingModeSelect}
							options={modeOptions}
							disabled={!enabled}
							prefix={t("form.pricingMode")}
							onChange={handleModeChange}
						/>
					</Form.Item>

					{isFollowMode && sourceField && (
						<>
							<div className={styles.followPricingHint}>
								{t("form.followPricingModeHint")}
							</div>
							<Alert
								type="info"
								showIcon
								closable
								className={styles.followPricingAlert}
								message={t("form.followPricingModeAlert", {
									sourceLabel: followSourceDisplayName,
									valueLabel: followValueKindLabel,
								})}
							/>
						</>
					)}

					{mode === AiManage.PricingMode.Fixed ? (
						<Form.Item name={valueField} style={{ marginBottom: 0 }} rules={rules}>
							<MagicInputNumber
								className={styles.pricingValueInput}
								placeholder={t("form.pleaseInputPrice")}
								disabled={!enabled}
								addonBefore={addonBefore}
								addonAfter={t("millionTokens")}
								min={0}
								stringMode
							/>
						</Form.Item>
					) : (
						<Form.List name={stepsField}>
							{(fields, { add, remove }) => (
								<PricingStepItem
									fields={fields}
									onAddStep={(index) => handleAddStep(index, add)}
									onRemoveStep={(index) => handleRemoveStep(index, remove)}
									sourcePricingSteps={sourcePricingSteps}
									enabled={enabled}
									isFollowMode={isFollowMode}
									isLadder={isLadder}
									addonBefore={addonBefore}
									priceRules={rules}
								/>
							)}
						</Form.List>
					)}
					{desc && <div className={styles.desc}>{desc}</div>}
				</Flex>
			</Form.Item>
		)
	},
)

export default TokenPricingSection
