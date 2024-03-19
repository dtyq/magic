import { memo, useEffect, useMemo, useState } from "react"
import { Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import type { Lang, MagicModalProps } from "components"
import {
	MultiLangSetting,
	MagicForm,
	IconWarning,
	MagicModal,
	MagicInput,
	LanguageType,
} from "components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import type { OpenableProps } from "@/hooks/useOpenModal"
import useFormChangeDetection from "@/hooks/useFormChangeDetection"
import { ModelIcons } from "@/pages/PlatformPackage/components/ModalList/components/ModelIcons"
import { AiModel } from "@/const/aiModel"
import type { PlatformPackage } from "@/types/platformPackage"
import type { AiManage } from "@/types/aiManage"
import { useApis } from "@/apis"
import { useStyles } from "./styles"

export interface Info {
	id?: string
	model_id?: string
	icon: string
	name: PlatformPackage.NameI18N
	description?: PlatformPackage.NameI18N
}

interface AddGroupModalProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	/** 是否是模型 */
	isModel?: boolean
	info?: Info | null
	onOk?: (values: Info) => void
	onClose?: () => void
}

export const AddGroupModal = memo(
	({ info, isModel = false, onOk, onClose, ...rest }: AddGroupModalProps) => {
		const { t } = useTranslation("admin/platform/mode")
		const { t: tCommon } = useTranslation("admin/common")
		const { styles } = useStyles()

		const { AIManageApi } = useApis()

		const [open, setOpen] = useState(true)
		const [langError, setLangError] = useState(false)
		const [lang, setLang] = useState<Lang>()
		const [descriptionLang, setDescriptionLang] = useState<Lang>()
		const [selectedIcon, setSelectedIcon] = useState<string>()
		const [icons, setIcons] = useState<AiManage.Icon[]>([])

		const [form] = Form.useForm()

		const { run: getIcons } = useRequest(
			() =>
				AIManageApi.getDefaultIcon({
					business_type: AiModel.BusinessType.Mode,
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

		useMount(() => {
			getIcons()
		})

		const initialFormValues = useMemo(() => {
			if (info) return info
			return {
				name: "",
				icon: icons?.[0]?.key,
			}
		}, [info, icons])

		useEffect(() => {
			if (info) {
				form.setFieldsValue(info)
				const iconKey = icons.find((i) => i.url === info.icon)?.key
				setSelectedIcon(iconKey)
				setLang(info.name)
				if (info.description) {
					setDescriptionLang(info.description)
				}
			} else {
				setLang(undefined)
				setDescriptionLang(undefined)
			}
		}, [form, icons, info])

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
					icon: <IconWarning size={20} className={styles.icon} />,
					okText: tCommon("button.confirm"),
					zIndex: 9999,
					onOk: () => {
						form.resetFields()
						setSelectedIcon(undefined)
						setOpen(false)
						onClose?.()
					},
				})
			} else {
				setOpen(false)
				onClose?.()
			}
		})

		const onInnerOk = useMemoizedFn(async () => {
			if (!lang?.en_US) {
				message.error(tCommon("message.pleaseInputRequiredFields"))
				setLangError(true)
				return
			}
			const values = await form.validateFields()

			const icon = isModel
				? values.icon.startsWith("https")
					? values.icon
					: icons.find((i) => i.key === values.icon)?.url
				: values.icon

			await onOk?.({
				...values,
				name: {
					zh_CN: values.name.zh_CN,
					en_US: lang?.en_US,
				},
				icon,
				description: isModel
					? {
							zh_CN: values.description.zh_CN,
							en_US: descriptionLang?.en_US,
					  }
					: undefined,
			})

			setOpen(false)
			onClose?.()
		})

		const afterClose = useMemoizedFn(() => {
			form.resetFields()
			setSelectedIcon(icons?.[0]?.key)
			setLang(undefined)
			setLangError(false)
			resetChangeDetection()
		})

		const handleSelectIcon = (key?: string) => {
			form.setFieldsValue({
				icon: key,
			})
			setSelectedIcon(key)
		}

		return (
			<MagicModal
				width={600}
				open={open}
				title={info ? (isModel ? t("editModel") : t("editGroupTitle")) : t("createGroup")}
				okText={tCommon("button.save")}
				onCancel={onInnerCancel}
				afterClose={afterClose}
				onOk={onInnerOk}
				destroyOnHidden
				centered
				{...rest}
			>
				<MagicForm
					afterRequiredMask
					className={styles.form}
					requiredMark={false}
					colon={false}
					form={form}
					initialValues={initialFormValues}
				>
					<Form.Item
						name="icon"
						label={isModel ? t("modelIcon") : t("groupIcon")}
						className={styles.formItem}
					>
						<ModelIcons
							icons={icons}
							setIcons={setIcons}
							selectedIcon={selectedIcon}
							businessType={AiModel.BusinessType.Mode}
							handleSelectIcon={handleSelectIcon}
						/>
					</Form.Item>

					<Form.Item
						label={isModel ? t("modelName") : t("groupName")}
						className={styles.formItem}
						required
					>
						<Flex gap={10}>
							<Form.Item name={["name", "zh_CN"]} noStyle>
								<MagicInput
									placeholder={tCommon("pleaseInputPlaceholder", {
										name: isModel ? t("modelName") : t("groupName"),
									})}
								/>
							</Form.Item>
							<MultiLangSetting
								onSave={setLang}
								info={lang}
								required
								supportLangs={[LanguageType.en_US]}
								danger={langError}
								popoverProps={{
									zIndex: 99999,
								}}
							/>
						</Flex>
					</Form.Item>
					{isModel && (
						<>
							<Form.Item
								label={t("modelDescription")}
								className={styles.formItem}
								required
							>
								<Flex gap={10}>
									<Form.Item name={["description", "zh_CN"]} noStyle>
										<MagicInput.TextArea
											rows={4}
											placeholder={tCommon("pleaseInputPlaceholder", {
												name: t("modelDescription"),
											})}
										/>
									</Form.Item>
									<MultiLangSetting
										onSave={setDescriptionLang}
										info={descriptionLang}
										supportLangs={[LanguageType.en_US]}
										popoverProps={{
											zIndex: 99999,
										}}
									/>
								</Flex>
							</Form.Item>
							<Form.Item
								label={t("modelId")}
								name="model_id"
								className={styles.formItem}
							>
								<MagicInput
									placeholder={t("modelIdPlaceholder")}
									disabled={!!info?.model_id}
								/>
							</Form.Item>
						</>
					)}
				</MagicForm>
			</MagicModal>
		)
	},
)
