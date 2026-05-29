import { lazy, memo, useEffect, useMemo, useRef, useState } from "react"
import { Flex, Form, Input, message } from "antd"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import type { MagicModalProps } from "@admin-components"
import {
	LanguageType,
	MagicModal,
	MagicSelect,
	MagicSuspense,
	MultiLangSetting,
} from "@admin-components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import { useApis } from "@admin/apis"
import { useAdminStore } from "@admin/stores/admin"
import { useFormChangeDetection } from "@admin/hooks/useFormChangeDetection"
import type { OpenableProps } from "@admin/hooks/useOpenModal"
import { useStyles } from "./styles"
import { ModelSelect } from "../ModelSelect"
import { ModelIcons } from "../ModelIcons"
import {
	getModelTypeGroup,
	buildSubmitPricingConfig,
	normalizeBillingType,
	buildSubmitGenericPricingConfig,
	buildAddModelInitialValues,
} from "./utils"
import { LangConfig } from "./constant"
import { findPricingTemplateByBillingType, normalizePricingTemplates } from "./pricingTemplate"
import { useImportModelConfig } from "./hooks/useImportModelConfig"

const ImportSourcePopover = lazy(() => import("./components/ImportSourcePopover"))
const ImportModelCard = lazy(() => import("./components/ImportModelCard"))
const OfficialModelConfig = lazy(() => import("../OfficialModelConfig"))
const LlmModelConfig = lazy(() => import("../LlmModelConfig"))

interface AddModelModalProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	/* 服务商ID */
	serviceId?: string
	/* 服务商编码 */
	providerCode?: AiModel.ServiceProvider | string
	/* 服务商类别 */
	category?: AiModel.ServiceProviderCategory | null
	/* 模型详情 */
	rawInfo?: AiManage.ModelInfo | null
	/* 模型类型 */
	modelType?: AiModel.ModelTypeGroup | null
	/* 操作类型 */
	actionType?: "edit" | "copy" | "create"
	/* 成功回调 */
	onOk?: (res: AiManage.ModelInfo, id?: string) => void
}

export const AddModelModal = memo(
	({
		serviceId,
		rawInfo,
		category,
		providerCode,
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

		const modalPanelRef = useRef<HTMLDivElement | null>(null)

		const [open, setOpen] = useState(true)
		const [icons, setIcons] = useState<AiManage.Icon[]>([])
		const [isSubmitting, setIsSubmitting] = useState(false)
		const [langConfig, setLangConfig] = useState<AiManage.TranslateConfig>(LangConfig)
		const [apiPricingTemplates, setApiPricingTemplates] = useState<
			AiManage.ModelPricingTemplate[]
		>([])
		const [pricingTemplatesLoaded, setPricingTemplatesLoaded] = useState(false)
		const [initialSnapshot, setInitialSnapshot] = useState<Record<string, any> | null>(null)
		const hasHydratedRef = useRef(false)

		// 模型详情
		const [info, setInfo] = useState<AiManage.ModelInfo | null>(null)
		/* 是否为大语言模型 */
		const isLLM = category === AiModel.ServiceProviderCategory.LLM
		const isCopy = actionType === "copy"
		const isEdit = actionType === "edit"
		const requiresDetail = Boolean(rawInfo?.id && !isCopy)
		const providerCodeToUse = providerCode || info?.provider_code
		/* 是否需要请求定价模板 */
		const shouldRequestPricingTemplates = Boolean(
			isOfficialOrg && category && providerCodeToUse,
		)
		const innerModelType = Form.useWatch(["model_type"], form)
		const selectedIcon = Form.useWatch(["icon"], form)

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

		const { run: getPricingTemplates, loading: pricingTemplatesLoading } = useRequest(
			AIManageApi.getModelPricingTemplates,
			{
				manual: true,
				onSuccess: (res) => {
					setApiPricingTemplates(res)
					setPricingTemplatesLoaded(true)
				},
				onError: () => {
					setPricingTemplatesLoaded(true)
				},
			},
		)

		useMount(() => {
			getIcons()
			// 编辑模型时获取模型详情
			if (rawInfo?.id && !isCopy) {
				getModelDetail(rawInfo.id)
			}
			// 复制模型时设置模型详情
			if (rawInfo && isCopy) {
				setInfo(rawInfo)
			}
		})

		useEffect(() => {
			if (!shouldRequestPricingTemplates || !providerCodeToUse) {
				setPricingTemplatesLoaded(true)
				return
			}

			setPricingTemplatesLoaded(false)
			getPricingTemplates(category!, providerCodeToUse)
		}, [category, getPricingTemplates, providerCodeToUse, shouldRequestPricingTemplates])

		/* 标准化定价模板 */
		const pricingTemplates = useMemo(
			() => (category ? normalizePricingTemplates(apiPricingTemplates, category) : []),
			[apiPricingTemplates, category],
		)

		/* 默认定价模板 */
		const defaultPricingTemplate = useMemo(() => {
			return findPricingTemplateByBillingType(
				pricingTemplates,
				category,
				info?.config?.billing_type,
			)
		}, [pricingTemplates, category, info?.config?.billing_type])

		/* 定价模板是否准备好 */
		const pricingReady =
			!isOfficialOrg || !category || (pricingTemplatesLoaded && !pricingTemplatesLoading)
		/* 模型详情是否准备好 */
		const detailReady = !requiresDetail || !!info
		/* 是否准备好 */
		const hydrationReady = pricingReady && detailReady

		// 构建初始值
		const initialFormValues = useMemo(() => {
			if (!hydrationReady) return null

			return buildAddModelInitialValues({
				info,
				modelType,
				category,
				defaultPricingTemplate,
			})
		}, [hydrationReady, info, modelType, category, defaultPricingTemplate])

		// 使用表单变更检测hook
		const { hasChanges, resetChangeDetection } = useFormChangeDetection({
			form,
			initialValues: initialSnapshot,
			options: {
				enabled: Boolean(initialSnapshot),
				ignoreFields: ["icon", "translate"],
			},
		})

		const {
			selectedModelId,
			importStatus,
			importSourceLoading,
			handleQueryImportSources,
			handleResetToBlank,
			popover: importPopover,
		} = useImportModelConfig({
			form,
			icons,
			category,
			excludeModelId: info?.id,
			modalPanelRef,
			initialFormValues,
			setLangConfig,
			defaultPricingTemplate,
		})

		// 获取模型类型组
		const modelTypeOptions = useMemo(
			() => (isLLM ? getModelTypeGroup(t, category) : []),
			[t, category, isLLM],
		)

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
			if (!initialFormValues || hasHydratedRef.current) return

			form.setFieldsValue(initialFormValues)
			setInitialSnapshot(initialFormValues)
			setLangConfig(initialFormValues.translate ?? LangConfig)
			hasHydratedRef.current = true
		}, [form, initialFormValues])

		useEffect(() => {
			if (!icons.length) return

			const currentIcon = form.getFieldValue("icon")
			const matchedIconKey = info?.icon
				? icons.find((icon) => icon.url === info.icon || icon.key === info.icon)?.key
				: undefined
			const nextIcon = matchedIconKey || currentIcon || icons[0]?.key

			if (!nextIcon || currentIcon === nextIcon) return

			form.setFieldValue("icon", nextIcon)
		}, [form, icons, info?.icon])

		const handleSelectIcon = (key?: string) => {
			form.setFieldValue("icon", key)
		}

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
				if (!isEdit) {
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

		// 构建提交参数
		const buildSubmitPayload = useMemoizedFn((values: any) => {
			const { model_power = [], config = {}, ...restValues } = values
			const modelPowerSet = new Set<AiModel.ModelPower>(model_power)
			const currentPricingTemplate = findPricingTemplateByBillingType(
				pricingTemplates,
				category,
				config.billing_type,
			)

			if (isOfficialOrg && category && !currentPricingTemplate) {
				throw new Error(t("form.pricingTemplateRequired"))
			}

			const billingType =
				currentPricingTemplate?.persistBillingType ??
				normalizeBillingType(category, config.billing_type)

			const pricingConfig = currentPricingTemplate?.supportsLadder
				? buildSubmitPricingConfig(config)
				: buildSubmitGenericPricingConfig(config, currentPricingTemplate)

			const submitConfig = {
				...(isLLM
					? {
							vector_size: config.vector_size || 2048,
							max_tokens: config.max_tokens,
							max_output_tokens: config.max_output_tokens,
							support_function: modelPowerSet.has(AiModel.ModelPower.SupportTool),
							support_multi_modal: modelPowerSet.has(
								AiModel.ModelPower.SupportVision,
							),
							support_deep_think: modelPowerSet.has(AiModel.ModelPower.SupportThink),
							creativity:
								config.temperature_type === AiModel.ModelTemperatureType.Recommended
									? config.temperature
									: null,
							temperature:
								config.temperature_type === AiModel.ModelTemperatureType.Fixed
									? config.temperature
									: null,
						}
					: {}),
				billing_currency: config.billing_currency,
				billing_type: billingType,
				...pricingConfig,
			}

			return {
				...restValues,
				...(isEdit && info?.id ? { id: info.id } : {}),
				category,
				service_provider_config_id: serviceId,
				config: submitConfig,
				translate: langConfig,
			}
		})

		const scrollToFirstError = useMemoizedFn((error: unknown) => {
			const firstErrorField = (
				error as { errorFields?: Array<{ name: (string | number)[] }> }
			)?.errorFields?.[0]

			if (!firstErrorField?.name) {
				return false
			}

			form.scrollToField(firstErrorField.name, {
				behavior: "smooth",
				block: "center",
				focus: true,
			})

			return true
		})

		const onInnerOk = async () => {
			if (isSubmitting) return

			let validationPassed = false
			try {
				setIsSubmitting(true)
				const values = await form.validateFields()
				validationPassed = true
				// console.log(values)

				// 验证多语言是否同步更新
				const canContinue = await validateMultiLangSync()
				if (!canContinue) {
					return
				}

				const payload = buildSubmitPayload(values)
				// console.log(newValues, "newValues")
				const res = await (isOfficialOrg
					? AIManageApi.addModel(payload)
					: AIManageApi.addModelNonOfficial(payload))

				onOk?.(res, isEdit ? info?.id : undefined)
				message.success(tCommon(isEdit ? "message.updateSuccess" : "message.addSuccess"))
				importPopover.onClose()
				setOpen(false)
				onClose?.()
			} catch (error) {
				if (!validationPassed && scrollToFirstError(error)) {
					return
				}

				if (error instanceof Error && error.message) {
					message.error(error.message)
					return
				}

				message.error(tCommon("message.saveFailed"))
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
			setLangConfig(LangConfig)
			setInitialSnapshot(null)
			setPricingTemplatesLoaded(!shouldRequestPricingTemplates)
			hasHydratedRef.current = false
		}

		const title = useMemo(() => {
			if (info) {
				return isCopy ? t("form.copyModal") : t("form.editModal")
			}
			return t("form.addModal")
		}, [isCopy, info, t])

		return (
			<>
				<MagicModal
					centered
					open={open}
					title={title}
					width={860}
					onOk={onInnerOk}
					onCancel={onInnerCancel}
					afterClose={innerAfterClose}
					{...props}
					panelRef={modalPanelRef}
				>
					<Form className={styles.form} colon={false} form={form} requiredMark={false}>
						{isOfficialOrg && (
							<MagicSuspense>
								<ImportModelCard
									form={form}
									selectedModelId={selectedModelId}
									importSourceLoading={importSourceLoading}
									importStatus={importStatus}
									actionType={actionType}
									onQueryImportSources={handleQueryImportSources}
									onResetToBlank={handleResetToBlank}
								/>
							</MagicSuspense>
						)}

						{/* 模型类型 */}
						{isLLM && (
							<Form.Item
								className={cx(styles.formItem, styles.required)}
								label={t("form.modelType")}
								rules={[{ required: true, message: "" }]}
								name="model_type"
								initialValue={modelTypeOptions[0]?.value}
							>
								<MagicSelect options={modelTypeOptions} />
							</Form.Item>
						)}

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

						<div className={styles.fieldHint}>{t("form.sharedFieldHint")}</div>

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
						{isLLM && (
							<MagicSuspense>
								<LlmModelConfig innerModelType={innerModelType} form={form} />
							</MagicSuspense>
						)}

						{/* 官方模型配置 */}
						{isOfficialOrg && category && (
							<MagicSuspense>
								<OfficialModelConfig
									category={category}
									pricingTemplates={pricingTemplates}
									loading={pricingTemplatesLoading}
								/>
							</MagicSuspense>
						)}
					</Form>
				</MagicModal>
				{importPopover.open &&
					importPopover.position &&
					createPortal(
						<MagicSuspense>
							<ImportSourcePopover
								className={styles.floatingImportPanel}
								style={importPopover.position}
								loading={importPopover.loading}
								sources={importPopover.sources}
								selectedSourceId={importPopover.selectedSourceId}
								onSelect={importPopover.onSelect}
								onConfirm={importPopover.onConfirm}
								onClose={importPopover.onClose}
							/>
						</MagicSuspense>,
						document.body,
					)}
			</>
		)
	},
)
