import { memo, useMemo } from "react"
import { Checkbox, Flex, Form, Input, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import { IconTools, IconEyeSpark, IconTopologyStarRing3 } from "@tabler/icons-react"
import type { FormInstance } from "antd/lib"
import { MagicSelect } from "@admin-components"
import { AiModel } from "@admin/const/aiModel"
import { useAdminStore } from "@admin/stores/admin"
import { useStyles } from "../AddModelModal/styles"
import ModelTemperature from "../ModelTemperature"

interface LlmModelConfigProps {
	innerModelType?: AiModel.ModelTypeGroup | null
	form: FormInstance
}
/** 语言模型运行参数与能力配置，思考参数跟随能力展示并在关闭时保留。 */
const LlmModelConfig = ({ innerModelType, form }: LlmModelConfigProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles()

	const { isOfficialOrg } = useAdminStore()
	// 读取当前编辑草稿，接口历史默认值由后端统一提供。
	const modelPower = Form.useWatch<AiModel.ModelPower[]>("model_power", form)
	const selectedLevels = Form.useWatch<AiModel.ReasoningEffort[]>(
		["config", "reasoning_effort_levels"],
		form,
	)
	const supportsThinking = modelPower?.includes(AiModel.ModelPower.SupportThink)
	const effortOptions = [
		{ value: "none", label: t("form.reasoningNone") },
		{ value: "minimal", label: t("form.reasoningMinimal") },
		{ value: "low", label: t("form.reasoningLow") },
		{ value: "medium", label: t("form.reasoningMedium") },
		{ value: "high", label: t("form.reasoningHigh") },
		{ value: "xhigh", label: t("form.reasoningXhigh") },
		{ value: "max", label: t("form.reasoningMax") },
	]

	const powerOptions = useMemo(
		() => [
			{
				label: t("form.supportTool"),
				value: AiModel.ModelPower.SupportTool,
				desc: t("form.supportToolDesc"),
				icon: <IconTools color="currentColor" size={14} />,
			},
			{
				label: t("form.supportVision"),
				value: AiModel.ModelPower.SupportVision,
				desc: t("form.supportVisionDesc"),
				icon: <IconEyeSpark color="currentColor" size={14} />,
			},
			{
				label: t("form.supportThink"),
				value: AiModel.ModelPower.SupportThink,
				desc: t("form.supportThinkDesc"),
				icon: <IconTopologyStarRing3 color="currentColor" size={14} />,
			},
		],
		[t],
	)

	const chatApiOptions = useMemo(
		() => [
			{
				label: t("form.chatApiChatCompletions"),
				value: AiModel.ChatApi.ChatCompletions,
			},
			{
				label: t("form.chatApiResponses"),
				value: AiModel.ChatApi.Responses,
			},
		],
		[t],
	)

	const isEmbedding = innerModelType === AiModel.ModelTypeGroup.Embedding

	return (
		<>
			{/* 最大输出Tokens */}
			<Form.Item
				label={t("form.maxOutPutContext")}
				className={cx(styles.formItem, styles.required)}
				hidden={!isOfficialOrg}
			>
				<Flex gap={6} vertical>
					<Form.Item
						name={["config", "max_output_tokens"]}
						noStyle
						rules={isOfficialOrg ? [{ required: true, message: "" }] : []}
					>
						<InputNumber
							min={0}
							precision={0}
							step={1}
							style={{ width: "100%" }}
							placeholder={t("form.maxOutPutContextPlaceholder")}
						/>
					</Form.Item>
					<div className={styles.desc}>{t("form.maxOutPutContextDesc")}</div>
				</Flex>
			</Form.Item>
			{/* 最大上下文窗口/ 向量维度 */}
			{innerModelType === AiModel.ModelTypeGroup.Embedding ? (
				<Form.Item label={t("form.vectorSize")} className={styles.formItem}>
					<Flex gap={6} vertical>
						<Form.Item name={["config", "vector_size"]} noStyle>
							<InputNumber
								min={0}
								precision={0}
								step={1}
								style={{ width: "100%" }}
								placeholder={t("form.vectorSizePlaceholder")}
							/>
						</Form.Item>
						<div className={styles.desc}>{t("form.vectorSizeDesc")}</div>
					</Flex>
				</Form.Item>
			) : (
				<Form.Item label={t("form.maxContext")} className={styles.formItem}>
					<Flex gap={6} vertical>
						<Form.Item name={["config", "max_tokens"]} noStyle>
							<InputNumber
								min={0}
								precision={0}
								step={1}
								style={{ width: "100%" }}
								placeholder={t("form.maxContextPlaceholder")}
							/>
						</Form.Item>
						<div className={styles.desc}>{t("form.maxContextDesc")}</div>
					</Flex>
				</Form.Item>
			)}
			{/* 创造性温度 */}
			<ModelTemperature isOfficialOrg={isOfficialOrg} />

			{/* OpenAI 兼容聊天接口：name 直接挂在 Form.Item 上，避免嵌套 Flex 导致控件不渲染 */}
			<Form.Item
				label={t("form.chatApi")}
				name={["config", "chat_api"]}
				className={styles.formItem}
				initialValue={AiModel.ChatApi.ChatCompletions}
				hidden={isEmbedding}
				extra={<div className={styles.desc}>{t("form.chatApiDesc")}</div>}
			>
				<MagicSelect options={chatApiOptions} />
			</Form.Item>

			{/* 模型能力 */}
			<Form.Item
				label={t("form.modelPower")}
				name="model_power"
				className={styles.formItem}
				initialValue={[AiModel.ModelPower.SupportTool, AiModel.ModelPower.SupportVision]}
				hidden={isEmbedding}
			>
				<Checkbox.Group className={styles.checkboxGroup}>
					{powerOptions.map(({ value, desc, label, icon }) => (
						<Flex key={value} gap={4} vertical>
							<Checkbox value={value}>
								<Flex gap={4} align="center">
									<div className={styles.icon}>{icon}</div>
									<div className={styles.text0}>{label}</div>
								</Flex>
							</Checkbox>
							<div className={styles.smallDesc}>{desc}</div>
							{value === AiModel.ModelPower.SupportThink && (
								<Flex
									vertical
									gap={12}
									className={styles.reasoningConfig}
									style={{ display: supportsThinking ? undefined : "none" }}
								>
									<Form.Item
										label={t("form.reasoningLevels")}
										name={["config", "reasoning_effort_levels"]}
									>
										<Checkbox.Group
											options={effortOptions}
											onChange={(levels) => {
												// 编辑时移除默认档位，同步重置选择，避免保留不可见的默认项。
												const current = form.getFieldValue([
													"config",
													"reasoning_effort_default",
												])
												if (current !== null && !levels.includes(current))
													form.setFieldValue(
														["config", "reasoning_effort_default"],
														null,
													)
											}}
										/>
									</Form.Item>
									<Form.Item label={t("form.reasoningDefault")}>
										<Form.Item
											name={["config", "reasoning_effort_default"]}
											noStyle
											getValueProps={(value) => ({
												value: value === null ? "provider_default" : value,
											})}
											getValueFromEvent={(value) =>
												value === "provider_default" ? null : value
											}
										>
											<MagicSelect
												options={[
													{
														value: "provider_default",
														label: t("form.reasoningProviderDefault"),
													},
													...effortOptions.filter((option) =>
														selectedLevels?.some(
															(level) => level === option.value,
														),
													),
												]}
											/>
										</Form.Item>
									</Form.Item>
								</Flex>
							)}
						</Flex>
					))}
				</Checkbox.Group>
			</Form.Item>
			<Form.Item label={t("form.extraHeader")} className={styles.formItem}>
				<Flex gap={6} vertical>
					<Form.Item name={["extra", "extra_header"]} noStyle>
						<Input.TextArea placeholder={t("form.extraHeaderPlaceholder")} rows={4} />
					</Form.Item>
					<div className={styles.desc}>{t("form.extraHeaderDesc")}</div>
				</Flex>
			</Form.Item>
			<Form.Item label={t("form.extraBody")} className={styles.formItem}>
				<Flex gap={6} vertical>
					<Form.Item name={["extra", "extra_body"]} noStyle>
						<Input.TextArea placeholder={t("form.extraBodyPlaceholder")} rows={4} />
					</Form.Item>
					<div className={styles.desc}>{t("form.extraBodyDesc")}</div>
				</Flex>
			</Form.Item>
		</>
	)
}

export default memo(LlmModelConfig)
