import { memo, useEffect, useMemo, useState } from "react"
import { Checkbox, Flex, Form } from "antd"
import type { Lang } from "components"
import { isEqual } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { PlatformPackage } from "@/types/platformPackage"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import type { SubscriptGroupLangConfig } from "../../const"
import { useGetStyles } from "../../index.page"
import SubscriptionItem from "./SubscriptionItem"

interface SubscriptGroupProps {
	packageDetail?: PlatformPackage.PackageDetail
	langConfig?: SubscriptGroupLangConfig
	errors: Record<string, Record<string, boolean>>
	packageOptions?: PlatformPackage.PackageConstantOptions
	setLangConfig?: React.Dispatch<React.SetStateAction<SubscriptGroupLangConfig>>
}

const SubscriptGroup = memo(
	({ packageDetail, langConfig, setLangConfig, errors, packageOptions }: SubscriptGroupProps) => {
		const { t } = useTranslation("admin/platform/manage")
		const isMobile = useIsMobile()
		const styles = useGetStyles()

		const [types, setTypes] = useState<PlatformPackage.SubscriptionType[]>([
			PlatformPackage.SubscriptionType.Monthly,
		])

		useEffect(() => {
			if (!packageDetail) return
			setTypes(packageDetail.skus?.map((item) => item.attributes.subscription_type))
		}, [packageDetail])

		const updateLangConfig = useMemoizedFn(
			(
				subscriptionType: PlatformPackage.SubscriptionType,
				key: "name_i18n" | "description_i18n",
				value: Lang,
			) => {
				setLangConfig?.((prev) => ({
					...prev,
					[subscriptionType]: {
						...prev?.[subscriptionType],
						[key]: {
							...prev?.[subscriptionType]?.[key],
							...value,
						},
					},
				}))
			},
		)

		const onTypeChange = (value: PlatformPackage.SubscriptionType[]) => {
			setTypes(value)
			value.forEach((type) => {
				// 如果订阅设置多语言中没有该订阅类型，则初始化名称和描述
				if (!langConfig?.[type]) {
					updateLangConfig(type, "name_i18n", {
						zh_CN: "",
						en_US: "",
					})
					updateLangConfig(type, "description_i18n", {
						zh_CN: "",
						en_US: "",
					})
				}
			})
		}

		/**  已存在的订阅禁用积分分配方式 */
		const disabledDistributionMethod = useMemo(() => {
			if (!packageDetail) return {}
			return packageDetail.skus.reduce(
				(acc, item) => {
					acc[item.attributes.subscription_type] = true
					return acc
				},
				{} as Record<string, boolean>,
			)
		}, [packageDetail])

		// 预计算 skuId 映射，避免重复查找
		const skuIdMap = useMemo(() => {
			if (!packageDetail?.skus) return {}
			return packageDetail.skus.reduce(
				(acc, item) => {
					acc[item.attributes.subscription_type] = item.id || ""
					return acc
				},
				{} as Record<string, string>,
			)
		}, [packageDetail])

		const subscriptionOptions = useMemo(
			() => [
				{
					label: t("monthlySubscription"),
					value: PlatformPackage.SubscriptionType.Monthly,
				},
				{
					label: t("yearlySubscription"),
					value: PlatformPackage.SubscriptionType.Yearly,
				},
				{
					label: t("permanentSubscription"),
					value: PlatformPackage.SubscriptionType.Permanent,
				},
			],
			[t],
		)

		return (
			<Flex vertical className={styles.packageInfo}>
				<Form.Item
					name={["skus", "attributes", "subscription_type"]}
					noStyle
					initialValue={[PlatformPackage.SubscriptionType.Monthly]}
					rules={[{ required: true, message: "" }]}
				>
					<Checkbox.Group
						defaultValue={[PlatformPackage.SubscriptionType.Monthly]}
						onChange={onTypeChange}
					>
						<Flex vertical gap={10} flex={1}>
							{subscriptionOptions.map((item) => {
								const subscriptionType = item.value
								const isVisible = types.includes(subscriptionType)

								return (
									<Flex
										gap={isMobile ? 10 : 50}
										className={styles.checkbox}
										vertical={!!isMobile}
										align="flex-start"
										key={item.value}
									>
										<Checkbox value={item.value}>{item.label}</Checkbox>
										{isVisible && (
											<SubscriptionItem
												subscriptionType={subscriptionType}
												skuId={skuIdMap[subscriptionType] || ""}
												langConfig={langConfig?.[subscriptionType]}
												errors={errors[subscriptionType]}
												packageOptions={packageOptions}
												updateLangConfig={updateLangConfig}
												disabledDistributionMethod={
													disabledDistributionMethod?.[subscriptionType]
												}
											/>
										)}
									</Flex>
								)
							})}
						</Flex>
					</Checkbox.Group>
				</Form.Item>
			</Flex>
		)
	},
	(prevProps, nextProps) => {
		// 自定义比较函数，只在关键属性变化时才重新渲染
		return (
			isEqual(prevProps.langConfig, nextProps.langConfig) &&
			isEqual(prevProps.errors, nextProps.errors) &&
			isEqual(prevProps.packageOptions, nextProps.packageOptions) &&
			prevProps.packageDetail?.product.id === nextProps.packageDetail?.product.id
		)
	},
)

export default SubscriptGroup
