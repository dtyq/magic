import { memo, useCallback, useMemo } from "react"
import { Flex, Form, Radio } from "antd"
import { useTranslation } from "react-i18next"
import type { Lang } from "components"
import { LanguageType, MagicInput, MagicSelect, MagicSwitch, MultiLangSetting } from "components"
import { isEqual } from "lodash-es"
import { PlatformPackage } from "@/types/platformPackage"
import InputNumber from "../InputNumber"
import { useGetStyles } from "../../index.page"

interface SubscriptionItemProps {
	subscriptionType: PlatformPackage.SubscriptionType
	skuId: string
	langConfig?: {
		name_i18n?: Lang
		description_i18n?: Lang
	}
	errors?: Record<string, boolean>
	packageOptions?: PlatformPackage.PackageConstantOptions
	disabledDistributionMethod?: boolean
	updateLangConfig: (
		subscriptionType: PlatformPackage.SubscriptionType,
		key: "name_i18n" | "description_i18n",
		value: Lang,
	) => void
}

const SubscriptionItem = memo(
	({
		subscriptionType,
		skuId,
		langConfig,
		errors,
		packageOptions,
		disabledDistributionMethod,
		updateLangConfig,
	}: SubscriptionItemProps) => {
		const { t } = useTranslation("admin/platform/manage")
		const { t: tCommon } = useTranslation("admin/common")
		const styles = useGetStyles()

		const currencyOptions = useMemo(() => {
			return [
				{ label: "USD", value: "USD" },
				{ label: "CNY", value: "CNY" },
			]
		}, [])

		const subscriptionAttributeOptions = useMemo(() => {
			return [
				{ label: t("paid"), value: PlatformPackage.SubscriptionAttribute.Paid },
				{ label: t("free"), value: PlatformPackage.SubscriptionAttribute.Free },
			]
		}, [t])

		const handleUpdateLangConfig = useCallback(
			(key: "name_i18n" | "description_i18n", value: Lang) => {
				updateLangConfig(subscriptionType, key, value)
			},
			[subscriptionType, updateLangConfig],
		)

		return (
			<Flex vertical flex={1} gap={10}>
				{skuId && (
					<Form.Item label="Sku ID" className={styles.formItem}>
						<MagicInput readOnly placeholder="Sku ID" value={skuId} />
					</Form.Item>
				)}
				<Form.Item
					label={t("appstoreId")}
					name={["skus", subscriptionType, "platform_products", "app_store", "id"]}
					className={styles.formItem}
				>
					<MagicInput placeholder={t("appstoreIdPlaceholder")} />
				</Form.Item>
				<Form.Item label={t("subscriptionName")} required className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item
							name={["skus", subscriptionType, "name_i18n", "zh_CN"]}
							style={{ width: "100%" }}
							rules={[{ required: true, message: "" }]}
							noStyle
						>
							<MagicInput
								placeholder={tCommon("pleaseInputPlaceholder", {
									name: t("subscriptionName"),
								})}
								onChange={(e) => {
									handleUpdateLangConfig("name_i18n", {
										zh_CN: e.target.value,
									})
								}}
							/>
						</Form.Item>
						<MultiLangSetting
							required
							supportLangs={[LanguageType.en_US]}
							danger={errors?.name_i18n}
							info={langConfig?.name_i18n}
							onSave={(value) => {
								handleUpdateLangConfig("name_i18n", value)
							}}
						/>
					</Flex>
				</Form.Item>
				<Form.Item label={t("subscriptionDescription")} className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item
							name={["skus", subscriptionType, "description_i18n", "zh_CN"]}
							style={{ width: "100%" }}
							noStyle
						>
							<MagicInput
								placeholder={tCommon("pleaseInputPlaceholder", {
									name: t("subscriptionDescription"),
								})}
								onChange={(e) => {
									handleUpdateLangConfig("description_i18n", {
										zh_CN: e.target.value,
									})
								}}
							/>
						</Form.Item>
						<MultiLangSetting
							supportLangs={[LanguageType.en_US]}
							info={langConfig?.description_i18n}
							onSave={(value) => {
								handleUpdateLangConfig("description_i18n", value)
							}}
						/>
					</Flex>
				</Form.Item>

				<InputNumber
					name={["skus", subscriptionType, "original_price"]}
					label={t("originalPrice")}
					addonAfter={t("yuan")}
					step={0.01}
					precision={2}
				/>

				<InputNumber
					name={["skus", subscriptionType, "price"]}
					label={t("subscriptionFee")}
					addonAfter={t("yuan")}
					step={0.01}
					precision={2}
				/>

				<Form.Item
					name={["skus", subscriptionType, "currency"]}
					label={t("currencyType")}
					required
					className={styles.formItem}
					rules={[{ required: true, message: "" }]}
				>
					<MagicSelect
						placeholder={tCommon("pleaseSelectPlaceholder", {
							name: t("currencyType"),
						})}
						options={currencyOptions}
					/>
				</Form.Item>

				<InputNumber name={["skus", subscriptionType, "stock"]} label={t("stock")} />

				<Form.Item
					name={["skus", subscriptionType, "point_settings", "distribution_method"]}
					label={t("pointMode")}
					className={styles.formItem}
					required
					rules={[{ required: true, message: "" }]}
				>
					<MagicSelect
						options={packageOptions?.distribution_method || []}
						disabled={disabledDistributionMethod}
					/>
				</Form.Item>

				<InputNumber
					name={["skus", subscriptionType, "point_settings", "points_amount"]}
					label={t("pointAwardNumber")}
					addonAfter={t("point")}
				/>

				<Form.Item
					name={["skus", subscriptionType, "point_settings", "validity"]}
					label={t("pointExpiration")}
					className={styles.formItem}
					required
					rules={[{ required: true, message: "" }]}
				>
					<MagicSelect options={packageOptions?.validity || []} />
				</Form.Item>

				<Form.Item
					name={["skus", subscriptionType, "is_recharge_points"]}
					label={t("isPointRecharge")}
					required
					className={styles.formItem}
					valuePropName="checked"
					initialValue={false}
				>
					<MagicSwitch />
				</Form.Item>
				<Form.Item
					name={["skus", subscriptionType, "enable"]}
					label={t("status")}
					required
					className={styles.formItem}
					valuePropName="checked"
					initialValue={false}
				>
					<MagicSwitch />
				</Form.Item>
				<Form.Item
					name={["skus", subscriptionType, "payment"]}
					label={t("paymentMethod")}
					className={styles.formItem}
					required
					initialValue={PlatformPackage.PaymentMethod.Online}
					rules={[{ required: true, message: "" }]}
				>
					<Radio.Group
						options={packageOptions?.payment_method || []}
						defaultValue={PlatformPackage.PaymentMethod.Online}
					/>
				</Form.Item>
				<Form.Item
					name={["skus", subscriptionType, "subscription_tier"]}
					label={t("subscriptionAttribute")}
					className={styles.formItem}
					required
					initialValue={PlatformPackage.SubscriptionAttribute.Paid}
					rules={[{ required: true, message: "" }]}
				>
					<Radio.Group
						options={subscriptionAttributeOptions}
						defaultValue={PlatformPackage.SubscriptionAttribute.Paid}
					/>
				</Form.Item>
			</Flex>
		)
	},
	(prevProps, nextProps) => {
		return (
			prevProps.subscriptionType === nextProps.subscriptionType &&
			prevProps.skuId === nextProps.skuId &&
			isEqual(prevProps.langConfig, nextProps.langConfig) &&
			isEqual(prevProps.errors, nextProps.errors) &&
			isEqual(prevProps.packageOptions, nextProps.packageOptions) &&
			prevProps.disabledDistributionMethod === nextProps.disabledDistributionMethod
		)
	},
)

export default SubscriptionItem
