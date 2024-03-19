import { memo, useMemo } from "react"
import { Checkbox, Flex, Form, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import { IconTools, IconEyeSpark, IconTopologyStarRing3 } from "@tabler/icons-react"
import type { FormInstance } from "antd/lib"
import { AiModel } from "@/const/aiModel"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "../AddModelModal/styles"
import ModelTemperature from "../ModelTemperature"

interface LlmModelConfigProps {
	innerModelType?: AiModel.ModelTypeGroup | null
	form: FormInstance
}
const LlmModelConfig = ({ innerModelType, form }: LlmModelConfigProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles()

	const { isOfficialOrg } = useAdminStore()

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

			{/* 模型能力 */}
			<Form.Item
				label={t("form.modelPower")}
				name="model_power"
				className={styles.formItem}
				dependencies={["model_type"]}
				initialValue={[AiModel.ModelPower.SupportTool, AiModel.ModelPower.SupportVision]}
				hidden={
					form.getFieldValue("model_type") === AiModel.ModelTypeGroup.Embedding ||
					innerModelType === AiModel.ModelTypeGroup.Embedding
				}
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
						</Flex>
					))}
				</Checkbox.Group>
			</Form.Item>
		</>
	)
}

export default memo(LlmModelConfig)
