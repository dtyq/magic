import { memo, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Flex, Form, Input, Progress, Select, Switch, Typography, message } from "antd"
import { useMemoizedFn, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { IconFileZip, IconFolder, IconInfoCircle, IconUpload } from "@tabler/icons-react"
import {
	LanguageType,
	MagicForm,
	MagicInput,
	MagicModal,
	MultiLangSetting,
	UploadButton,
	type Lang,
	type MagicModalProps,
} from "@admin-components"
import { useApis } from "@admin/apis"
import { useUpload } from "@admin/hooks/useUpload"
import type { Upload } from "@admin/types/upload"
import { genFileData } from "@admin/utils/file"
import type { PlatformPackage } from "@admin/types/platformPackage"
import { SkillMarketCategoryStatusMap } from "@admin/types/platformPackage/market"
import {
	createSkillArchiveFromSelectedFolderFiles,
	SKILL_ARCHIVE_ERROR,
	SkillArchiveError,
} from "@admin/utils/skillArchive"

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ACCEPT = ".zip,.skill,application/zip,application/x-zip-compressed"

type ParsedSkill = PlatformPackage.ParseOfficialSkillResponse
type Category = PlatformPackage.SkillMarketCategoryItem

export interface OfficialSkillImportDialogProps extends Omit<MagicModalProps, "onOk" | "onCancel"> {
	onCancel?: () => void
	onSuccess?: (result: PlatformPackage.ImportOfficialSkillResponse) => void | Promise<void>
}

type LocalizedFieldProps = {
	form: ReturnType<typeof Form.useForm>[0]
	field: "name_i18n" | "description_i18n" | "source_i18n"
	label: string
	placeholder?: string
	required?: boolean
	textarea?: boolean
}

function getLocalizedValue(value?: PlatformPackage.NameI18N | null, fallback = "") {
	const defaultValue = value?.default || value?.zh_CN || value?.en_US || fallback
	return {
		default: defaultValue,
		zh_CN: value?.zh_CN || defaultValue,
		en_US: value?.en_US || defaultValue,
	}
}

function ensureLocalizedDefault(
	value?: PlatformPackage.NameI18N | null,
	fallback = "",
): PlatformPackage.NameI18N {
	const defaultValue = value?.default || value?.zh_CN || value?.en_US || fallback
	return { ...value, default: defaultValue }
}

function getCategoryOptions(categories: Category[]) {
	return categories.map((category) => ({
		label: category.name_i18n?.zh_CN || category.name || category.id,
		value: String(category.id),
	}))
}

function LocalizedField({
	form,
	field,
	label,
	placeholder,
	required,
	textarea,
}: LocalizedFieldProps) {
	const value = Form.useWatch([field], form) as PlatformPackage.NameI18N | undefined
	const updateLang = useMemoizedFn((next: Lang) => {
		form.setFieldsValue({ [field]: { ...form.getFieldValue(field), ...next } })
		if (required) form.setFields([{ name: [field, "en_US"], errors: [] }])
	})

	return (
		<Form.Item label={label} required={required}>
			<Flex gap={8} align="start">
				<Form.Item
					name={[field, "default"]}
					noStyle
					rules={required ? [{ required: true, message: "" }] : undefined}
				>
					{textarea ? (
						<Input.TextArea rows={3} placeholder={placeholder} />
					) : (
						<MagicInput placeholder={placeholder} />
					)}
				</Form.Item>
				<Form.Item
					name={[field, "zh_CN"]}
					noStyle
					hidden
					rules={required ? [{ required: true, message: "" }] : undefined}
				>
					<MagicInput />
				</Form.Item>
				<Form.Item
					name={[field, "en_US"]}
					noStyle
					hidden
					rules={required ? [{ required: true, message: "" }] : undefined}
				>
					<MagicInput />
				</Form.Item>
				<MultiLangSetting
					required={required}
					supportLangs={[LanguageType.zh_CN, LanguageType.en_US]}
					supportType={textarea ? "textarea" : "input"}
					info={value}
					onSave={updateLang}
				/>
			</Flex>
		</Form.Item>
	)
}

const OfficialSkillImportDialog = memo(
	({ onCancel, onSuccess, ...rest }: OfficialSkillImportDialogProps) => {
		const { t } = useTranslation("admin/platform/skillMarket")
		const { t: tCommon } = useTranslation("admin/common")
		const { PlatformPackageApi } = useApis()
		const [form] = Form.useForm()
		const [parsed, setParsed] = useState<ParsedSkill | null>(null)
		const [progress, setProgress] = useState(0)
		const [packing, setPacking] = useState(false)
		const [parsing, setParsing] = useState(false)
		const [submitting, setSubmitting] = useState(false)
		const [logoFile, setLogoFile] = useState<File | null>(null)
		const [logoPreviewUrl, setLogoPreviewUrl] = useState("")
		const [categories, setCategories] = useState<Category[]>([])
		const submittingRef = useRef(false)
		const logoObjectUrlRef = useRef<string | null>(null)

		const { run: fetchCategories, loading: categoriesLoading } = useRequest(
			() =>
				PlatformPackageApi.getSkillMarketCategoryList({
					status: SkillMarketCategoryStatusMap.visible,
				}),
			{
				manual: true,
				onSuccess: (response) => setCategories(response.list ?? []),
				onError: () => message.error(t("officialSkillImport.errors.categoriesFailed")),
			},
		)

		const { upload: uploadPackage, uploading: packageUploading } = useUpload<Upload.FileData>({
			storageType: "private",
			businessCode: "skill",
			sts: true,
			onProgress: (_, nextProgress) => setProgress(nextProgress),
		})
		// Keep the icon flow aligned with the frontend Skill import: upload a changed icon
		// to the public Skill bucket only when the import is confirmed.
		const { upload: uploadLogo, uploading: logoUploading } = useUpload<Upload.FileData>({
			storageType: "public",
			businessCode: "skill",
			sts: true,
		})

		const categoryOptions = useMemo(() => getCategoryOptions(categories), [categories])

		// Local previews use object URLs; revoke them whenever a selection is replaced or reset.
		const clearLogoSelection = useMemoizedFn(() => {
			if (logoObjectUrlRef.current) {
				URL.revokeObjectURL(logoObjectUrlRef.current)
				logoObjectUrlRef.current = null
			}
			setLogoFile(null)
			setLogoPreviewUrl("")
		})

		const clearSelectedFile = useMemoizedFn(() => {
			setParsed(null)
			setProgress(0)
			clearLogoSelection()
			form.resetFields()
		})

		const reset = useMemoizedFn(() => {
			form.resetFields()
			setParsed(null)
			setProgress(0)
			setPacking(false)
			setParsing(false)
			setSubmitting(false)
			clearLogoSelection()
			setCategories([])
			submittingRef.current = false
		})

		useEffect(
			() => () => {
				if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current)
			},
			[],
		)

		useEffect(() => {
			if (!rest.open) return
			reset()
			fetchCategories()
		}, [fetchCategories, reset, rest.open])

		const processSelectedFile = useMemoizedFn(async (selected?: File) => {
			if (!selected) return
			clearSelectedFile()
			if (!/\.(zip|skill)$/i.test(selected.name)) {
				message.error(t("officialSkillImport.errors.invalidFile"))
				return
			}
			if (selected.size > MAX_FILE_SIZE) {
				message.error(t("officialSkillImport.errors.fileTooLarge"))
				return
			}

			const nextFile = genFileData(selected)
			setParsed(null)
			setProgress(0)
			setParsing(true)
			try {
				const result = await uploadPackage([nextFile])
				if (!result.fullfilled.length) throw new Error("upload-failed")
				const parsedResult = await PlatformPackageApi.parseOfficialSkillFile({
					file_key: result.fullfilled[0].value.key,
				})
				setParsed(parsedResult)
				setLogoPreviewUrl(parsedResult.logo || "")
				form.setFieldsValue({
					version: parsedResult.version || "1.0.0",
					name_i18n: getLocalizedValue(parsedResult.name_i18n, parsedResult.package_name),
					description_i18n: getLocalizedValue(
						parsedResult.description_i18n,
						parsedResult.package_description,
					),
					source_i18n: getLocalizedValue(
						undefined,
						t("officialSkillImport.defaultSource"),
					),
					logo: parsedResult.logo || "",
					category_ids:
						parsedResult.categories?.map((category) => String(category.id)) ?? [],
					is_hidden: parsedResult.is_hidden ?? false,
					is_featured: parsedResult.is_featured ?? false,
					sort_order: parsedResult.sort_order ?? 0,
				})
				if (parsedResult.is_update) {
					MagicModal.confirm({
						centered: true,
						title: t("officialSkillImport.duplicate.title"),
						content: t("officialSkillImport.duplicate.description", {
							name: parsedResult.package_name,
						}),
						cancelText: t("officialSkillImport.duplicate.cancel"),
						okText: t("officialSkillImport.duplicate.continue"),
						onCancel: clearSelectedFile,
					})
				}
				setProgress(100)
			} catch {
				message.error(t("officialSkillImport.errors.parseFailed"))
			} finally {
				setParsing(false)
			}
		})

		const handleFileChange = useMemoizedFn(async (files: FileList) => {
			await processSelectedFile(files[0])
		})

		const handleFolderChange = useMemoizedFn(async (files: FileList) => {
			if (!files.length || packing || parsing || packageUploading) return
			clearSelectedFile()

			const selectedFiles = Array.from(files)
			const sourceSize = selectedFiles.reduce((total, selected) => total + selected.size, 0)
			if (sourceSize > MAX_FILE_SIZE) {
				message.error(t("officialSkillImport.errors.fileTooLarge"))
				return
			}

			let archive: File | undefined
			setPacking(true)
			try {
				archive = await createSkillArchiveFromSelectedFolderFiles(selectedFiles)
			} catch (error) {
				if (
					error instanceof SkillArchiveError &&
					error.code === SKILL_ARCHIVE_ERROR.EMPTY_FOLDER
				) {
					message.error(t("officialSkillImport.errors.emptyFolder"))
					return
				}
				message.error(t("officialSkillImport.errors.archiveFailed"))
			} finally {
				setPacking(false)
			}

			if (archive) await processSelectedFile(archive)
		})

		const handleLogoChange = useMemoizedFn((files: FileList) => {
			const selected = files[0]
			if (!selected) return
			if (!selected.type.startsWith("image/")) {
				message.error(tCommon("file.onlySupportUploadImage"))
				return
			}

			if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current)
			const previewUrl = URL.createObjectURL(selected)
			logoObjectUrlRef.current = previewUrl
			setLogoFile(selected)
			setLogoPreviewUrl(previewUrl)
		})

		const handleSubmit = useMemoizedFn(async () => {
			if (!parsed || submittingRef.current) return
			submittingRef.current = true
			setSubmitting(true)
			try {
				const values = await form.validateFields()
				let logo = values.logo?.trim() || undefined
				if (logoFile) {
					const logoResult = await uploadLogo([genFileData(logoFile)])
					if (!logoResult.fullfilled.length) {
						message.error(t("officialSkillImport.errors.logoUploadFailed"))
						return
					}
					logo = logoResult.fullfilled[0].value.key
				}
				const result = await PlatformPackageApi.importOfficialSkill({
					import_token: parsed.import_token,
					version: String(values.version).trim(),
					name_i18n: ensureLocalizedDefault(values.name_i18n),
					description_i18n: ensureLocalizedDefault(values.description_i18n),
					source_i18n: getLocalizedValue(
						undefined,
						t("officialSkillImport.defaultSource"),
					),
					logo,
					category_ids: (values.category_ids ?? []).map(String),
					publish_status: "PUBLISHED",
					is_hidden: Boolean(values.is_hidden),
					is_featured: Boolean(values.is_featured),
					sort_order: Number(values.sort_order) || 0,
				})
				message.success(
					result.action === "updated"
						? t("officialSkillImport.success.updated")
						: t("officialSkillImport.success.created"),
				)
				await onSuccess?.(result)
				onCancel?.()
			} catch (error) {
				if ((error as { errorFields?: unknown })?.errorFields) {
					message.error(tCommon("message.pleaseInputRequiredFields"))
				} else {
					message.error(t("officialSkillImport.errors.importFailed"))
				}
			} finally {
				submittingRef.current = false
				setSubmitting(false)
			}
		})

		const handleCancel = useMemoizedFn(() => {
			if (submittingRef.current) return
			reset()
			onCancel?.()
		})

		return (
			<MagicModal
				width={760}
				centered
				maskClosable={false}
				destroyOnHidden
				title={t("officialSkillImport.title")}
				okText={t("officialSkillImport.buttons.confirm")}
				cancelText={tCommon("button.cancel")}
				onCancel={handleCancel}
				onOk={handleSubmit}
				okButtonProps={{
					disabled:
						!parsed ||
						packing ||
						parsing ||
						packageUploading ||
						logoUploading ||
						submitting,
					loading: submitting,
				}}
				{...rest}
			>
				<Flex vertical gap={16}>
					<Alert
						showIcon
						icon={<IconInfoCircle size={18} />}
						message={t("officialSkillImport.description")}
						type="info"
					/>
					<div
						style={{
							border: "1px dashed #D9DDE7",
							borderRadius: 10,
							padding: "20px 24px",
							background: "#FAFBFC",
						}}
					>
						<Flex align="center" justify="space-between" gap={16} wrap="wrap">
							<Flex align="center" gap={12}>
								<div
									style={{
										width: 40,
										height: 40,
										borderRadius: 10,
										background: "#EEF3FF",
										color: "#315CEC",
										display: "grid",
										placeItems: "center",
									}}
								>
									<IconFileZip size={22} />
								</div>
								<div>
									<Typography.Text strong>
										{t("officialSkillImport.upload.title")}
									</Typography.Text>
									<Typography.Paragraph
										type="secondary"
										style={{ margin: 0, fontSize: 12 }}
									>
										{t("officialSkillImport.upload.hint")}
									</Typography.Paragraph>
								</div>
							</Flex>
							<Flex gap={8} wrap="wrap">
								<UploadButton
									type="primary"
									icon={<IconUpload size={16} />}
									loading={packing || packageUploading || parsing}
									disabled={packing || packageUploading || parsing || submitting}
									multiple={false}
									accept={ACCEPT}
									onFileChange={handleFileChange}
								>
									{t("officialSkillImport.upload.chooseFile")}
								</UploadButton>
								<UploadButton
									type="default"
									icon={<IconFolder size={16} />}
									loading={packing || packageUploading || parsing}
									disabled={packing || packageUploading || parsing || submitting}
									directory
									onFileChange={handleFolderChange}
								>
									{t("officialSkillImport.upload.chooseFolder")}
								</UploadButton>
							</Flex>
						</Flex>
						{packing || packageUploading || parsing ? (
							<Progress percent={progress} size="small" showInfo={false} />
						) : null}
					</div>

					{parsed ? (
						<>
							<MagicForm form={form} layout="vertical" afterRequiredMask>
								<Form.Item label={t("officialSkillImport.fields.logo")}>
									{/* Match the frontend Skill import affordance: square preview with upload below. */}
									<Flex vertical align="center" gap={8} style={{ width: 128 }}>
										<div
											style={{
												width: 128,
												height: 128,
												display: "grid",
												placeItems: "center",
												overflow: "hidden",
												border: "1px solid #D9D9D9",
												borderRadius: 8,
												background: "#F5F5F5",
											}}
										>
											{logoPreviewUrl ? (
												<img
													src={logoPreviewUrl}
													alt={t("officialSkillImport.fields.logo")}
													style={{
														width: "100%",
														height: "100%",
														objectFit: "cover",
													}}
													draggable={false}
												/>
											) : (
												<IconUpload
													size={32}
													color="#8C8C8C"
													stroke={1.6}
												/>
											)}
										</div>
										<UploadButton
											type="default"
											icon={<IconUpload size={16} />}
											loading={logoUploading}
											disabled={logoUploading || submitting}
											multiple={false}
											accept="image/*"
											onFileChange={handleLogoChange}
										>
											{t("officialSkillImport.fields.uploadLogo")}
										</UploadButton>
									</Flex>
								</Form.Item>
								<Form.Item name="logo" hidden>
									<MagicInput />
								</Form.Item>
								<LocalizedField
									form={form}
									field="name_i18n"
									label={t("officialSkillImport.fields.name")}
									placeholder={t("officialSkillImport.fields.namePlaceholder")}
									required
								/>
								<LocalizedField
									form={form}
									field="description_i18n"
									label={t("officialSkillImport.fields.description")}
									placeholder={t(
										"officialSkillImport.fields.descriptionPlaceholder",
									)}
									required
									textarea
								/>
								<Flex gap={12}>
									<Form.Item
										label={t("officialSkillImport.fields.version")}
										name="version"
										rules={[{ required: true, message: "" }]}
										style={{ flex: 1 }}
									>
										<MagicInput placeholder="1.0.0" maxLength={32} />
									</Form.Item>
								</Flex>
								<Form.Item
									label={t("officialSkillImport.fields.category")}
									name="category_ids"
								>
									<Select
										mode="multiple"
										allowClear
										loading={categoriesLoading}
										options={categoryOptions}
										placeholder={t(
											"officialSkillImport.fields.categoryPlaceholder",
										)}
										maxTagCount="responsive"
									/>
								</Form.Item>
								<Flex align="center" gap={16} wrap="nowrap">
									<Form.Item
										name="is_hidden"
										valuePropName="checked"
										style={{ marginBottom: 0 }}
									>
										<Switch
											checkedChildren={t("officialSkillImport.fields.hidden")}
											unCheckedChildren={t(
												"officialSkillImport.fields.visible",
											)}
										/>
									</Form.Item>
									<Form.Item
										name="is_featured"
										valuePropName="checked"
										style={{ marginBottom: 0 }}
									>
										<Switch
											checkedChildren={t(
												"officialSkillImport.fields.featured",
											)}
											unCheckedChildren={t(
												"officialSkillImport.fields.notFeatured",
											)}
										/>
									</Form.Item>
									<Flex
										align="center"
										gap={8}
										style={{ width: 220, flexShrink: 0 }}
									>
										<Typography.Text style={{ whiteSpace: "nowrap" }}>
											{t("officialSkillImport.fields.sortOrder")}
										</Typography.Text>
										<Form.Item name="sort_order" noStyle>
											<Input
												type="number"
												min={0}
												style={{ width: "100%" }}
											/>
										</Form.Item>
									</Flex>
								</Flex>
							</MagicForm>
						</>
					) : null}
				</Flex>
			</MagicModal>
		)
	},
)

export default OfficialSkillImportDialog
