import { memo, useMemo } from "react"
import type { FormItemProps } from "antd"
import { Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicInputNumberProps } from "components"
import { MagicInputNumber, MagicSwitch, MagicSelect } from "components"
import { get } from "lodash-es"
import { AiManage } from "@/types/aiManage"
import { useStyles } from "../AddModelModal/styles"

interface InputPriceProps extends FormItemProps {
	desc?: string
	inputNumberProps: MagicInputNumberProps
	withSwitch?: boolean
}

const InputPrice = ({
	name,
	label,
	desc,
	inputNumberProps,
	withSwitch = true,
	...rest
}: InputPriceProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()

	// 生成开关字段名，例如 input_pricing_enabled
	const switchName = withSwitch
		? Array.isArray(name)
			? [...name.slice(0, -1), `${name[name.length - 1]}_enabled`]
			: `${name}_enabled`
		: undefined

	return (
		<Form.Item
			label={
				<Flex gap={10} align="center">
					{label}
					{withSwitch && (
						<Form.Item name={switchName} noStyle valuePropName="checked" initialValue>
							<MagicSwitch size="small" />
						</Form.Item>
					)}
				</Flex>
			}
			className={styles.formItem}
		>
			<Form.Item
				noStyle
				shouldUpdate={(prevValues, currentValues) => {
					const prevSwitchValue = get(prevValues, switchName)
					const currentSwitchValue = get(currentValues, switchName)

					return prevSwitchValue !== currentSwitchValue
				}}
			>
				{({ getFieldValue }) => {
					const isEnabled = withSwitch
						? Array.isArray(switchName)
							? getFieldValue(switchName[0])?.[switchName[1]]
							: getFieldValue(switchName)
						: false

					return (
						<Flex gap={6} vertical>
							<Form.Item
								name={name}
								style={{ marginBottom: 0 }}
								rules={isEnabled ? [{ required: true, message: "" }] : []}
								{...rest}
							>
								<MagicInputNumber
									placeholder={t("form.pleaseInputPrice")}
									style={{ width: "100%" }}
									disabled={withSwitch && !isEnabled}
									{...inputNumberProps}
								/>
							</Form.Item>
							{desc && <div className={styles.desc}>{desc}</div>}
						</Flex>
					)
				}}
			</Form.Item>
		</Form.Item>
	)
}

interface OfficialModelConfigProps {
	isLLM?: boolean
}
/** 官方模型配置 */
const OfficialModelConfig = ({ isLLM }: OfficialModelConfigProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()

	const form = Form.useFormInstance()
	const billingType = Form.useWatch(["config", "billing_type"], form)
	const currency = Form.useWatch(["config", "billing_currency"], form)

	// const { AIManageApi } = useApis()
	// const [packageOptions, setPackageOptions] = useState<DefaultOptionType[]>([])

	// const params: AiManage.GetProductListWithSkuParams = {
	// 	category: 1,
	// 	page: 1,
	// 	page_size: 50,
	// }

	// const { run: getProductList } = useRequest(
	// 	(arg: AiManage.GetProductListWithSkuParams) => AIManageApi.getProductListWithSku(arg),
	// 	{
	// 		manual: true,
	// 		onSuccess: (res) => {
	// 			const options = res?.list?.map((item) => ({
	// 				label: item.product.name,
	// 				enable: item.product.enable,
	// 				value: item.product.id,
	// 			}))
	// 			setPackageOptions(options)
	// 		},
	// 	},
	// )

	// useMount(() => {
	// 	getProductList(params)
	// })

	const currencyOptions = useMemo(() => {
		return [
			{ label: t("CNY"), value: AiManage.BillingCurrency.CNY },
			{ label: t("USD"), value: AiManage.BillingCurrency.USD },
		]
	}, [t])

	const billingTypeOptions = useMemo(() => {
		return [
			{ label: t("form.byTokens"), value: AiManage.BillingType.ByTokens },
			{ label: t("form.byTimes"), value: AiManage.BillingType.ByTimes },
		]
	}, [t])

	const addonBefore = useMemo(() => {
		return currency === AiManage.BillingCurrency.CNY ? "CNY ¥" : "USD $"
	}, [currency])

	return (
		<Flex gap={10} vertical className={styles.officialModelConfig}>
			<div className={styles.title}>{t("form.officialModelConfig")}</div>
			{/* 可用套餐 */}
			{/* <Form.Item label={t("form.packageAvailability")} className={styles.formItem}>
				<Flex gap={6} vertical>
					<Form.Item name="visible_packages" noStyle>
						<SearchSelect
							mode="multiple"
							placeholder={t("form.packageAvailabilityPlaceholder")}
							options={packageOptions}
							maxTagCount={2}
							showAvatar={false}
							showSearch
							filterOption={(input, option) =>
								(option?.label ?? "")
									.toString()
									.toLowerCase()
									.includes(input.toLowerCase())
							}
							tagClassName={styles.tag}
							optionRender={(option) => {
								return (
									<span>
										{`[${option.data.enable ? t("enable") : t("disable")}] ${
											option.data.label
										}`}
									</span>
								)
							}}
						/>
					</Form.Item>
					<div className={styles.desc}>{t("form.packageAvailabilityDesc")}</div>
				</Flex>
			</Form.Item> */}
			{/* 应用可用性 */}
			{/* <Form.Item
				label={t("form.applicationAvailability")}
				className={styles.formItem}
				name="visible_applications"
			>
				<Input placeholder={t("form.applicationAvailabilityPlaceholder")} />
			</Form.Item> */}
			{/* 展示优先级 */}
			{/* <Form.Item label={t("form.sort")} name="sort" className={styles.formItem}>
				<MagicInputNumber
					min={0}
					precision={0}
					placeholder={t("form.sortPlaceholder")}
					type="number"
					style={{ width: "100%" }}
				/>
			</Form.Item> */}

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
			>
				<MagicSelect options={currencyOptions} />
			</Form.Item>

			{!isLLM && (
				<>
					{/* 计费方式 */}
					<Form.Item
						label={t("form.billingType")}
						className={styles.formItem}
						name={["config", "billing_type"]}
						initialValue={AiManage.BillingType.ByTokens}
					>
						<MagicSelect options={billingTypeOptions} />
					</Form.Item>
					{/* 计费单价 */}
					<Form.Item
						label={t("form.billingPrice")}
						className={styles.formItem}
						name={["config", "time_pricing"]}
						hidden={billingType !== AiManage.BillingType.ByTimes}
					>
						<MagicInputNumber
							placeholder={t("form.pleaseInputPrice")}
							style={{ width: "100%" }}
							addonBefore={addonBefore}
							stringMode
						/>
					</Form.Item>
					{/* 计费成本 */}
					<Form.Item
						label={t("form.billingCost")}
						className={styles.formItem}
						name={["config", "time_cost"]}
						hidden={billingType !== AiManage.BillingType.ByTimes}
					>
						<MagicInputNumber
							placeholder={t("form.pleaseInputPrice")}
							style={{ width: "100%" }}
							addonBefore={addonBefore}
							stringMode
						/>
					</Form.Item>
				</>
			)}

			{(isLLM || billingType === AiManage.BillingType.ByTokens) && (
				<>
					{/* 输入定价 */}
					<InputPrice
						label={t("form.inputPrice")}
						desc={t("form.inputPriceDesc")}
						name={["config", "input_pricing"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>

					{/* 输出定价 */}
					<InputPrice
						label={t("form.outputPrice")}
						desc={t("form.outputPriceDesc")}
						name={["config", "output_pricing"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>

					{/* 缓存写入定价 */}
					<InputPrice
						label={t("form.cacheWritePrice")}
						desc={t("form.cacheWritePriceDesc")}
						name={["config", "cache_write_pricing"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>
					{/* 缓存命中定价 */}
					<InputPrice
						label={t("form.cacheHitPrice")}
						desc={t("form.cacheHitPriceDesc")}
						name={["config", "cache_hit_pricing"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>
					{/* 输入成本 */}
					<InputPrice
						label={t("form.inputCost")}
						name={["config", "input_cost"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>

					{/* 输出成本 */}
					<InputPrice
						label={t("form.outputCost")}
						name={["config", "output_cost"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>

					{/* 缓存写入成本 */}
					<InputPrice
						label={t("form.cacheWriteCost")}
						name={["config", "cache_write_cost"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>
					{/* 缓存命中成本 */}
					<InputPrice
						label={t("form.cacheHitCost")}
						name={["config", "cache_hit_cost"]}
						inputNumberProps={{
							addonBefore,
							min: 0,
							addonAfter: t("millionTokens"),
							stringMode: true,
						}}
					/>
				</>
			)}
		</Flex>
	)
}

export default memo(OfficialModelConfig)
