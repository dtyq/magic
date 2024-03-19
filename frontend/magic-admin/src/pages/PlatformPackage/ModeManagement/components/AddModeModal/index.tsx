import { memo, useEffect, useMemo, useState } from "react"
import { Flex, Form, Input, message } from "antd"
import { useTranslation } from "react-i18next"
import type { Lang, MagicModalProps } from "components"
import {
	MultiLangSetting,
	MagicModal,
	MagicForm,
	MagicInput,
	MagicInputNumber,
	LanguageType,
} from "components"
import useFormChangeDetection from "@/hooks/useFormChangeDetection"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import type { PlatformPackage } from "@/types/platformPackage"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useApis } from "@/apis"
import { useWatch } from "antd/es/form/Form"
import { useAdmin } from "@/provider/AdminProvider"
import { useStyles } from "./styles"

interface AddModelContentProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	info?: PlatformPackage.Mode | null
	onOk?: (res: PlatformPackage.Mode) => void
}
const defaultLangConfig = {
	name_i18n: {
		zh_CN: "",
		en_US: "",
	},
	placeholder_i18n: {
		zh_CN: "",
		en_US: "",
	},
}

const defaultValue = {
	...defaultLangConfig,
	sort: 0,
}

export const AddModeModal = memo(
	({ info, onOk, afterClose, onClose, ...rest }: AddModelContentProps) => {
		const { t } = useTranslation("admin/platform/mode")
		const { t: tCommon } = useTranslation("admin/common")
		const { styles } = useStyles()

		const { language } = useAdmin()

		const { PlatformPackageApi } = useApis()
		const [form] = Form.useForm()
		const name = useWatch(["name_i18n", language as keyof Lang], form)

		const [saving, setSaving] = useState(false)
		const [open, setOpen] = useState(true)

		const [langConfig, setLangConfig] =
			useState<Pick<PlatformPackage.Mode, "name_i18n" | "placeholder_i18n">>(
				defaultLangConfig,
			)

		const initialFormValues = useMemo(() => {
			if (info) {
				const { name_i18n, identifier, placeholder_i18n, sort, organization_whitelist } =
					info

				return {
					name_i18n,
					identifier,
					placeholder_i18n,
					sort,
					organization_whitelist,
				}
			}
			return defaultValue
		}, [info])

		// 监听弹窗打开状态和info变化，重置表单
		useEffect(() => {
			form.setFieldsValue(initialFormValues)
			if (info) {
				setLangConfig({
					name_i18n: info.name_i18n,
					placeholder_i18n: info.placeholder_i18n,
				})
			}
		}, [info, initialFormValues, form])

		const cancel = () => {
			setOpen(false)
			onClose?.()
		}

		// 使用表单变更检测hook
		const { hasChanges, resetChangeDetection } = useFormChangeDetection({
			form,
			initialValues: initialFormValues,
		})

		const onInnerCancel = useMemoizedFn(() => {
			if (hasChanges) {
				MagicModal.confirm({
					centered: true,
					title: tCommon("confirmClose"),
					content: tCommon("unsavedChanges"),
					onOk: () => {
						form.resetFields()
						cancel()
					},
				})
			} else {
				cancel()
			}
		})

		const onInnerOk = useMemoizedFn(async () => {
			try {
				if (saving) return

				setSaving(true)
				const values = await form.validateFields()

				if (!name) {
					message.error(t("notFound"))
					return
				}

				const newValues = {
					...values,
					...langConfig,
					description: "",
					organization_whitelist: values.organization_whitelist
						? values.organization_whitelist.trim()?.split(",").filter(Boolean).join(",")
						: "",
				}
				let res = null
				if (info) {
					res = await PlatformPackageApi.updateMode(info?.id, newValues)
					cancel()
					onOk?.(res.mode)
				} else {
					res = await PlatformPackageApi.addMode(newValues)
					cancel()
					onOk?.(res)
				}
				message.success(tCommon("message.saveSuccess"))
			} finally {
				setSaving(false)
			}
		})

		const updateLangConfig = useMemoizedFn(
			(key: "name_i18n" | "placeholder_i18n", value: Lang) => {
				setLangConfig((prev) => {
					const defaultConfig = { name_i18n: {}, placeholder_i18n: {} }
					const baseConfig = prev || defaultConfig

					return {
						...baseConfig,
						[key]: { ...baseConfig[key], ...value },
					}
				})
			},
		)

		const innerAfterClose = useMemoizedFn(() => {
			form.resetFields()
			afterClose?.()
			resetChangeDetection()
			setLangConfig(defaultLangConfig)
		})

		const { run: onIdentifierChange } = useDebounceFn(
			async (value: string) => {
				PlatformPackageApi.getAgentDetail(value)
					.then((res) => {
						form.setFieldsValue({
							name_i18n: {
								zh_CN: res.name_i18n.zh_CN || res.name_i18n.default,
								en_US: res.name_i18n.en_US || res.name_i18n.default,
							},
						})
						updateLangConfig("name_i18n", {
							zh_CN: res.name_i18n.zh_CN || res.name_i18n.default,
							en_US: res.name_i18n.en_US || res.name_i18n.default,
						})
					})
					.catch(() => {
						form.setFieldsValue({
							name_i18n: {
								zh_CN: "",
							},
						})
						updateLangConfig("name_i18n", {
							zh_CN: "",
							en_US: "",
						})
						// message.error(t("notFound"))
					})
			},
			{ wait: 500 },
		)

		return (
			<MagicModal
				width={600}
				open={open}
				title={info ? t("editMode") : t("addMode")}
				okText={tCommon("button.save")}
				okButtonProps={{
					disabled: !name,
				}}
				onCancel={onInnerCancel}
				afterClose={innerAfterClose}
				onOk={onInnerOk}
				centered
				{...rest}
			>
				<MagicForm
					afterRequiredMask
					className={styles.form}
					requiredMark={false}
					colon={false}
					form={form}
				>
					{/* 模式标识 */}
					<Form.Item label={t("modeId")} className={styles.formItem} required>
						<Flex vertical gap={6}>
							<Form.Item name="identifier" noStyle>
								<Input
									placeholder={t("modeIdPlaceholder")}
									onChange={(e) => {
										onIdentifierChange(e.target.value)
									}}
								/>
							</Form.Item>
							<div className={styles.desc}>{t("modeIdDesc")}</div>
						</Flex>
					</Form.Item>
					{/* 模式名称 */}
					<Form.Item label={t("modeName")} className={styles.formItem} required>
						<Flex gap={10}>
							<Form.Item name={["name_i18n", language as keyof Lang]} noStyle>
								<Input
									disabled
									placeholder={t("modeNamePlaceholder")}
									onChange={(e) => {
										updateLangConfig("name_i18n", {
											[language as keyof Lang]: e.target.value,
										})
									}}
								/>
							</Form.Item>
							<MultiLangSetting
								supportLangs={
									language === LanguageType.zh_CN
										? [LanguageType.en_US]
										: [LanguageType.zh_CN]
								}
								onSave={(value) => {
									updateLangConfig("name_i18n", value)
								}}
								info={langConfig?.name_i18n}
								disabled
							/>
						</Flex>
					</Form.Item>
					{/* 占位文本 */}
					<Form.Item label={t("text")} className={styles.formItem}>
						<Flex vertical gap={6}>
							<Flex gap={10}>
								<Form.Item name={["placeholder_i18n", "zh_CN"]} noStyle>
									<Input.TextArea
										rows={4}
										placeholder={t("textPlaceholder")}
										onChange={(e) => {
											updateLangConfig("placeholder_i18n", {
												zh_CN: e.target.value,
											})
										}}
									/>
								</Form.Item>
								<MultiLangSetting
									onSave={(value) => {
										updateLangConfig("placeholder_i18n", value)
									}}
									info={langConfig.placeholder_i18n}
									supportType="textarea"
									supportLangs={[LanguageType.en_US]}
									popoverProps={{
										zIndex: 99999,
									}}
								/>
							</Flex>
							<span className={styles.desc}>{t("textDesc")}</span>
						</Flex>
					</Form.Item>
					<Form.Item label={t("displayPriority")} className={styles.formItem}>
						<Flex vertical gap={6}>
							<Form.Item name="sort" noStyle>
								<MagicInputNumber
									min={0}
									precision={0}
									style={{ width: "100%" }}
									placeholder={t("displayPriorityPlaceholder")}
								/>
							</Form.Item>
							<span className={styles.desc}>{t("displayPriorityDesc")}</span>
						</Flex>
					</Form.Item>
					<Form.Item label={t("whiteList")} className={styles.formItem}>
						<Flex vertical gap={6}>
							<Form.Item name="organization_whitelist" noStyle>
								<MagicInput.TextArea
									rows={1}
									placeholder={t("whiteListPlaceholder")}
								/>
							</Form.Item>
							<span className={styles.desc}>{t("whiteListDesc")}</span>
						</Flex>
					</Form.Item>
				</MagicForm>
			</MagicModal>
		)
	},
)
