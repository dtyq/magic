import type { MagicModalProps } from "components"
import {
	MagicAvatar,
	MagicButton,
	MagicForm,
	MagicInput,
	MagicModal,
	MagicSelect,
	UploadButton,
} from "components"
import { memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Form, Input, message } from "antd"
import { useMemoizedFn } from "ahooks"
import { IconUpload } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import type { PlatformPackage } from "@/types/platformPackage"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useApis } from "@/apis"
import useFormChangeDetection from "@/hooks/useFormChangeDetection"
import { validatePhone } from "@/utils/phone"
import { useUpload } from "@/hooks/useUpload"
import type { Upload } from "@/types/upload"
import { genFileData } from "@/utils/file"
import DefaultAvatar from "@/assets/logos/user-avatar.svg"
import InputPhone from "./InputPhone"

const useStyles = createStyles(({ css, token }) => {
	return {
		form: css`
			gap: 0;
		`,
		desc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		upload: css`
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			color: ${token.magicColorUsages.text[1]};
		`,
		avatar: css`
			border-radius: 8px;
		`,
	}
})

interface CreateOrganizationModalProps extends OpenableProps<MagicModalProps> {
	info: PlatformPackage.OrganizationInfo | null
}

const defaultFormValues = {
	name: "",
	magic_organization_code: "",
	status_code: "+86",
	phone: "",
	industry_type: undefined,
	number: "",
	contact_user: "",
	contact_mobile: "",
	introduction: "",
}

const CreateOrganizationModal = ({
	info,
	onOk,
	onClose,
	afterClose,
	...props
}: CreateOrganizationModalProps) => {
	const { t } = useTranslation("admin/platform/organization")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()

	const [form] = Form.useForm()

	const { PlatformPackageApi } = useApis()

	const [open, setOpen] = useState(true)
	const [loading, setLoading] = useState(false)
	const [imageUrl, setImageUrl] = useState(info?.logo?.url || "")

	const options = useMemo(() => {
		return [{ value: "other", label: t("other") }]
	}, [t])

	const initialFormValues = useMemo(() => {
		return info
			? {
					...info,
					phone: info.creator?.phone,
					status_code: info.creator?.status_code,
			  }
			: defaultFormValues
	}, [info])

	useEffect(() => {
		form.setFieldsValue(initialFormValues)
	}, [form, initialFormValues])

	const onInnerOk = async () => {
		try {
			const values = await form.validateFields()
			setLoading(true)

			if (info) {
				const { phone, status_code, ...rest } = values
				PlatformPackageApi.updateOrganizationInfo(rest).then(() => {
					message.success(tCommon("message.updateSuccess"))
					setOpen(false)
					onClose?.()
					afterClose?.()
				})
			} else {
				PlatformPackageApi.createOrganization(values).then(() => {
					message.success(tCommon("message.createSuccess"))
					setOpen(false)
					onClose?.()
					afterClose?.()
				})
			}
		} catch (error) {
			// 表单验证失败
		} finally {
			setLoading(false)
		}
	}

	// 使用表单变更检测hook
	const { hasChanges } = useFormChangeDetection({
		form,
		initialValues: initialFormValues,
	})

	const onInnerCancel = () => {
		if (hasChanges) {
			MagicModal.confirm({
				centered: true,
				title: tCommon("confirmClose"),
				content: tCommon("unsavedChanges"),
				onOk: () => {
					setOpen(false)
					onClose?.()
				},
			})
		} else {
			setOpen(false)
			onClose?.()
		}
	}

	const { uploading, uploadAndGetFileUrl } = useUpload<Upload.FileData>({
		storageType: "public",
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		const newFiles = Array.from(fileList).map(genFileData)
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)

		if (fullfilled.length) {
			const data = fullfilled[0].value
			setImageUrl(data.url)
			form.setFieldValue("logo", {
				url: data.url,
				key: data.path,
				name: newFiles[0].name,
			})
		}
	})

	// 生成随机组织编码
	const generateRandomCode = useMemoizedFn(() => {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		const randomLength = Math.floor(Math.random() * 7) + 3 // 3-9个字符
		let randomStr = ""
		for (let i = 0; i < randomLength; i += 1) {
			randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
		}
		const code = `Off${randomStr}` // Off开头，总长度不超过12
		form.setFieldValue("magic_organization_code", code)
	})

	return (
		<MagicModal
			centered
			width={600}
			open={open}
			title={t("createOrganization")}
			okText={tCommon("button.save")}
			closable={false}
			onOk={onInnerOk}
			onCancel={onInnerCancel}
			confirmLoading={loading}
			{...props}
		>
			<MagicForm
				afterRequiredMask
				layout="vertical"
				form={form}
				initialValues={initialFormValues}
				className={styles.form}
			>
				<Form.Item label={t("icon")} name="logo">
					<Flex gap={10} align="center">
						<MagicAvatar
							size={60}
							src={imageUrl || DefaultAvatar}
							className={styles.avatar}
							imgClassName={styles.avatar}
						/>
						<Flex gap={4} vertical>
							<UploadButton
								className={styles.upload}
								loading={uploading}
								onFileChange={onFileChange}
								icon={<IconUpload size={20} />}
								multiple={false}
								accept=".jpg, .jpeg, .png, .webp, .gif"
							>
								{t("uploadIcon")}
							</UploadButton>
							<span className={styles.desc}>{t("iconDesc")}</span>
						</Flex>
					</Flex>
				</Form.Item>
				<Form.Item
					label={t("organizationName")}
					name="name"
					rules={[
						{
							required: true,
							message: "",
						},
					]}
				>
					<MagicInput
						placeholder={tCommon("pleaseInputPlaceholder", {
							name: t("organizationName"),
						})}
					/>
				</Form.Item>

				<Form.Item label={t("organizationCode")} required>
					<Flex gap={8}>
						<Form.Item
							name="magic_organization_code"
							rules={[{ required: true, message: "" }]}
							noStyle
						>
							<MagicInput
								disabled={!!info}
								placeholder={tCommon("pleaseInputPlaceholder", {
									name: t("organizationCode"),
								})}
							/>
						</Form.Item>
						<MagicButton onClick={generateRandomCode} disabled={!!info}>
							{t("randomGenerate")}
						</MagicButton>
					</Flex>
				</Form.Item>

				<Form.Item label={t("creatorPhone")} required>
					<InputPhone
						rules={
							info
								? []
								: [
										{ required: true, message: "" },
										({ getFieldValue }) => ({
											validator(_, value) {
												const phoneStateCode = getFieldValue("status_code")
												if (!validatePhone(value, phoneStateCode)) {
													return Promise.reject(tCommon("invalidPhone"))
												}
												return Promise.resolve()
											},
										}),
								  ]
						}
						filedName={{ phone: "phone", stateCode: "status_code" }}
						disabled={!!info}
					/>
				</Form.Item>

				<Form.Item label={t("industryType")} name="industry_type">
					<MagicSelect
						options={options}
						allowClear
						placeholder={tCommon("pleaseSelectPlaceholder", {
							name: t("industryType"),
						})}
					/>
				</Form.Item>

				<Form.Item label={t("companyScale")} name="number">
					<MagicInput
						placeholder={tCommon("pleaseInputPlaceholder", { name: t("companyScale") })}
					/>
				</Form.Item>

				<Form.Item label={t("contactPerson")} name="contact_user">
					<MagicInput
						placeholder={tCommon("pleaseInputPlaceholder", {
							name: t("contactPerson"),
						})}
					/>
				</Form.Item>

				<Form.Item
					label={t("contactPhone")}
					name="contact_mobile"
					rules={[
						{
							validator(_, value) {
								if (!validatePhone(value, "+86")) {
									return Promise.reject(tCommon("invalidPhone"))
								}
								return Promise.resolve()
							},
						},
					]}
				>
					<MagicInput
						placeholder={tCommon("pleaseInputPlaceholder", { name: t("contactPhone") })}
					/>
				</Form.Item>

				<Form.Item label={t("introduction")} name="introduction">
					<Input.TextArea
						placeholder={tCommon("pleaseInputPlaceholder", { name: t("introduction") })}
						rows={3}
						maxLength={500}
						showCount
					/>
				</Form.Item>
			</MagicForm>
		</MagicModal>
	)
}

export default memo(CreateOrganizationModal)
