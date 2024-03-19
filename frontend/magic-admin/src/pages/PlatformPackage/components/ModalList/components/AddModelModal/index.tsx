import { memo, useEffect, useMemo, useState } from "react"
import { Flex, Form, Input, message } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicModalProps } from "components"
import { LanguageType, MagicModal, MagicSelect, MultiLangSetting } from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useApis } from "@/apis"
import { useAdminStore } from "@/stores/admin"
import { useFormChangeDetection } from "@/hooks/useFormChangeDetection"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useStyles } from "./styles"
import { ModelSelect } from "../ModelSelect"
import { ModelIcons } from "../ModelIcons"
import { pricingUtils, LangConfig } from "./utils"
import OfficialModelConfig from "../OfficialModelConfig"
import LlmModelConfig from "../LlmModelConfig"

interface AddModelModalProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	serviceId?: string
	rawInfo?: AiManage.ModelInfo | null
	category?: AiModel.ServiceProviderCategory | null
	modelType?: AiModel.ModelTypeGroup | null
	actionType?: "edit" | "copy" | "create"
	onOk?: (res: AiManage.ModelInfo, id?: string) => void
}

export const AddModelModal = memo(
	({
		serviceId,
		rawInfo,
		category,
		modelType,
		actionType,
		onOk,
		onCancel,
		afterClose,
		onClose,
		...props
	}: AddModelModalProps) => {
		const { t } = useTranslation("admin/ai/model")
		const { t: tCommon } = useTranslation("admin/common")
		const { styles, cx } = useStyles()

		const { AIManageApi } = useApis()
		const { isOfficialOrg } = useAdminStore()
		const [form] = Form.useForm()

		const [open, setOpen] = useState(true)
		const [selectedIcon, setSelectedIcon] = useState<string>()
		const [icons, setIcons] = useState<AiManage.Icon[]>([])
		const [isSubmitting, setIsSubmitting] = useState(false)
		const [langConfig, setLangConfig] = useState<AiManage.TranslateConfig>(LangConfig)
		const [innerModelType, setInnerModelType] = useState<
			AiModel.ModelTypeGroup | null | undefined
		>(modelType)
		// 模型详情
		const [info, setInfo] = useState<AiManage.ModelInfo | null>(null)

		/* 是否为大语言模型 */
		const isLLM = category === AiModel.ServiceProviderCategory.LLM

		const { run: getIcons } = useRequest(
			() =>
				AIManageApi.getDefaultIcon({
					business_type: AiModel.BusinessType.ServiceProvider,
				}),
			{
				manual: true,
				onSuccess: (res) => {
					/* 默认图标排在第一，type为1的排在最后 */
					const sortRes = res.sort((a, b) => {
						// type为1的排在最后
						if (a.type === 1 && b.type !== 1) return 1
						if (a.type !== 1 && b.type === 1) return -1

						// 默认图标排在前面
						if (a.key.endsWith("default.png")) return -1
						if (b.key.endsWith("default.png")) return 1
						return 0
					})
					setIcons(sortRes)
					setSelectedIcon(sortRes[0].key)
					form.setFieldsValue({
						icon: sortRes[0].key,
					})
				},
			},
		)

		const { run: getModelDetail } = useRequest(
			(id: string) =>
				isOfficialOrg
					? AIManageApi.getModelDetail(id)
					: AIManageApi.getModelDetailNonOfficial(id),
			{
				manual: true,
				onSuccess: (res) => {
					setInfo(res)
				},
			},
		)

		useMount(() => {
			getIcons()
			// 编辑模型时获取模型详情
			if (rawInfo?.id) {
				getModelDetail(rawInfo.id)
			}
			// 复制模型时设置模型详情
			if (rawInfo && actionType === "copy") {
				setInfo(rawInfo)
			}
		})

		// 构建初始值
		const initialFormValues = useMemo(() => {
			if (info) {
				const { config } = info
				const model_power = [
					config.support_function ? AiModel.ModelPower.SupportTool : undefined,
					config.support_multi_modal ? AiModel.ModelPower.SupportVision : undefined,
					config.support_deep_think ? AiModel.ModelPower.SupportThink : undefined,
				].filter(Boolean)

				const pricingEnabledStates = pricingUtils.buildEnabledStates(config)
				return {
					...info,
					id: info.id,
					model_power,
					visible_applications: info?.visible_applications?.join(","),
					translate: info.translate,
					config: {
						...config,
						...pricingEnabledStates,
						temperature_type: info.config.creativity
							? AiModel.ModelTemperatureType.Recommended
							: AiModel.ModelTemperatureType.Fixed,
						temperature: info.config.creativity || info.config.temperature,
					},
				}
			}

			return {
				model_type: modelType ?? AiModel.ModelTypeGroup.LargeLanguageModel,
				icon: icons[0]?.key || "",
				config: {
					billing_currency: AiManage.BillingCurrency.CNY,
					...(isLLM
						? {
								vector_size: 0,
								max_tokens: 128000,
								max_output_tokens: 64000,
								temperature: 0.7,
								temperature_type: AiModel.ModelTemperatureType.Recommended,
						  }
						: {
								billing_type: AiManage.BillingType.ByTokens,
						  }),
					// 默认所有计价开关都关闭
					input_pricing_enabled: true,
					output_pricing_enabled: true,
					cache_write_pricing_enabled: true,
					cache_hit_pricing_enabled: true,
					input_cost_enabled: true,
					output_cost_enabled: true,
					cache_write_cost_enabled: true,
					cache_hit_cost_enabled: true,
				},
				translate: LangConfig,
			}
		}, [info, modelType, icons, isLLM])

		// 使用表单变更检测hook
		const { hasChanges, resetChangeDetection } = useFormChangeDetection({
			form,
			initialValues: initialFormValues,
			options: {
				ignoreFields: ["icon", "translate"],
			},
		})

		// 处理弹窗关闭
		const onInnerCancel = useMemoizedFn((e?: React.MouseEvent<HTMLButtonElement>) => {
			if (hasChanges) {
				MagicModal.confirm({
					centered: true,
					title: tCommon("confirmClose"),
					content: tCommon("unsavedChanges"),
					onOk: () => {
						onCancel?.(e!)
						setOpen(false)
						onClose?.()
					},
				})
			} else {
				onCancel?.(e!)
				setOpen(false)
				onClose?.()
			}
		})

		useEffect(() => {
			form.setFieldsValue(initialFormValues)
			if (info) {
				setLangConfig(info.translate)
				const iconKey = icons.find((i) => i.url === info.icon)?.key
				setSelectedIcon(iconKey)
				setInnerModelType(info.model_type)
			} else if (modelType !== undefined || modelType !== null) {
				form.setFieldsValue({
					model_type: modelType,
				})
				setInnerModelType(modelType)
			}
		}, [form, icons, info, initialFormValues, modelType])

		const handleSelectIcon = (key?: string) => {
			form.setFieldsValue({
				icon: key,
			})
			setSelectedIcon(key)
		}

		const modelTypeOptions = useMemo(
			() =>
				isLLM
					? [
							{
								label: t("form.chatModel"),
								value: AiModel.ModelTypeGroup.LargeLanguageModel,
							},
							{
								label: t("form.EmbeddingModel"),
								value: AiModel.ModelTypeGroup.Embedding,
							},
					  ]
					: [
							{
								label: t("textToImage"),
								value: AiModel.ModelTypeGroup.TextToImage,
							},
							{
								label: t("imageToImage"),
								value: AiModel.ModelTypeGroup.ImageToImage,
							},
							{
								label: t("imageEnhance"),
								value: AiModel.ModelTypeGroup.ImageEnhance,
							},
					  ],
			[t, isLLM],
		)

		const updateLangConfig = useMemoizedFn((key: "name" | "description", value: any) => {
			setLangConfig((prev) => ({
				...prev,
				[key]: { ...prev[key], ...value },
			}))
		})

		// 验证多语言是否同步更新
		const validateMultiLangSync = useMemoizedFn((): Promise<boolean> => {
			return new Promise((resolve) => {
				// 只在编辑模式下检查
				if (!info) {
					resolve(true)
					return
				}

				const hasChineseNameChanged =
					langConfig?.name?.zh_CN &&
					info?.translate?.name?.zh_CN &&
					langConfig.name.zh_CN !== info?.translate?.name?.zh_CN
				const hasEnglishNameChanged =
					langConfig?.name?.en_US &&
					info?.translate?.name?.en_US &&
					langConfig.name.en_US !== info?.translate?.name?.en_US
				const hasChineseDescChanged =
					langConfig?.description?.zh_CN &&
					info?.translate?.description?.zh_CN &&
					langConfig.description.zh_CN !== info?.translate?.description?.zh_CN
				const hasEnglishDescChanged =
					langConfig?.description?.en_US &&
					info?.translate?.description?.en_US &&
					langConfig.description.en_US !== info?.translate?.description?.en_US

				const warnings: string[] = []

				// 检查模型展示名称
				if (
					(hasChineseNameChanged && !hasEnglishNameChanged) ||
					(hasEnglishNameChanged && !hasChineseNameChanged)
				) {
					warnings.push(t("form.pleaseUpdateName"))
				}

				// 检查模型描述
				if (
					(hasChineseDescChanged && !hasEnglishDescChanged) ||
					(hasEnglishDescChanged && !hasChineseDescChanged)
				) {
					warnings.push(t("form.pleaseUpdateDescription"))
				}

				// 如果有警告，显示确认对话框
				if (warnings.length > 0) {
					MagicModal.confirm({
						centered: true,
						title: t("form.multiLangSyncWarningTitle"),
						content: (
							<div>
								{warnings.map((warning) => (
									<div key={warning}>• {warning}</div>
								))}
							</div>
						),
						okText: t("form.multiLangSyncWarningDesc"),
						onOk: () => resolve(true),
						onCancel: () => resolve(false),
					})
				} else {
					resolve(true)
				}
			})
		})

		const onInnerOk = async () => {
			try {
				// 使用防抖处理，避免重复提交
				if (isSubmitting) {
					return
				}
				setIsSubmitting(true)
				const values = await form.validateFields()

				// console.log(values)

				// 验证多语言是否同步更新
				const canContinue = await validateMultiLangSync()
				if (!canContinue) {
					setIsSubmitting(false)
					return
				}

				const visibleOrganizations = values.visible_organizations
					? values.visible_organizations.split(/[，,\s]+/g).filter(Boolean)
					: undefined

				const visibleApplications = values.visible_applications
					? values.visible_applications.split(/[，,\s]+/g).filter(Boolean)
					: undefined
				const newValues = {
					...values,
					id: info?.id,
					category,
					service_provider_config_id: serviceId,
					visible_organizations: visibleOrganizations,
					visible_applications: visibleApplications,
					config: {
						...values.config,
						...(isLLM
							? {
									vector_size: values.config.vector_size || 2048,
									max_tokens: values.config.max_tokens,
									support_function: false,
									support_multi_modal: false,
									support_deep_think: false,
									creativity:
										values.config.temperature_type ===
										AiModel.ModelTemperatureType.Recommended
											? values.config.temperature
											: null,
									temperature:
										values.config.temperature_type ===
										AiModel.ModelTemperatureType.Fixed
											? values.config.temperature
											: null,
							  }
							: {}),

						// 处理计价字段 官方组织需要处理
						...(isOfficialOrg ? pricingUtils.processFields(values.config) : {}),
						// 移除开关字段，不发送到后端 官方组织需要处理
						...(isOfficialOrg ? pricingUtils.removeEnabledFields() : {}),
					},
					translate: langConfig,
				}
				values?.model_power?.forEach((item: AiModel.ModelPower) => {
					switch (item) {
						case AiModel.ModelPower.SupportTool:
							newValues.config.support_function = true
							break
						case AiModel.ModelPower.SupportVision:
							newValues.config.support_multi_modal = true
							break
						case AiModel.ModelPower.SupportThink:
							newValues.config.support_deep_think = true
							break
						default:
							break
					}
				})
				newValues.model_power = undefined

				// console.log(newValues, "newValues")
				const addModelApi = isOfficialOrg
					? AIManageApi.addModel(newValues)
					: AIManageApi.addModelNonOfficial(newValues)

				addModelApi.then((res) => {
					onOk?.(res, newValues.id)
					if (newValues.id) {
						message.success(tCommon("message.updateSuccess"))
					} else {
						message.success(tCommon("message.addSuccess"))
					}

					setOpen(false)
					onClose?.()
				})
			} catch (error) {
				message.error(tCommon("message.saveFailed"))
				console.error("save model error: ", error)
			} finally {
				setIsSubmitting(false)
			}
		}

		const innerAfterClose = () => {
			form.resetFields()
			afterClose?.()
			// 重置变更检测
			resetChangeDetection()
			// 重置所有状态
			setSelectedIcon(icons?.[0]?.key)
			setLangConfig(LangConfig)
			setInnerModelType(undefined)
		}

		const title = useMemo(() => {
			if (info) {
				return actionType === "copy" ? t("form.copyModal") : t("form.editModal")
			}
			return t("form.addModal")
		}, [actionType, info, t])

		return (
			<MagicModal
				centered
				open={open}
				title={title}
				width={600}
				onOk={onInnerOk}
				onCancel={onInnerCancel}
				afterClose={innerAfterClose}
				{...props}
			>
				<Form className={styles.form} colon={false} form={form} requiredMark={false}>
					{/* 模型类型 */}
					<Form.Item
						className={cx(styles.formItem, styles.required)}
						label={t("form.modelType")}
						rules={[{ required: true, message: "" }]}
						name="model_type"
						initialValue={modelTypeOptions[0].value}
					>
						<MagicSelect
							options={modelTypeOptions}
							onChange={(e) => setInnerModelType(e)}
						/>
					</Form.Item>
					{/* 模型标识 */}
					<Form.Item
						className={cx(styles.formItem, styles.required)}
						label={t("form.modelId")}
					>
						<ModelSelect form={form} />
					</Form.Item>
					{/* 模型部署名称 */}
					<Form.Item
						label={t("form.modelName")}
						className={cx(styles.formItem, styles.required)}
					>
						<Flex gap={6} vertical>
							<Form.Item
								name="model_version"
								noStyle
								rules={[{ required: true, message: "" }]}
							>
								<Input placeholder={t("form.modelNamePlaceholder")} />
							</Form.Item>
							<div className={styles.desc}>{t("form.modelNameDesc")}</div>
						</Flex>
					</Form.Item>
					{/* 模型展示图标 */}
					<Form.Item
						name="icon"
						label={t("form.modelDisplayIcon")}
						className={styles.formItem}
						initialValue={selectedIcon}
					>
						<ModelIcons
							icons={icons}
							setIcons={setIcons}
							selectedIcon={selectedIcon}
							handleSelectIcon={handleSelectIcon}
						/>
					</Form.Item>
					{/* 模型展示名称 */}
					<Form.Item label={t("form.modelDisplayName")} className={styles.formItem}>
						<Flex gap={6}>
							<Form.Item
								name="name"
								noStyle
								rules={[{ max: 50, message: t("form.modelNameMax") }]}
							>
								<Input
									placeholder={t("form.modelDisplayNamePlaceholder")}
									onChange={(e) => {
										updateLangConfig("name", {
											zh_CN: e.target.value,
										})
									}}
								/>
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={langConfig.name}
								onSave={(value) => {
									updateLangConfig("name", value)
								}}
							/>
						</Flex>
					</Form.Item>
					{/* 模型描述 */}
					<Form.Item label={t("form.modelDescription")} className={styles.formItem}>
						<Flex gap={6}>
							<Form.Item name="description" noStyle>
								<Input.TextArea
									placeholder={tCommon("pleaseInputPlaceholder", {
										name: t("form.modelDescription"),
									})}
									rows={4}
									onChange={(e) => {
										updateLangConfig("description", {
											zh_CN: e.target.value,
										})
									}}
								/>
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={langConfig.description}
								onSave={(value) => {
									updateLangConfig("description", value)
								}}
							/>
						</Flex>
					</Form.Item>

					{/* LLM模型配置 */}
					{isLLM && <LlmModelConfig innerModelType={innerModelType} form={form} />}

					{/* 官方模型配置 */}
					{isOfficialOrg && <OfficialModelConfig isLLM={isLLM} />}
				</Form>
			</MagicModal>
		)
	},
)
