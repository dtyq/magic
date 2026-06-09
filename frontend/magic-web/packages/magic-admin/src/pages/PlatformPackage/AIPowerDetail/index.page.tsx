import { Divider, Flex, Form, message, Tooltip } from "antd"
import { ButtonGroup, MagicCard, MagicSwitch, MagicAvatar } from "@admin-components"
import { lazy, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMemoizedFn, useMount, useRequest, useUnmount } from "ahooks"
import { useTranslation } from "react-i18next"
import type { DefaultOptionType } from "antd/es/select"
import { useApis } from "@admin/apis"
import type { PlatformPackage } from "@admin/types/platformPackage"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import useRights from "@admin/hooks/useRights"
import { useIsMobile } from "@admin/hooks/useIsMobile"
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

	const getProviderLabel = (provider: PlatformPackage.ProviderConfig) => {
		return provider.name || toFirstLetterUpperCase(provider.provider)
	}

	const mergeProviderList = (
		apiProviders: PlatformPackage.ProviderConfig | PlatformPackage.ProviderConfig[] | undefined,
		defaultProviders: PlatformPackage.ProviderConfig[],
	) => {
		const apiList = apiProviders
			? Array.isArray(apiProviders)
				? apiProviders
				: [apiProviders]
			: []

		const providerMap = new Map(apiList.map((item) => [item.provider, item] as const))

		for (const defaultProvider of defaultProviders) {
			if (!providerMap.has(defaultProvider.provider)) {
				providerMap.set(defaultProvider.provider, defaultProvider)
			}
		}

		return Array.from(providerMap.values())
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
			const defaultList = DefaultProviderListMap[res.code] || []
			const mergedProviders = mergeProviderList(res.config?.providers, defaultList)

			setData({
				...res,
				icon: hasLogoMap.includes(res.code as keyof typeof AiPowerLogoMap)
					? AiPowerLogoMap[res.code as keyof typeof AiPowerLogoMap]
					: "",
				config: useProvidersConfig
					? {
							...res.config,
							providers: mergedProviders,
					  }
					: res.config,
			})

			// 如果使用 providers 配置结构的工具类型
			if (useProvidersConfig) {
				setProviderList(mergedProviders)
				setProviderOptions(
					mergedProviders.map((item) => ({
						label: getProviderLabel(item),
						value: item.provider,
					})),
				)

				const enabledProvider = mergedProviders.find((item) => item.enable)
				const initialProvider = enabledProvider || mergedProviders[0]
				setSelectedProvider(initialProvider?.provider || "")
				form.setFieldValue(["config", "providers"], initialProvider)
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
			const mergedProviders = mergeProviderList(
				data?.config?.providers,
				DefaultProviderListMap[data?.code || ""] || [],
			)
			const providerConfig =
				mergedProviders.find((item) => item.provider === selectedProvider) ||
				mergedProviders.find((item) => item.enable) ||
				mergedProviders[0]

			setProviderList(mergedProviders)
			form.setFieldValue(["config", "providers"], providerConfig)
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
