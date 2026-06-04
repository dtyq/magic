import { lazy, memo, useMemo } from "react"
import { Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import { MagicSelect, MagicSuspense } from "@admin-components"
import { AiManage } from "@admin/types/aiManage"
import { useStyles } from "./styles"
import InputPrice from "./components/InputPrice"
import { AiModel } from "@admin/const/aiModel"
import { buildEnabledMap, buildModeMap, buildPricingCascadePatch, buildStepsMap } from "./utils"
import { BillingDimension, TextTokenPriceField } from "../AddModelModal/constant"
import {
	findPricingTemplateByBillingType,
	NormalizedPricingTemplate,
} from "../AddModelModal/pricingTemplate"
import { useMemoizedFn } from "ahooks"

const TokenPricingSection = lazy(() => import("./components/TokenPricingSection"))
const GenericPricingSection = lazy(() => import("./components/GenericPricingSection"))

interface OfficialModelConfigProps {
	category: AiModel.ServiceProviderCategory
	pricingTemplates: NormalizedPricingTemplate[]
	loading?: boolean
}

const OfficialModelConfig = ({
	category,
	pricingTemplates,
	loading = false,
}: OfficialModelConfigProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()

	const form = Form.useFormInstance()
	const rawConfig = Form.useWatch(["config"], form)
	const watchedConfig = useMemo(() => rawConfig ?? {}, [rawConfig])
	const currency = watchedConfig.billing_currency

	const currencyOptions = useMemo(
		() => [
			{ label: t("CNY"), value: AiManage.BillingCurrency.CNY },
			{ label: t("USD"), value: AiManage.BillingCurrency.USD },
		],
		[t],
	)

	const templateOptions = useMemo(
		() =>
			pricingTemplates.map((template) => ({
				label: template.templateLabel,
				value: template.persistBillingType,
			})),
		[pricingTemplates],
	)

	const addonBefore = useMemo(
		() => (currency === AiManage.BillingCurrency.CNY ? "CNY ¥" : "USD $"),
		[currency],
	)

	const currentTemplate = useMemo(
		() =>
			findPricingTemplateByBillingType(
				pricingTemplates,
				category,
				watchedConfig.billing_type,
			),
		[pricingTemplates, category, watchedConfig.billing_type],
	)

	/** mode 变更后的级联联动 */
	const handlePricingModeChange = useMemoizedFn(
		(
			changedField: TextTokenPriceField,
			dimension: BillingDimension,
			nextMode: AiManage.PricingMode,
		) => {
			const currentConfig = form.getFieldValue(["config"]) ?? {}
			const { modePatch, stepsPatch, resetFields } = buildPricingCascadePatch({
				changedField,
				dimension,
				previousModes: buildModeMap(currentConfig, dimension),
				previousStepsMap: buildStepsMap(currentConfig, dimension),
				previousEnabledMap: buildEnabledMap(currentConfig, dimension),
				nextMode,
			})

			if (!Object.keys(modePatch).length && !Object.keys(stepsPatch).length) return

			form.setFieldsValue({
				config: {
					...modePatch,
					...stepsPatch,
				},
			})
			if (resetFields.length) {
				message.warning(t("form.followPricingSourceFixedFallback"))
			}
		},
	)

	/** enabled 变更后的级联联动 */
	const handlePricingEnabledChange = useMemoizedFn(
		(changedField: TextTokenPriceField, dimension: BillingDimension, nextEnabled: boolean) => {
			const currentConfig = form.getFieldValue(["config"]) ?? {}
			const { modePatch, stepsPatch, resetFields } = buildPricingCascadePatch({
				changedField,
				dimension,
				previousModes: buildModeMap(currentConfig, dimension),
				previousStepsMap: buildStepsMap(currentConfig, dimension),
				previousEnabledMap: buildEnabledMap(currentConfig, dimension),
				nextEnabled,
			})

			if (!Object.keys(modePatch).length && !Object.keys(stepsPatch).length) return

			form.setFieldsValue({
				config: {
					...modePatch,
					...stepsPatch,
				},
			})

			if (resetFields.length) {
				message.warning(t("form.followPricingSourceDisabledFallback"))
			}
		},
	)

	const renderTokenPricingSections = (dimension: BillingDimension) => {
		if (!currentTemplate?.supportsLadder) return null

		return currentTemplate.tokenItems.map((item) => (
			<TokenPricingSection
				key={`${item.billingObject}-${dimension}`}
				field={item.billingObject}
				dimension={dimension}
				label={dimension === "price" ? item.priceLabel : item.costLabel}
				addonBefore={addonBefore}
				onModeChange={handlePricingModeChange}
				onEnabledChange={handlePricingEnabledChange}
			/>
		))
	}

	return (
		<Flex gap={10} vertical className={styles.officialModelConfig}>
			<div className={styles.title}>{t("form.officialModelConfig")}</div>
			{/* 负载权重 */}
			<InputPrice
				name="load_balancing_weight"
				label={t("form.loadWeight")}
				desc={t("form.loadWeightDesc")}
				rules={[{ required: false, message: "" }]}
				withSwitch={false}
				inputNumberProps={{
					min: 0,
					max: 100,
					precision: 0,
					placeholder: t("form.loadWeightPlaceholder"),
				}}
			/>

			{/* 官方模型费用 */}
			<div className={styles.title}>{t("form.officialModelPrice")}</div>

			{/* 计费货币 */}
			<Form.Item
				label={t("form.currency")}
				className={styles.formItem}
				name={["config", "billing_currency"]}
				initialValue={AiManage.BillingCurrency.CNY}
				rules={[{ required: true, message: "" }]}
			>
				<MagicSelect
					options={currencyOptions}
					getPopupContainer={(triggerNode) =>
						triggerNode.parentElement.parentElement ?? document.body
					}
				/>
			</Form.Item>

			{/* 计费类型 */}
			<Form.Item
				label={t("form.pricingTemplate")}
				className={styles.formItem}
				name={["config", "billing_type"]}
			>
				<MagicSelect
					options={templateOptions}
					disabled={loading || !templateOptions.length}
					placeholder={t("form.pleaseSelectPricingTemplate")}
				/>
			</Form.Item>

			{loading && <div className={styles.desc}>{t("form.pricingTemplateLoading")}</div>}
			{!loading && !templateOptions.length && (
				<div className={styles.desc}>{t("form.pricingTemplateEmpty")}</div>
			)}

			{/* 文本 Tokens 定价项，阶梯定价 */}
			{currentTemplate?.supportsLadder && (
				<MagicSuspense>
					{renderTokenPricingSections("price")}
					{renderTokenPricingSections("cost")}
				</MagicSuspense>
			)}

			{/* 通用定价项 */}
			{currentTemplate && !currentTemplate.supportsLadder && (
				<MagicSuspense>
					<GenericPricingSection
						groups={currentTemplate.genericGroups}
						addonBefore={addonBefore}
					/>
				</MagicSuspense>
			)}
		</Flex>
	)
}

export default memo(OfficialModelConfig)
