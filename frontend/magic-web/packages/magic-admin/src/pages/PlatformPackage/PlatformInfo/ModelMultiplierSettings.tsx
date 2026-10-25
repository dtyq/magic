import { DefaultModelPriceTable } from "./DefaultModelPriceTable"
import { useAdmin } from "@admin/provider/AdminProvider"
import { useApis } from "@admin/apis"
import { useModelPricePreview } from "../../../../../model-billing-reference/use-model-price-preview"
import { Flex, Form } from "antd"
import type { FormInstance } from "antd"
import { useId, useState, type ChangeEvent } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagicButton, MagicInput, MagicSelect, MagicSwitch, SubHeader } from "@admin-components"
import {
	getReferenceAmount,
	areModelMultiplierOverridesValid,
	validateMultiplierSettings,
} from "../../../../../model-billing-reference"
import type { ModelBillingMultiplierSettings } from "../../../../../model-billing-reference"
import { useModelMultiplierStyles } from "./ModelMultiplierSettings.styles"
import { useStyles as usePlatformInfoStyles } from "./styles"

/** 保留旧版表单和权限行为，共享精确预览与配置校验，不计算实际收费。 */
export default function ModelMultiplierSettings({
	form,
	disabled,
}: {
	form: FormInstance
	disabled: boolean
}) {
	const { t } = useTranslation("admin/platform/info")
	const { styles } = useModelMultiplierStyles()
	const { styles: pageStyles, cx } = usePlatformInfoStyles({})
	const [expanded, setExpanded] = useState(false)
	const admin = useAdmin()
	const { PlatformInfoApi } = useApis()
	const pricePreview = useModelPricePreview(
		JSON.stringify([
			admin.user.userInfo?.magic_id,
			admin.user.userInfo?.user_id,
			admin.organization.organizationCode,
			admin.clusterCode,
			admin.env.MAGIC_BASE_URL,
		]),
		(signal) => PlatformInfoApi.getModelBillingPreview(signal),
		admin.apiClients.magicClient,
	)
	const contentId = useId()
	// 监听该配置组，编辑和刷新时同步预览，不给接口缺失项补默认价格。
	const value = Form.useWatch(["model_billing_multiplier"], { form, preserve: true }) as
		ModelBillingMultiplierSettings | undefined
	const reference = value ? getReferenceAmount(value, !disabled) : null
	const fields = [
		{
			field: "input_price",
			label: t("multiplier.inputPrice"),
			unit:
				value?.currency === "USD"
					? t("multiplier.inputUsdUnit")
					: value?.currency === "CNY"
						? t("multiplier.inputPriceUnit")
						: t("multiplier.inputGenericUnit"),
			placeholder: t("multiplier.inputPlaceholder"),
		},
		{
			field: "output_price",
			label: t("multiplier.outputPrice"),
			unit:
				value?.currency === "USD"
					? t("multiplier.outputUsdUnit")
					: value?.currency === "CNY"
						? t("multiplier.outputPriceUnit")
						: t("multiplier.outputGenericUnit"),
			placeholder: t("multiplier.outputPlaceholder"),
		},
		{
			field: "usd_to_cny_rate",
			label: t("multiplier.exchangeRateLabel"),
			unit: t("multiplier.exchangeRateUnit"),
			placeholder: t("multiplier.ratePlaceholder"),
		},
	] as const
	const rules = [
		[t("multiplier.usageRuleTitle"), t("multiplier.usageRuleDescription")],
		[t("multiplier.averageRuleTitle"), t("multiplier.calculationSteps")],
		[t("multiplier.missingPriceTitle"), t("multiplier.missingPriceDescription")],
		[t("multiplier.priceScopeTitle"), t("multiplier.priceScopeDescription")],
		[t("multiplier.dynamicModelTitle"), t("multiplier.dynamicModelDescription")],
		[t("multiplier.refreshTitle"), t("multiplier.refreshDescription")],
	]
	return (
		<div className={styles.root}>
			<SubHeader
				title={t("multiplier.title")}
				extra={
					<MagicButton
						type="text"
						size="small"
						aria-expanded={expanded}
						aria-controls={contentId}
						onClick={() => setExpanded((previous) => !previous)}
						icon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					>
						{expanded ? t("multiplier.collapse") : t("multiplier.expand")}
					</MagicButton>
				}
			/>
			{/* 保持字段挂载，折叠不会丢失草稿或让全页保存跳过配置校验。 */}
			<div id={contentId} hidden={!expanded}>
				<Flex vertical className={pageStyles.formWrapper}>
					<Form.Item
						name={["model_billing_multiplier", "model_overrides"]}
						hidden
						rules={[
							{
								async validator(_rule, overrides) {
									if (!areModelMultiplierOverridesValid(overrides ?? []))
										throw new Error(t("modelPricePreview.invalidManual"))
								},
							},
						]}
					>
						<input type="hidden" />
					</Form.Item>
					<div className={pageStyles.formItem}>
						<div className={pageStyles.formItemLabel}>{t("multiplier.enabled")}</div>
						<div className={cx(pageStyles.formItemContent, styles.fieldContent)}>
							<Form.Item
								name={["model_billing_multiplier", "enabled"]}
								valuePropName="checked"
								noStyle
							>
								<MagicSwitch
									disabled={disabled}
									aria-label={t("multiplier.enabled")}
								/>
							</Form.Item>
							<p className={styles.fieldHint}>{t("multiplier.enabledHint")}</p>
						</div>
					</div>

					<div className={pageStyles.formItem}>
						<label
							className={pageStyles.formItemLabel}
							htmlFor={`${contentId}-currency`}
						>
							{t("multiplier.currency")}
						</label>
						<div className={cx(pageStyles.formItemContent, styles.fieldContent)}>
							<Form.Item
								className={styles.formField}
								name={["model_billing_multiplier", "currency"]}
								dependencies={[
									["model_billing_multiplier", "enabled"],
									["model_billing_multiplier", "input_price"],
									["model_billing_multiplier", "output_price"],
								]}
								rules={[
									{
										/** 保存时定位缺失币种，折叠状态也保留校验。 */
										async validator() {
											const config = form.getFieldValue([
												"model_billing_multiplier",
											]) as ModelBillingMultiplierSettings
											if (
												config &&
												validateMultiplierSettings(config).includes(
													"currency",
												)
											) {
												setExpanded(true)
												throw new Error(t("multiplier.invalidCurrency"))
											}
										},
									},
								]}
							>
								<MagicSelect
									id={`${contentId}-currency`}
									aria-label={t("multiplier.currency")}
									disabled={disabled}
									style={{ width: "100%" }}
									placeholder={t("multiplier.currencyPlaceholder")}
									options={[
										{ value: "CNY", label: t("multiplier.currencyCny") },
										{ value: "USD", label: t("multiplier.currencyUsd") },
									]}
								/>
							</Form.Item>
							<p className={styles.fieldHint}>{t("multiplier.currencyHint")}</p>
						</div>
					</div>
					{fields.map(({ field, label, unit, placeholder }) => (
						<div key={field} className={pageStyles.formItem}>
							<label
								className={pageStyles.formItemLabel}
								htmlFor={`${contentId}-${field}`}
							>
								{label}
							</label>
							<div className={cx(pageStyles.formItemContent, styles.fieldContent)}>
								<Form.Item
									className={styles.formField}
									name={["model_billing_multiplier", field]}
									extra={unit}
									dependencies={[
										["model_billing_multiplier", "enabled"],
										["model_billing_multiplier", "currency"],
										["model_billing_multiplier", "input_price"],
										["model_billing_multiplier", "output_price"],
									]}
									rules={[
										{
											async validator() {
												const config = form.getFieldValue([
													"model_billing_multiplier",
												]) as ModelBillingMultiplierSettings
												if (
													config &&
													validateMultiplierSettings(config).includes(
														field,
													)
												) {
													// 全页保存遇到隐藏错误时展开该区域，让管理员能直接定位问题。
													setExpanded(true)
													throw new Error(
														t(
															field === "usd_to_cny_rate"
																? "multiplier.invalidAmount"
																: "multiplier.invalidPrices",
														),
													)
												}
											},
										},
									]}
									getValueProps={(amount) => ({ value: amount ?? "" })}
									getValueFromEvent={(event: ChangeEvent<HTMLInputElement>) =>
										event.target.value || null
									}
								>
									<MagicInput
										id={`${contentId}-${field}`}
										aria-label={label}
										inputMode="decimal"
										disabled={disabled}
										placeholder={placeholder}
									/>
								</Form.Item>
							</div>
						</div>
					))}
					<div className={pageStyles.formItem}>
						<div className={pageStyles.formItemLabel}>
							{t("multiplier.referenceAmount")}
						</div>
						<div className={cx(pageStyles.formItemContent, styles.fieldContent)}>
							<output
								data-testid="legacy-multiplier-reference-amount"
								className={styles.amount}
								aria-live="polite"
							>
								{reference ?? "—"} {t("multiplier.cny")}
							</output>
							<p className={styles.fieldHint}>
								{t("multiplier.referenceUsageSummary")}
							</p>
							<p className={styles.fieldHint}>{t("multiplier.previewHint")}</p>
						</div>
					</div>
					<DefaultModelPriceTable
						preview={pricePreview}
						base={reference}
						rate={value?.usd_to_cny_rate ?? null}
						currency={value?.currency}
						enabled={Boolean(value?.enabled)}
						overrides={value?.model_overrides}
						onOverridesChange={
							disabled
								? undefined
								: (overrides) =>
										form.setFieldValue(
											["model_billing_multiplier", "model_overrides"],
											overrides,
										)
						}
					/>
					<section className={styles.section} aria-label={t("multiplier.rulesTitle")}>
						<h4>{t("multiplier.rulesTitle")}</h4>
						<dl className={styles.rules}>
							{rules.map(([title, description]) => (
								<div key={title}>
									<dt>{title}</dt>
									<dd className={styles.muted}>{description}</dd>
								</div>
							))}
						</dl>
					</section>
				</Flex>
			</div>
		</div>
	)
}
