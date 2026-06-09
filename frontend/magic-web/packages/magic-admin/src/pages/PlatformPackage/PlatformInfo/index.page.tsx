import { Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import {
	SubHeader,
	MagicInput,
	BaseLayout,
	MultiLangSetting,
	LanguageType,
	MagicSelect,
	MagicSwitch,
} from "@admin-components"
import { useAdminStore } from "@admin/stores/admin"
import { useMemoizedFn } from "ahooks"
import { useEffect, useState } from "react"
import useRights from "@admin/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { useApis } from "@admin/apis"
import type { AiManage } from "@admin/types/aiManage"
import { useStyles } from "./styles"
import LogoUploadItemComponent from "./components/LogoUploadItem"
import { useIsMobile } from "@admin/hooks/useIsMobile"

export enum PlatformLogoType {
	ZH = "zh",
	EN = "en",
	MINIMAL = "minimal",
	FAVICON = "favicon",
}

const InfoManagementPage = () => {
	const { siderCollapsed } = useAdminStore()
	const isMobile = useIsMobile()

	const { styles } = useStyles({ siderCollapsed })

	const { PlatformInfoApi } = useApis()

	const { t: tCommon } = useTranslation("admin/common")
	const { t: tPlatform } = useTranslation("admin/platform/info")

	const [loading, setLoading] = useState(false)

	const [imagePreviewUrl, setImagePreviewUrl] = useState<Record<PlatformLogoType, string>>({
		[PlatformLogoType.ZH]: "",
		[PlatformLogoType.EN]: "",
		[PlatformLogoType.MINIMAL]: "",
		[PlatformLogoType.FAVICON]: "",
	})
	const [imageUploadUrl, setImageUploadUrl] = useState<Record<PlatformLogoType, string>>({
		[PlatformLogoType.ZH]: "",
		[PlatformLogoType.EN]: "",
		[PlatformLogoType.MINIMAL]: "",
		[PlatformLogoType.FAVICON]: "",
	})
	// const [imageUploadKey, setImageUploadKey] = useState<Record<PlatformLogoType, string>>({
	// 	[PlatformLogoType.ZH]: "",
	// 	[PlatformLogoType.EN]: "",
	// 	[PlatformLogoType.MINIMAL]: "",
	// 	[PlatformLogoType.FAVICON]: "",
	// })

	const hasEditRight = useRights(PERMISSION_KEY_MAP.INFO_MANAGEMENT_EDIT)

	const [form] = Form.useForm()

	// 监听表单字段变化
	const nameI18n = Form.useWatch(["name_i18n"], form)
	const titleI18n = Form.useWatch(["title_i18n"], form)
	const keywordsI18n = Form.useWatch(["keywords_i18n"], form)
	const descriptionI18n = Form.useWatch(["description_i18n"], form)
	const agentRoleNameI18n = Form.useWatch(["agent_role_name_i18n"], form)
	const agentRoleDescriptionI18n = Form.useWatch(["agent_role_description_i18n"], form)
	const footerCopyrightI18n = Form.useWatch(["footer", "copyright_i18n"], form)
	const footerFilingEnabled = Form.useWatch(["footer", "filing", "enabled"], form)

	/** 获取平台信息 */
	const initPlatformInfo = useMemoizedFn(async () => {
		try {
			const res = await PlatformInfoApi.getPlatformInfo()
			if (res) {
				setImagePreviewUrl({
					[PlatformLogoType.ZH]: res.logo.zh_CN,
					[PlatformLogoType.EN]: res.logo.en_US,
					[PlatformLogoType.MINIMAL]: res.minimal_logo || "",
					[PlatformLogoType.FAVICON]: res.favicon || "",
				})
				form.setFieldsValue({
					default_language: res.default_language,
					name_i18n: {
						zh_CN: res.name_i18n.zh_CN || "",
						en_US: res.name_i18n.en_US || "",
					},
					title_i18n: {
						zh_CN: res.title_i18n.zh_CN || "",
						en_US: res.title_i18n.en_US || "",
					},
					keywords_i18n: {
						zh_CN: res.keywords_i18n.zh_CN || "",
						en_US: res.keywords_i18n.en_US || "",
					},
					description_i18n: {
						zh_CN: res.description_i18n.zh_CN || "",
						en_US: res.description_i18n.en_US || "",
					},
					agent_role_name_i18n: {
						zh_CN: res.agent_role_name_i18n?.zh_CN || "",
						en_US: res.agent_role_name_i18n?.en_US || "",
					},
					agent_role_description_i18n: {
						zh_CN: res.agent_role_description_i18n?.zh_CN || "",
						en_US: res.agent_role_description_i18n?.en_US || "",
					},
					footer: {
						copyright_i18n: {
							zh_CN: res.footer?.copyright_i18n?.zh_CN || "",
							en_US: res.footer?.copyright_i18n?.en_US || "",
						},
						filing: {
							enabled: res.footer?.filing?.enabled || false,
							number: res.footer?.filing?.number || "",
							link: res.footer?.filing?.link || "https://beian.miit.gov.cn/",
						},
					},
				})
			}
		} catch (error) {
			// console.error(`获取平台信息失败: ${error}`)
		}
	})

	useEffect(() => {
		initPlatformInfo()
	}, [initPlatformInfo])

	const onSave = useMemoizedFn(async () => {
		if (loading) return
		try {
			await form.validateFields()
			setLoading(true)
			const values = form.getFieldsValue()
			const params = {
				...values,
				logo_zh_url: imageUploadUrl[PlatformLogoType.ZH],
				logo_en_url: imageUploadUrl[PlatformLogoType.EN],
				minimal_logo_url: imageUploadUrl[PlatformLogoType.MINIMAL],
				favicon_url: imageUploadUrl[PlatformLogoType.FAVICON],
			}
			const res = await PlatformInfoApi.updatePlatformInfo(params)
			if (res) {
				message.success(tCommon("message.saveSuccess"))
				initPlatformInfo()
			}
		} catch (error) {
			// console.error(`保存平台信息失败: ${error}`)
		} finally {
			setLoading(false)
		}
	})

	const onCancel = useMemoizedFn(async () => {
		initPlatformInfo()
	})

	const updateFormValue = useMemoizedFn((key: string, value: AiManage.Lang) => {
		form.setFieldsValue({
			[key]: {
				...form.getFieldValue([key]),
				...value,
			},
		})
	})

	return (
		<BaseLayout
			isMobile={isMobile}
			footerContainerClassName={styles.footerContainer}
			buttonGroupProps={{
				// className: styles.footer,
				okProps: {
					onClick: onSave,
					loading,
					disabled: !hasEditRight,
				},
				cancelProps: {
					onClick: onCancel,
					disabled: !hasEditRight,
				},
			}}
		>
			<Form layout="vertical" colon={false} className={styles.container} form={form}>
				<SubHeader title={tPlatform("basicInfo")} />
				<Flex vertical className={styles.formWrapper}>
					{[
						PlatformLogoType.ZH,
						PlatformLogoType.EN,
						PlatformLogoType.MINIMAL,
						PlatformLogoType.FAVICON,
					].map((type) => (
						<LogoUploadItemComponent
							key={type}
							type={type}
							imagePreviewUrl={imagePreviewUrl}
							setImagePreviewUrl={setImagePreviewUrl}
							setImageUploadUrl={setImageUploadUrl}
							// setImageUploadKey={setImageUploadKey}
						/>
					))}
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>
							<span>{tPlatform("platformDefaultLanguage")}</span>
							<span className={styles.formItemLabelRequired}>*</span>
						</div>
						<Flex flex={1} vertical gap={6} className={styles.formItemContent}>
							<Form.Item name="default_language" noStyle>
								<MagicSelect
									options={[
										{
											label: tPlatform(
												"platformDefaultLanguageOptions.zh_CN",
											),
											value: "zh_CN",
										},
										{
											label: tPlatform(
												"platformDefaultLanguageOptions.en_US",
											),
											value: "en_US",
										},
									]}
								/>
							</Form.Item>
							<div className={styles.formItemLabelTip}>
								{tPlatform("platformDefaultLanguageTip")}
							</div>
						</Flex>
					</div>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>
							<span>{tPlatform("platformName")}</span>
							<span className={styles.formItemLabelRequired}>*</span>
						</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["name_i18n", "zh_CN"]} noStyle>
								<MagicInput placeholder={tPlatform("platformNamePlaceholder")} />
							</Form.Item>
							<Form.Item name={["name_i18n", "en_US"]} noStyle hidden>
								<MagicInput />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={nameI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("name_i18n", value)
								}}
							/>
						</Flex>
					</div>
				</Flex>
				<SubHeader title={tPlatform("otherInfo")} />
				<Flex vertical className={styles.formWrapper}>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>Title</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["title_i18n", "zh_CN"]} noStyle>
								<MagicInput.TextArea
									rows={4}
									placeholder={tPlatform("titlePlaceholder")}
								/>
							</Form.Item>
							<Form.Item name={["title_i18n", "en_US"]} noStyle hidden>
								<MagicInput.TextArea />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={titleI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("title_i18n", value)
								}}
							/>
						</Flex>
					</div>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>Keywords</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["keywords_i18n", "zh_CN"]} noStyle>
								<MagicInput.TextArea
									rows={4}
									placeholder={tPlatform("keywordsPlaceholder")}
								/>
							</Form.Item>
							<Form.Item name={["keywords_i18n", "en_US"]} noStyle hidden>
								<MagicInput.TextArea />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={keywordsI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("keywords_i18n", value)
								}}
							/>
						</Flex>
					</div>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>Description</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["description_i18n", "zh_CN"]} noStyle>
								<MagicInput.TextArea
									rows={4}
									placeholder={tPlatform("descriptionPlaceholder")}
								/>
							</Form.Item>
							<Form.Item name={["description_i18n", "en_US"]} noStyle hidden>
								<MagicInput.TextArea />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={descriptionI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("description_i18n", value)
								}}
							/>
						</Flex>
					</div>
				</Flex>
				<SubHeader title={tPlatform("mainAgentPrompt")} />
				<Flex vertical className={styles.formWrapper}>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>
							<span>{tPlatform("agentRoleName")}</span>
							<span className={styles.formItemLabelRequired}>*</span>
						</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["agent_role_name_i18n", "zh_CN"]} noStyle>
								<MagicInput placeholder={tPlatform("agentRoleNamePlaceholder")} />
							</Form.Item>
							<Form.Item name={["agent_role_name_i18n", "en_US"]} noStyle hidden>
								<MagicInput />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={agentRoleNameI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("agent_role_name_i18n", value)
								}}
							/>
						</Flex>
					</div>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>
							<span>{tPlatform("agentRoleDescription")}</span>
							<span className={styles.formItemLabelRequired}>*</span>
						</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["agent_role_description_i18n", "zh_CN"]} noStyle>
								<MagicInput.TextArea
									rows={4}
									placeholder={tPlatform("agentRoleDescriptionPlaceholder")}
								/>
							</Form.Item>
							<Form.Item
								name={["agent_role_description_i18n", "en_US"]}
								noStyle
								hidden
							>
								<MagicInput.TextArea />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={agentRoleDescriptionI18n}
								onSave={(value: AiManage.Lang) => {
									updateFormValue("agent_role_description_i18n", value)
								}}
							/>
						</Flex>
					</div>
				</Flex>
				<SubHeader title={tPlatform("footerConfig")} />
				<Flex vertical className={styles.formWrapper}>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>{tPlatform("copyrightText")}</div>
						<Flex flex={1} gap={10} className={styles.formItemContent}>
							<Form.Item name={["footer", "copyright_i18n", "zh_CN"]} noStyle>
								<MagicInput.TextArea
									rows={2}
									placeholder={tPlatform("copyrightTextPlaceholder")}
								/>
							</Form.Item>
							<Form.Item name={["footer", "copyright_i18n", "en_US"]} noStyle hidden>
								<MagicInput.TextArea />
							</Form.Item>
							<MultiLangSetting
								supportLangs={[LanguageType.en_US]}
								info={footerCopyrightI18n}
								onSave={(value: AiManage.Lang) => {
									form.setFieldsValue({
										footer: {
											...form.getFieldValue(["footer"]),
											copyright_i18n: {
												...form.getFieldValue(["footer", "copyright_i18n"]),
												...value,
											},
										},
									})
								}}
							/>
						</Flex>
					</div>
					<div className={styles.formItem}>
						<div className={styles.formItemLabel}>{tPlatform("showFiling")}</div>
						<Flex flex={1} className={styles.formItemContent}>
							<Form.Item
								name={["footer", "filing", "enabled"]}
								valuePropName="checked"
								noStyle
							>
								<MagicSwitch />
							</Form.Item>
						</Flex>
					</div>
					{footerFilingEnabled && (
						<>
							<div className={styles.formItem}>
								<div className={styles.formItemLabel}>
									<span>{tPlatform("filingNumber")}</span>
									<span className={styles.formItemLabelRequired}>*</span>
								</div>
								<Flex flex={1} className={styles.formItemContent}>
									<Form.Item
										name={["footer", "filing", "number"]}
										noStyle
										rules={[
											{
												required: footerFilingEnabled,
												message: tPlatform("filingNumberRequired"),
											},
										]}
									>
										<MagicInput
											placeholder={tPlatform("filingNumberPlaceholder")}
										/>
									</Form.Item>
								</Flex>
							</div>
							<div className={styles.formItem}>
								<div className={styles.formItemLabel}>
									{tPlatform("filingLink")}
								</div>
								<Flex flex={1} className={styles.formItemContent}>
									<Form.Item
										name={["footer", "filing", "link"]}
										noStyle
										rules={[
											{
												pattern: /^https?:\/\/.+/,
												message: tPlatform("filingLinkInvalid"),
											},
										]}
									>
										<MagicInput
											placeholder={tPlatform("filingLinkPlaceholder")}
										/>
									</Form.Item>
								</Flex>
							</div>
						</>
					)}
				</Flex>
			</Form>
		</BaseLayout>
	)
}

export default InfoManagementPage
