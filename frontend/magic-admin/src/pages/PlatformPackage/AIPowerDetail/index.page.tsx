import { Divider, Flex, Form, message, Tooltip } from "antd"
import { ButtonGroup, MagicCard, MagicSwitch, MagicAvatar } from "components"
import { lazy, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMemoizedFn, useMount, useRequest, useUnmount } from "ahooks"
import { useTranslation } from "react-i18next"
import type { DefaultOptionType } from "antd/es/select"
import { useApis } from "@/apis"
import type { PlatformPackage } from "@/types/platformPackage"
import { PERMISSION_KEY_MAP } from "@/const/common"
import useRights from "@/hooks/useRights"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useDetail } from "../hooks/useDetail"
import { useStyles } from "./styles"
import { AiPowerLogoMap, hasLogoMap } from "../AIPower/index.page"
import { DefaultProviderListMap, ServiceConfigList } from "./constants"

const ServiceConfig = lazy(() => import("./components/ServiceConfig"))
const ModelConfig = lazy(() => import("./components/modelConfig"))

function AIPowerDetailPage() {
	const { handleDataLoaded } = useDetail("powerDetail")
	const { t: tCommon } = useTranslation("admin/common")
	const { PlatformPackageApi } = useApis()
	const isMobile = useIsMobile()
	const { styles } = useStyles({ isMobile })

	const { code } = useParams()
	const [form] = Form.useForm()

	const hasEditRight = useRights(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)

	/** 是否使用服务商配置的工具类型 */
	const useProvidersConfig = useMemo(() => {
		return code ? ServiceConfigList.includes(code as PlatformPackage.PowerCode) : false
	}, [code])

	const [data, setData] = useState<PlatformPackage.AiPowerDetail | null>(null)
	const [providerList, setProviderList] = useState<PlatformPackage.ProviderConfig[]>([])
	const [providerOptions, setProviderOptions] = useState<DefaultOptionType[]>([])
	const [selectedProvider, setSelectedProvider] = useState<string>("")

	const toFirstLetterUpperCase = (str: string) => {
		return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""
	}

	const { runAsync: saveDetail, loading: saveLoading } = useRequest(
		PlatformPackageApi.updateAiPower,
		{
			manual: true,
			debounceWait: 300,
			onSuccess: () => {
				message.success(tCommon("message.updateSuccess"))
			},
		},
	)

	const { run } = useRequest(PlatformPackageApi.getAiPowerDetail, {
		manual: true,
		onSuccess(res) {
			setData({
				...res,
				icon: hasLogoMap.includes(res.code as keyof typeof AiPowerLogoMap)
					? AiPowerLogoMap[res.code as keyof typeof AiPowerLogoMap]
					: "",
			})

			const { config } = res
			// 如果使用 providers 配置结构的工具类型
			if (useProvidersConfig) {
				const defaultList = DefaultProviderListMap[res.code] || []

				if (config?.providers) {
					// 支持服务商多个配置
					if (Array.isArray(config.providers)) {
						const list = config.providers
						setProviderList(list)
						setProviderOptions(
							list.map((item) => ({
								label: item.name || toFirstLetterUpperCase(item.provider),
								value: item.provider,
							})),
						)

						// 设置选中的服务商（启用的或第一个）
						const enabledProvider = list.find((item) => item.enable)
						const initialProvider = enabledProvider || list[0]
						setSelectedProvider(initialProvider.provider)
						form.setFieldValue(["config", "providers"], initialProvider)
					} else {
						// 支持服务商单个配置
						setProviderList([config.providers])
						setProviderOptions([
							{
								label:
									config.providers.name ||
									toFirstLetterUpperCase(config.providers.provider),
								value: config.providers.provider,
							},
						])
						setSelectedProvider(config.providers.provider)
						form.setFieldValue(["config", "providers"], config.providers)
					}
				} else {
					// 使用默认配置
					setProviderList(defaultList)
					setProviderOptions(
						defaultList.map((item) => ({
							label: item.name || toFirstLetterUpperCase(item.provider),
							value: item.provider,
						})),
					)
					setSelectedProvider(defaultList[0]?.provider)
					form.setFieldValue(["config", "providers"], defaultList[0])
				}
				form.setFieldValue("status", res.status)
			} else {
				// 其他工具类型，使用原有的配置结构
				form.setFieldsValue({
					...res,
					config: {
						...res.config,
						model_id: res.config.model_id || undefined,
					},
				})
			}

			handleDataLoaded(res.name)
		},
	})

	useMount(() => {
		if (!code) return
		run(code)
	})

	useUnmount(() => {
		handleDataLoaded(null)
	})

	// 监听服务商选择变化，更新表单配置
	const handleProviderChange = (provider: string) => {
		setSelectedProvider(provider)
		const providerConfig = providerList.find((item) => item.provider === provider)
		if (providerConfig) {
			// 更新 providers 字段
			form.setFieldValue(["config", "providers"], providerConfig)
		}
	}

	const title = useMemo(
		() => (
			<Flex justify="space-between" align="center" style={{ flex: 1 }} gap={10}>
				<Tooltip title={data?.name}>
					<div className={styles.ellipsis}>{data?.name}</div>
				</Tooltip>
				<Flex gap={4} align="center" style={{ flexShrink: 0 }}>
					<span className={styles.status}>{tCommon("status")}</span>
					<Form.Item name="status" noStyle>
						<MagicSwitch disabled={!hasEditRight} />
					</Form.Item>
				</Flex>
			</Flex>
		),
		[data?.name, hasEditRight, styles.ellipsis, styles.status, tCommon],
	)

	const onCancel = () => {
		// 如果使用 providers 配置结构的工具类型，恢复配置状态
		if (useProvidersConfig) {
			const defaultList = DefaultProviderListMap[data?.code || ""] || []

			if (data?.config?.providers) {
				const providerConfig = Array.isArray(data.config.providers)
					? data.config.providers.find((item) => item.provider === selectedProvider)
					: data.config.providers
				form.setFieldValue(["config", "providers"], providerConfig)
			} else {
				const providerConfig = defaultList.find(
					(item) => item.provider === selectedProvider,
				)
				form.setFieldValue(["config", "providers"], providerConfig)
			}
			form.setFieldValue("status", data?.status)
		} else {
			form.setFieldsValue(data)
		}
	}

	const onSave = async () => {
		try {
			if (!data?.code) return
			const values = await form.validateFields()

			await saveDetail({
				code: data.code,
				status: values.status ? 1 : 0,
				config: useProvidersConfig
					? {
							providers: providerList.map((item) => ({
								...item,
								enable: item.provider === selectedProvider,
							})),
					  }
					: {
							...values.config,
							model_id: values.config.model_id || "",
					  },
			})
		} catch (error) {
			console.log(error)
		}
	}

	const handleValuesChange = (changedFields: any, allFields: any) => {
		// 如果使用 providers 配置且服务商没有变化，则更新服务商配置
		if (
			useProvidersConfig &&
			!changedFields.config?.providers?.provider &&
			allFields.config?.providers?.provider
		) {
			const currentProvider = allFields.config.providers as PlatformPackage.ProviderConfig
			setProviderList((prev) =>
				prev.map((item) =>
					item.provider === currentProvider.provider
						? { ...item, ...currentProvider }
						: item,
				),
			)
		}
	}

	const onConnectivityTest = useMemoizedFn(async () => {
		if (!code) {
			return {
				status: 0,
				message: "missing power code",
			}
		}
		const res = await PlatformPackageApi.testAiPowerConnection({
			ai_ability: code,
			provider: selectedProvider,
		})

		return {
			...res,
			status: res.success ? 1 : 0,
		}
	})

	return (
		<div className={styles.container}>
			<Form className={styles.cardContainer} form={form} onValuesChange={handleValuesChange}>
				<MagicCard
					style={{ width: "100%" }}
					title={title}
					avatar={<MagicAvatar src={data?.icon}>{data?.name}</MagicAvatar>}
					description={data?.description || ""}
					className={styles.card}
					is2LineClamp={false}
				/>
				<Divider className={styles.divider} />
				{/* 服务商配置 */}
				{useProvidersConfig ? (
					<ServiceConfig
						providerOptions={providerOptions}
						currentProvider={selectedProvider}
						onProviderChange={handleProviderChange}
						onConnectivityTest={onConnectivityTest}
					/>
				) : (
					/* 能力模型 */
					<ModelConfig />
				)}
				{hasEditRight && (
					<ButtonGroup
						className={styles.buttonGroup}
						onCancel={onCancel}
						onSave={onSave}
						okProps={{ loading: saveLoading }}
					/>
				)}
			</Form>
		</div>
	)
}

export default AIPowerDetailPage
