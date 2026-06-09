/* eslint-disable react/no-array-index-key */
import { memo, useMemo } from "react"
import { Flex, Form, Upload, message } from "antd"
import { IconUpload } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { MagicButton, MagicSelect } from "@admin-components"
import { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import { useStyles } from "./styles"
import FormField from "./FormField"
import type { FieldConfig } from "./FormField"
import { useIsMobile } from "@admin/hooks/useIsMobile"
import { providersByCategory, serviceAccountFields } from "./const"

interface ConfigFormProps {
	/* 服务商名称 */
	name?: string
	/* 服务商编码 */
	code: AiModel.ServiceProvider
	/* 服务商种类 */
	category?: AiModel.ServiceProviderCategory
	/* 描述位置 */
	descPosition?: "left" | "right"
}

const ConfigForm = memo(({ category, code, name, descPosition = "left" }: ConfigFormProps) => {
	const { styles, cx } = useStyles({ isLeftDesc: descPosition === "left" })
	const { t } = useTranslation("admin/ai/model")
	const isMobile = useIsMobile()

	const form = Form.useFormInstance()
	const authType = Form.useWatch(["config", "auth_type"], form)

	const {
		shouldShowApiKey,
		shouldShowApiAgent,
		useApiVersion,
		useAccessKey,
		useSecretKey,
		useRegion,
	} = useMemo(() => {
		if (!category) {
			return {
				shouldShowApiKey: false,
				shouldShowApiAgent: false,
				useApiVersion: [AiModel.ServiceProvider.MicrosoftAzure],
				useAccessKey: [AiModel.ServiceProvider.AWSBedrock],
				useSecretKey: [AiModel.ServiceProvider.AWSBedrock],
				useRegion: [],
			}
		}

		const config = providersByCategory[category]
		return {
			// 默认开启，只排除特定服务商
			shouldShowApiKey: !config?.excludeApiKey?.includes(code),
			shouldShowApiAgent: !config?.excludeApiAgent?.includes(code),
			useApiVersion: config?.apiVersion || [],
			useAccessKey: config?.accessKey || [],
			useSecretKey: config?.secretKey || [],
			useRegion: config?.region || [],
		}
	}, [category, code])

	const isLeftDesc = useMemo(() => {
		return descPosition === "left"
	}, [descPosition])

	const innerName = useMemo(() => {
		switch (code) {
			case AiModel.ServiceProvider.MicrosoftAzure:
				return "Azure"
			case AiModel.ServiceProvider.AWSBedrock:
				return "AWS"
			default:
				return ""
		}
	}, [code])

	const isGoogle = useMemo(() => {
		return [
			AiModel.ServiceProvider.GoogleImage,
			AiModel.ServiceProvider.Gemini,
			AiModel.ServiceProvider.Google,
		].includes(code as unknown as AiModel.ServiceProvider)
	}, [code])

	const options = useMemo(() => {
		return [
			{
				label: "Google AI Studio",
				value: AiManage.AuthType.API_KEY,
			},
			{
				label: "Google Cloud Vertex AI",
				value: AiManage.AuthType.SERVICE_ACCOUNT,
			},
		]
	}, [])

	/* 构建字段配置 */
	const fieldConfigs = useMemo((): FieldConfig[] => {
		const configs: FieldConfig[] = []

		/* Google Service Account 字段配置 */
		if (isGoogle && authType === AiManage.AuthType.SERVICE_ACCOUNT) {
			configs.push(
				{
					name: ["config", "project_id"],
					label: "Project ID",
					description: t("form.projectIdDesc"),
					placeholder: `${t("apiKeyPlaceholder")} ${t("form.projectId")}`,
					required: true,
					shouldShow: true,
				},
				{
					name: ["config", "private_key_id"],
					label: "Private Key ID",
					description: t("form.privateKeyId"),
					placeholder: `${t("apiKeyPlaceholder")} ${t("form.privateKeyId")}`,
					required: true,
					inputType: "password",
					shouldShow: true,
				},
				{
					name: ["config", "private_key"],
					label: "Private Key",
					description: t("form.privateKey"),
					placeholder: t("form.privateKeyDesc"),
					required: true,
					inputType: "textarea",
					shouldShow: true,
				},
				{
					name: ["config", "client_email"],
					label: "Client Email",
					description: t("form.clientEmailDesc"),
					placeholder: "your-service-account@project.iam.gserviceaccount.com",
					required: true,
					shouldShow: true,
					rules: [
						{
							type: "email",
							message: t("form.pleaseInputEmail"),
						},
					],
				},
				{
					name: ["config", "client_id"],
					label: "Client ID",
					description: t("form.clientId"),
					placeholder: `${t("apiKeyPlaceholder")} ${t("form.clientId")}`,
					required: true,
					shouldShow: true,
				},
				{
					name: ["config", "location"],
					label: "Location",
					description: t("form.locationDesc"),
					placeholder: "Global",
					required: false,
					shouldShow: true,
				},
			)
		}

		/* API Key - 默认开启 */
		if (shouldShowApiKey) {
			configs.push({
				name: ["config", "api_key"],
				label: `${innerName} API Key`,
				description: `${t("apiKeyPlaceholder")} ${innerName} API Key`,
				placeholder: `${name} API Key`,
				required: !isGoogle,
				inputType: "password",
				shouldShow: true,
			})
		}

		/* Access Key */
		if (useAccessKey.includes(code)) {
			configs.push({
				name: ["config", "ak"],
				label: `${innerName} Access Key`,
				description: `${t("apiKeyPlaceholder")} ${innerName} Access Key`,
				placeholder: "AccessKey",
				required: true,
				inputType: "password",
				shouldShow: true,
			})
		}

		/* Secret Key */
		if (useSecretKey.includes(code)) {
			configs.push({
				name: ["config", "sk"],
				label: `${innerName} Secret Key`,
				description: `${t("apiKeyPlaceholder")} ${innerName} Secret Key`,
				placeholder: `${innerName} Secret Key`,
				required: true,
				inputType: "password",
				shouldShow: true,
			})
		}

		/* Region */
		if (useRegion.includes(code)) {
			configs.push({
				name: ["config", "region"],
				label: `${innerName} Region`,
				description: `${t("apiKeyPlaceholder")} ${innerName} Region`,
				placeholder: `${innerName} Region`,
				required: true,
				shouldShow: true,
			})
		}

		/* API 地址 - 默认开启 */
		if (shouldShowApiAgent) {
			const defaultApiUrl = AiModel.ServiceProviderUrl[code]
			configs.push({
				name: ["config", "url"],
				label: t("apiAgent"),
				description:
					code === AiModel.ServiceProvider.MicrosoftAzure
						? t("azureApiAgentPlaceholder")
						: t("apiAgentPlaceholder"),
				placeholder: defaultApiUrl,
				initialValue: defaultApiUrl?.trim() ? defaultApiUrl : undefined,
				required: !isGoogle,
				rules: [
					{
						pattern: /^https?:\/\/[^ ]+$/,
						message: isLeftDesc ? t("apiAgentPlaceholder") : "",
					},
				],
				normalize: (v) => (typeof v === "string" ? v.trim() : v),
				shouldShow: true,
			})
		}

		/* API Version */
		if (useApiVersion.includes(code)) {
			configs.push({
				name: ["config", "api_version"],
				label: `${
					code === AiModel.ServiceProvider.MicrosoftAzure ? "Azure " : ""
				}API Version`,
				description:
					code === AiModel.ServiceProvider.MicrosoftAzure
						? t("azureApiVersionPlaceholder")
						: t("apiVersionPlaceholder"),
				placeholder: "20XX-XX-XX",
				required: false,
				shouldShow: true,
			})
		}

		return configs
	}, [
		isGoogle,
		authType,
		shouldShowApiKey,
		code,
		useAccessKey,
		useSecretKey,
		useRegion,
		shouldShowApiAgent,
		useApiVersion,
		innerName,
		t,
		name,
		isLeftDesc,
	])

	const handleJsonImport = (file: File) => {
		const reader = new FileReader()
		reader.onload = (e) => {
			try {
				const json = JSON.parse(e.target?.result as string)
				form.setFieldsValue({
					config: {
						...form.getFieldValue("config"),
						...json,
					},
				})
				message.success(t("form.importJsonSuccess"))
			} catch {
				message.error(t("form.importJsonError"))
			}
		}
		reader.readAsText(file)
		return false
	}

	return (
		<>
			{/* Google Cloud Vertex AI: 导入 JSON 快速填充 */}
			{isGoogle && authType === AiManage.AuthType.SERVICE_ACCOUNT && (
				<Flex
					justify="space-between"
					gap={isMobile ? 12 : isLeftDesc ? 50 : 0}
					align={isMobile ? "stretch" : isLeftDesc ? "center" : "flex-start"}
					vertical={isMobile}
				>
					<Flex
						gap={4}
						vertical
						className={cx(styles.label, isMobile && styles.labelMobile)}
					>
						<div className={styles.labelText}>Google Cloud Vertex AI JSON</div>
						{isLeftDesc && (
							<div className={styles.labelDesc}>{t("form.importJsonDesc")}</div>
						)}
					</Flex>
					<Flex flex={60}>
						<Upload
							accept=".json,application/json"
							showUploadList={false}
							beforeUpload={handleJsonImport}
						>
							<MagicButton type="default" icon={<IconUpload size={14} />}>
								{t("form.importJson")}
							</MagicButton>
						</Upload>
					</Flex>
				</Flex>
			)}

			{/* 谷歌认证类型 */}
			{isGoogle && (
				<Flex
					justify="space-between"
					gap={isMobile ? 12 : isLeftDesc ? 50 : 0}
					align={isMobile ? "stretch" : "center"}
					vertical={isMobile}
				>
					<div className={cx(styles.label, styles.labelText, styles.required)}>
						{t("form.authType")}
					</div>
					<Form.Item
						name={["config", "auth_type"]}
						noStyle
						initialValue={AiManage.AuthType.API_KEY}
					>
						<MagicSelect
							options={options}
							placeholder={t("form.authTypePlaceholder")}
						/>
					</Form.Item>
				</Flex>
			)}

			{/* 根据认证方式显示不同的表单 */}
			<Form.Item noStyle dependencies={["config", "auth_type"]}>
				{({ getFieldValue }) => {
					const type = getFieldValue(["config", "auth_type"]) || AiManage.AuthType.API_KEY

					/* Google Service Account 认证 */
					if (isGoogle && type === AiManage.AuthType.SERVICE_ACCOUNT) {
						return fieldConfigs
							.filter(
								(config) =>
									config.shouldShow &&
									Array.isArray(config.name) &&
									serviceAccountFields.includes(config.name[1] as string),
							)
							.map((config, index) => (
								<FormField
									key={`${
										Array.isArray(config.name)
											? config.name.join("-")
											: config.name
									}-${index}`}
									{...config}
									isLeftDesc={isLeftDesc}
								/>
							))
					}

					/* 标准认证方式 (API Key) */
					return fieldConfigs
						.filter((config) => config.shouldShow)
						.map((config, index) => (
							<FormField
								key={`${
									Array.isArray(config.name) ? config.name.join("-") : config.name
								}-${index}`}
								{...config}
								isLeftDesc={isLeftDesc}
							/>
						))
				}}
			</Form.Item>
		</>
	)
})

export default ConfigForm
