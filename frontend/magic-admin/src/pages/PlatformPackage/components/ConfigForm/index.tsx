/* eslint-disable react/no-array-index-key */
import { memo, useMemo } from "react"
import { Flex, Form, Upload, message } from "antd"
import { IconUpload } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { MagicButton, MagicSelect } from "components"
import type { Rule } from "antd/es/form"
import { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useStyles } from "./styles"
import FormField from "./FormField"

interface FieldConfig {
	/* 字段名称 */
	name: string | string[]
	/* 标签文本 */
	label: string
	/* 描述文本 */
	description?: string
	/* 占位符 */
	placeholder?: string
	/* 是否必填 */
	required?: boolean
	/* 输入类型 */
	inputType?: "text" | "password" | "textarea"
	/* 验证规则 */
	rules?: Rule[]
	/* 提交前规范化（如 trim），可避免尾随空格导致校验报错 */
	normalize?: (value: unknown) => unknown
	/* 显示条件 */
	shouldShow?: boolean
}

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

/* Service Account 专属字段 */
const serviceAccountFields = [
	"project_id",
	"private_key_id",
	"private_key",
	"client_email",
	"client_id",
	"location",
	"api_key",
	"url",
]

/* 服务提供商配置映射 */
const providersByCategory = {
	[AiModel.ServiceProviderCategory.LLM]: {
		apiKey: [
			AiModel.ServiceProvider.MicrosoftAzure,
			AiModel.ServiceProvider.Volcengine,
			AiModel.ServiceProvider.DeepSeek,
			AiModel.ServiceProvider.OpenAI,
			AiModel.ServiceProvider.Official,
			AiModel.ServiceProvider.DashScope,
			AiModel.ServiceProvider.OpenRouter,
		],
		apiAgent: [
			AiModel.ServiceProvider.MicrosoftAzure,
			AiModel.ServiceProvider.Volcengine,
			AiModel.ServiceProvider.DeepSeek,
			AiModel.ServiceProvider.OpenAI,
			AiModel.ServiceProvider.Gemini,
			AiModel.ServiceProvider.DashScope,
			AiModel.ServiceProvider.OpenRouter,
			AiModel.ServiceProvider.Official,
		],
		apiVersion: [AiModel.ServiceProvider.MicrosoftAzure],
		accessKey: [AiModel.ServiceProvider.AWSBedrock],
		secretKey: [AiModel.ServiceProvider.AWSBedrock],
		region: [AiModel.ServiceProvider.AWSBedrock],
	},
	[AiModel.ServiceProviderCategory.VLM]: {
		apiKey: [
			AiModel.ServiceProvider.MicrosoftAzure,
			AiModel.ServiceProvider.TTAPI,
			AiModel.ServiceProvider.Qwen,
			AiModel.ServiceProvider.VolcengineArk,
			AiModel.ServiceProvider.Official,
			AiModel.ServiceProvider.QwenGlobal,
			AiModel.ServiceProvider.OpenRouter,
		],
		apiAgent: [
			AiModel.ServiceProvider.MicrosoftAzure,
			AiModel.ServiceProvider.GoogleImage,
			AiModel.ServiceProvider.Qwen,
			AiModel.ServiceProvider.OpenRouter,
			AiModel.ServiceProvider.Official,
		],
		apiVersion: [AiModel.ServiceProvider.MicrosoftAzure],
		accessKey: [AiModel.ServiceProvider.MiracleVision, AiModel.ServiceProvider.Volcengine],
		secretKey: [AiModel.ServiceProvider.MiracleVision, AiModel.ServiceProvider.Volcengine],
		region: [],
	},
}

const ConfigForm = memo(({ category, code, name, descPosition = "left" }: ConfigFormProps) => {
	const { styles, cx } = useStyles({ isLeftDesc: descPosition === "left" })
	const { t } = useTranslation("admin/ai/model")

	const form = Form.useFormInstance()
	const authType = Form.useWatch(["config", "auth_type"], form)

	const useApiKey = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.apiKey || []
	}, [category])

	const useApiAgent = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.apiAgent || []
	}, [category])

	const useApiVersion = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.apiVersion || [AiModel.ServiceProvider.MicrosoftAzure]
	}, [category])

	const useAccessKey = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.accessKey || [AiModel.ServiceProvider.AWSBedrock]
	}, [category])

	const useSecretKey = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.secretKey || [AiModel.ServiceProvider.AWSBedrock]
	}, [category])

	const useRegion = useMemo<AiModel.ServiceProvider[]>(() => {
		if (!category) return []
		return providersByCategory[category]?.region || []
	}, [category])

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

		/* API Key */
		if (useApiKey.includes(code)) {
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

		/* API 地址 */
		if (useApiAgent.includes(code)) {
			configs.push({
				name: ["config", "url"],
				label: t("apiAgent"),
				description:
					code === AiModel.ServiceProvider.MicrosoftAzure
						? t("azureApiAgentPlaceholder")
						: t("apiAgentPlaceholder"),
				placeholder:
					AiModel.ServiceProviderUrl[
						code as unknown as keyof typeof AiModel.ServiceProviderUrl
					],
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
				description: t("azureApiVersionPlaceholder"),
				placeholder: "20XX-XX-XX",
				required: false,
				shouldShow: true,
			})
		}

		return configs
	}, [
		isGoogle,
		authType,
		useApiKey,
		code,
		useAccessKey,
		useSecretKey,
		useRegion,
		useApiAgent,
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
					gap={isLeftDesc ? 50 : 0}
					align={isLeftDesc ? "center" : "flex-start"}
				>
					<Flex gap={4} vertical className={styles.label}>
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
				<Flex justify="space-between" gap={isLeftDesc ? 50 : 0} align="center">
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
