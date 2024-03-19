import { useEffect, useState, useMemo, forwardRef, useImperativeHandle } from "react"
import { Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { SubHeader } from "components"
import dayjs from "dayjs"
import { useApis } from "@/apis"
import { PlatformPackage } from "@/types/platformPackage"
import BaseInfo from "../BaseInfo"
import SuperMagicGroup from "../SuperMagicGroup"
import InputNumber from "../InputNumber"
import type { LangConfig, SubscriptGroupLangConfig } from "../../const"
import {
	defaultLangConfig,
	defaultSubscriptLangConfig,
	LimitFields,
	SubscriptConfig,
} from "../../const"
import SubscriptGroup from "../SubscriptGroup"
import { GB, TB } from "../CloudStroageInput"
import { useGetStyles } from "../../index.page"

interface BasicTabProps {
	data?: PlatformPackage.PackageDetail
	type?: string | null
}

export interface BasicTabRef {
	onCancel: () => void
	onSave: () => Promise<PlatformPackage.PackageDetail | null>
}

const BasicTab = forwardRef<BasicTabRef, BasicTabProps>(({ data, type }, ref) => {
	const styles = useGetStyles()
	const { t } = useTranslation("admin/platform/manage")
	const { t: tCommon } = useTranslation("admin/common")

	const { PlatformPackageApi } = useApis()

	const form = Form.useFormInstance()

	const [subscriptionConfig, setSubscriptionConfig] = useState<Record<string, any>>({})
	/* 订阅设置多语言 */
	const [subscriptLangConfig, setSubscriptLangConfig] = useState<SubscriptGroupLangConfig>(
		defaultSubscriptLangConfig,
	)
	/* 套餐基础信息多语言 */
	const [langConfig, setLangConfig] = useState<LangConfig>(defaultLangConfig)
	/* 验证多语言错误状态 */
	const [baseInfoErrorState, setBaseInfoErrorState] = useState<Record<string, boolean>>({})
	const [subscriptErrorState, setSubscriptErrorState] = useState<
		Record<string, Record<string, boolean>>
	>({})

	const { run: getPackageOptions, data: packageOptions } = useRequest(
		PlatformPackageApi.getPackageConstantOptions,
		{
			manual: true,
		},
	)

	const formInitialData = useMemo(() => {
		if (!data) return null

		const { product, skus } = data

		// 构建订阅配置，按订阅类型分组
		const newSubscriptionConfig = skus.reduce(
			(acc, item) => {
				const subscriptionType = item.attributes.subscription_type
				// 提取每个订阅类型的配置信息
				acc[subscriptionType] = SubscriptConfig.reduce(
					(acc2, key) => {
						// 安全地访问属性，避免类型错误
						if (key in item) {
							acc2[key] = item[key as keyof PlatformPackage.Skus]
						} else if (key in item.attributes) {
							acc2[key] = item.attributes[key as keyof PlatformPackage.Attributes]
						}
						return acc2
					},
					{} as Record<string, any>,
				)
				return acc
			},
			{} as Record<string, any>,
		)

		// 构建表单初始值，包含所有必要的字段
		const formInitialValues = {
			product,
			skus: {
				attributes: {
					...skus?.[0]?.attributes,
					// 后台存储容量为B，前端显示为GB
					cloud_storage_capacity:
						Number(skus?.[0]?.attributes.cloud_storage_capacity) / GB,
					feature_limits: LimitFields.reduce(
						(acc, key) => {
							const value =
								skus?.[0]?.attributes.feature_limits[
									key as keyof PlatformPackage.FeatureLimits
								]
							if (value === PlatformPackage.NumberLimit.Unlimited) {
								acc[key] = 0
								acc[`${key}_type`] = PlatformPackage.NumberLimit.Unlimited
							} else {
								acc[key] = value
							}
							return acc
						},
						{} as Record<string, any>,
					),
					subscription_type: Object.keys(newSubscriptionConfig),
				},
				...newSubscriptionConfig,
			},
		}

		/* 套餐信息多语言 */
		const langConfigData = {
			name_i18n: data.product.name_i18n,
			description_i18n: data.product.description_i18n,
			subtitle_i18n: data.product.subtitle_i18n,
		}

		/* 订阅设置多语言 */
		const subscriptLangConfigData = skus.reduce((acc, item) => {
			acc[item.attributes.subscription_type] = {
				name_i18n: item.name_i18n,
				description_i18n: item.attributes.description_i18n,
			}
			return acc
		}, {} as SubscriptGroupLangConfig)

		return {
			formValues: formInitialValues,
			subscriptionConfig: newSubscriptionConfig,
			langConfig: langConfigData,
			subscriptLangConfig: subscriptLangConfigData,
		}
	}, [data])

	useMount(() => {
		getPackageOptions()
	})

	// 只在 formInitialData 变化时同步到表单和状态
	useEffect(() => {
		if (!formInitialData) return

		form.setFieldsValue(formInitialData.formValues)
		setSubscriptionConfig(formInitialData.subscriptionConfig)
		setLangConfig(formInitialData.langConfig)
		setSubscriptLangConfig(formInitialData.subscriptLangConfig)
	}, [form, formInitialData])

	useEffect(() => {
		if (type) {
			form.setFieldValue(["skus", "attributes", "plan_type"], type)
		}
	}, [form, type])

	/* 清空错误状态 */
	const clearErrors = useMemoizedFn(() => {
		setBaseInfoErrorState({})
		setSubscriptErrorState({})
	})

	/* 检查套餐信息多语言中具体哪个字段未填写 */
	const getBaseInfoErrors = useMemoizedFn(() => {
		const errors: Record<string, boolean> = {}
		Object.keys(langConfig).forEach((key) => {
			const value = langConfig[key as keyof LangConfig]
			if (["name_i18n"].includes(key)) {
				errors[key] = !(
					value &&
					typeof value === "object" &&
					Object.values(value).every(
						(val) => val && typeof val === "string" && val.trim() !== "",
					)
				)
				return
			}
			errors[key] = false
		})
		return errors
	})

	/* 检查订阅设置多语言中具体哪个字段未填写 */
	const getSubscriptErrors = useMemoizedFn((keys: PlatformPackage.SubscriptionType[]) => {
		const errors: Record<string, Record<string, boolean>> = {}
		Object.keys(subscriptLangConfig).forEach((subscriptionType) => {
			errors[subscriptionType] = {}
			if (!keys.includes(subscriptionType as PlatformPackage.SubscriptionType)) return
			const config = subscriptLangConfig[subscriptionType as PlatformPackage.SubscriptionType]
			Object.keys(config).forEach((key) => {
				const value = config[key as keyof typeof config]
				// 描述不进行必填验证
				if (key === "description_i18n") {
					errors[subscriptionType][key] = false
					return
				}
				errors[subscriptionType][key] = !(
					value &&
					typeof value === "object" &&
					Object.values(value).every(
						(val) => val && typeof val === "string" && val.trim() !== "",
					)
				)
			})
		})
		return errors
	})

	const onSave = useMemoizedFn(async () => {
		try {
			const values = await form.validateFields()
			const { product, skus } = values
			const { attributes } = skus

			const unit = values.cloud_storage_capacity_unit
			const { cloud_storage_capacity: cloudStorageCapacity } = attributes

			const cloud_storage_capacity = (
				unit === "GB"
					? cloudStorageCapacity * GB
					: unit === "TB"
						? cloudStorageCapacity * TB
						: cloudStorageCapacity
			).toString()

			const subscriptionKeys = Object.keys(skus).filter(
				(key) => key !== "attributes",
			) as PlatformPackage.SubscriptionType[]

			// 验证多语言配置是否已填写
			const baseInfoErrors = getBaseInfoErrors()
			const subscriptErrors = getSubscriptErrors(subscriptionKeys)

			// 检查是否有未填写的必填字段
			const hasBaseInfoError = Object.values(baseInfoErrors).some((error) => error)
			const hasSubscriptError = Object.values(subscriptErrors).some((subscriptionErrors) =>
				Object.values(subscriptionErrors).some((error) => error),
			)

			// console.log(
			// 	hasBaseInfoError,
			// 	hasSubscriptError,
			// 	subscriptErrors,
			// 	langConfig,
			// 	subscriptLangConfig,
			// )

			if (hasBaseInfoError || hasSubscriptError) {
				// 设置错误状态，用于组件显示
				setBaseInfoErrorState(baseInfoErrors)
				setSubscriptErrorState(subscriptErrors)
				message.error(tCommon("message.pleaseCompleteRequiredFields"))
				throw new Error("pleaseCompleteRequiredFields")
				// return null
			}

			// 验证通过，清空错误状态
			clearErrors()

			// console.log(values, langConfig, subscriptLangConfig)
			const productId = data ? data.product.id : new Date().getTime().toString()

			const feature_limits = LimitFields.reduce(
				(acc, key) => {
					const typeField = `${key}_type`
					const typeValue = attributes.feature_limits[typeField]

					if (typeValue === PlatformPackage.NumberLimit.Unlimited) {
						acc[key] = PlatformPackage.NumberLimit.Unlimited
					} else if (
						[
							"website_generation_limit",
							"workspace_limit",
							"topic_limit",
							"topic_share_limit",
							"superMagic_project_copy_limit",
						].includes(key)
					) {
						acc[key] = attributes.feature_limits[key].toString()
					} else {
						acc[key] = attributes.feature_limits[key]
					}
					return acc
				},
				{} as Record<string, number | string>,
			)

			const newValues = {
				product: {
					...product,
					id: productId,
					...langConfig,
					category: PlatformPackage.Category.Package,
					created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
				},
				skus: subscriptionKeys.map((key) => {
					const {
						enable,
						price,
						point_settings,
						original_price,
						payment,
						stock,
						currency,
						is_recharge_points,
						subscription_tier,
						platform_products,
					} = skus[key]

					return {
						id: subscriptionConfig?.[key]?.id || "",
						category: PlatformPackage.SubscriptionCategory[key],
						product_id: productId,
						name_i18n: subscriptLangConfig[key].name_i18n,
						enable,
						price,
						currency,
						original_price,
						payment,
						stock,
						platform_products,
						is_stock_managed: false,
						created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),

						attributes: {
							...attributes,
							cloud_storage_capacity,
							sku_type: "subscription",
							subscription_type: key,
							is_paid_plan: price > 0,
							feature_limits,
							point_settings,
							description_i18n: subscriptLangConfig[key].description_i18n,
							is_recharge_points,
							subscription_tier,
						},
					}
				}),
			}
			// console.log(newValues, "newValues")

			return newValues
			// if (data) {
			// 	PlatformPackageApi.updatePackageInfo(data.product.id, newValues).then(() => {
			// 		message.success(tCommon("message.saveSuccess"))
			// 		navigate({ name: RouteName.AdminPackageManage })
			// 	})
			// } else {
			// 	PlatformPackageApi.addPackage(newValues).then(() => {
			// 		message.success(tCommon("message.saveSuccess"))
			// 		navigate({ name: RouteName.AdminPackageManage })
			// 	})
			// }
		} catch (error) {
			return null
		}
	})

	const onCancel = useMemoizedFn(() => {
		if (!formInitialData) return
		form.setFieldsValue(formInitialData.formValues)
		form.setFieldsValue({
			cloud_storage_capacity_unit: "B",
		})
		setLangConfig(formInitialData.langConfig)
		setSubscriptLangConfig(formInitialData.subscriptLangConfig)
	})

	useImperativeHandle(ref, () => ({
		onCancel,
		onSave,
	}))

	return (
		<>
			{/* 套餐信息 */}
			<SubHeader title={t("packageInfo")} />
			<BaseInfo
				productId={data?.product.id}
				langConfig={langConfig}
				setLangConfig={setLangConfig}
				errors={baseInfoErrorState}
				planTypeOptions={packageOptions?.plan_types || []}
			/>

			{/* 套餐设置 */}
			<SubHeader title={t("packageSettings")} />
			<SubscriptGroup
				packageDetail={data}
				langConfig={subscriptLangConfig}
				setLangConfig={setSubscriptLangConfig}
				errors={subscriptErrorState}
				packageOptions={packageOptions}
			/>

			{/* 团队设置 */}
			<SubHeader title={t("teamSetting")} />
			<Flex vertical className={styles.packageInfo} gap={20}>
				<Form.Item label={t("teamMemberLimit")} required className={styles.formItem}>
					<InputNumber
						name={["skus", "attributes", "team_settings", "max_members"]}
						placeholder={t("teamMemberLimitPlaceholder")}
						addonAfter={t("people")}
					/>
					<div className={styles.desc}>{t("teamMemberLimitDesc")}</div>
				</Form.Item>
			</Flex>

			{/* 超级麦吉功能 */}
			<SubHeader title={t("superMagic")} />
			<SuperMagicGroup packageOptions={packageOptions} />
		</>
	)
})

export default BasicTab
