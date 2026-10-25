import { Checkbox, Flex, Form, message, type FormInstance } from "antd"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagicRadio, MagicSwitch } from "@admin-components"
import type { PlatformWatermarkField, PlatformWatermarkIntensity } from "@admin/types/platformInfo"
import { WATERMARK_FIELD_ORDER } from "./constants"
import { useStyles } from "./styles"

/**
 * 身份水印配置面板。
 *
 * 平台级（平台信息页）与企业组织级（企业功能 - 安全与权限 - 企业水印）使用同一套
 * 配置项与视觉，因此抽成共用组件；两处只通过 `namespace` 区分文案。
 */
export type WatermarkSettingsProps = {
	/** 由父级页面持有表单，保存/取消与页面其它字段共用同一次提交。 */
	form: FormInstance
	/**
	 * 提供水印文案的 i18n 命名空间，两个命名空间必须定义同一组 key：
	 * `watermarkSettingsDescription`、`watermarkEnabled`、`watermarkEnabledDescription`、
	 * `watermarkEnabledLabel`、`watermarkDisabledLabel`、`watermarkContent`、
	 * `watermarkContentDescription`、`watermarkContentRequired`、`watermarkIntensity`、
	 * `watermarkIntensityDescription`、`watermarkIntensityOptions.*`、
	 * `watermarkPreview`、`watermarkPreviewFallback`、`watermarkPreviewTip`、
	 * `watermarkPreviewSamples.*`、`watermarkFields.*`。
	 * `watermarkDefaultTip` 仅在 `showDefaultTip` 为 true 时读取。
	 */
	namespace: string
	canEdit?: boolean
	/**
	 * 是否展示面板底部的说明条。企业水印页不涉及平台全局配置的语义，
	 * 因此关闭该提示；平台信息页保持默认展示。
	 */
	showDefaultTip?: boolean
}

/**
 * 管理页预览必须与前台水印渲染一致，因此文字颜色作为渲染参数内联，
 * 不替换成主题 token（主题切换会改变 token，但前台水印透明度不会变）。
 */
const WATERMARK_DEPTH_CONFIG: Record<PlatformWatermarkIntensity, { textColor: string }> = {
	light: {
		textColor: "rgba(0, 0, 0, 0.03)",
	},
	standard: {
		textColor: "rgba(0, 0, 0, 0.045)",
	},
	strong: {
		textColor: "rgba(0, 0, 0, 0.06)",
	},
}

export default function WatermarkSettings({
	form,
	namespace,
	canEdit = true,
	showDefaultTip = true,
}: WatermarkSettingsProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation(namespace)
	// 表单字段固定挂在 `watermark` 下，与接口请求体结构保持一致。
	const enabled = Form.useWatch(["watermark", "enabled"], form) ?? false
	const fields =
		(Form.useWatch(["watermark", "fields"], form) as PlatformWatermarkField[] | undefined) ?? []
	const intensity =
		(Form.useWatch(["watermark", "depth"], form) as PlatformWatermarkIntensity | undefined) ??
		"light"
	const fieldLabels: Record<PlatformWatermarkField, string> = {
		real_name: t("watermarkFields.real_name"),
		employee_no: t("watermarkFields.employee_no"),
		visit_time: t("watermarkFields.visit_time"),
		department: t("watermarkFields.department"),
		phone: t("watermarkFields.phone"),
		email: t("watermarkFields.email"),
	}
	const sampleValues: Record<PlatformWatermarkField, string> = {
		real_name: t("watermarkPreviewSamples.real_name"),
		employee_no: t("watermarkPreviewSamples.employee_no"),
		visit_time: t("watermarkPreviewSamples.visit_time"),
		department: t("watermarkPreviewSamples.department"),
		phone: t("watermarkPreviewSamples.phone"),
		email: t("watermarkPreviewSamples.email"),
	}

	const previewText = WATERMARK_FIELD_ORDER.filter((field) => fields.includes(field))
		.map((field) => sampleValues[field])
		.join(" · ")
	const previewStyle = WATERMARK_DEPTH_CONFIG[intensity]

	const normalizeContentChange = (nextFields: PlatformWatermarkField[]) => {
		if (enabled && fields.length === 1 && nextFields.length === 0) {
			message.warning(t("watermarkContentRequired"))
			return fields
		}
		return nextFields
	}

	return (
		<>
			<div className={styles.watermarkDescription}>{t("watermarkSettingsDescription")}</div>
			<div className={styles.watermarkGrid}>
				<div className={styles.watermarkPanel}>
					<div className={cx(styles.watermarkRow, styles.watermarkSwitchRow)}>
						<div>
							<div className={styles.watermarkTitle}>{t("watermarkEnabled")}</div>
							<div className={styles.watermarkHint}>
								{t("watermarkEnabledDescription")}
							</div>
						</div>
						<Flex align="center" gap={10}>
							<Form.Item
								name={["watermark", "enabled"]}
								valuePropName="checked"
								noStyle
							>
								<MagicSwitch disabled={!canEdit} />
							</Form.Item>
							<span>
								{enabled ? t("watermarkEnabledLabel") : t("watermarkDisabledLabel")}
							</span>
						</Flex>
					</div>

					<div className={styles.watermarkRow}>
						<div>
							<div className={styles.watermarkTitle}>{t("watermarkContent")}</div>
							<div className={styles.watermarkHint}>
								{t("watermarkContentDescription")}
							</div>
						</div>
						<div className={styles.watermarkControl}>
							<Form.Item
								name={["watermark", "fields"]}
								noStyle
								getValueFromEvent={normalizeContentChange}
								rules={[
									{
										validator: async (_, value: PlatformWatermarkField[]) => {
											if (
												!form.getFieldValue(["watermark", "enabled"]) ||
												value?.length
											)
												return
											throw new Error(t("watermarkContentRequired"))
										},
									},
								]}
							>
								<Checkbox.Group
									className={cx(
										styles.watermarkFields,
										(!enabled || !canEdit) && styles.disabled,
									)}
									disabled={!enabled || !canEdit}
								>
									{WATERMARK_FIELD_ORDER.map((field) => (
										<Checkbox
											key={field}
											value={field}
											disabled={!enabled || !canEdit}
										>
											{fieldLabels[field]}
										</Checkbox>
									))}
								</Checkbox.Group>
							</Form.Item>
						</div>
					</div>

					<div className={styles.watermarkRow}>
						<div>
							<div className={styles.watermarkTitle}>{t("watermarkIntensity")}</div>
							<div className={styles.watermarkHint}>
								{t("watermarkIntensityDescription")}
							</div>
						</div>
						<div className={styles.watermarkControl}>
							<Form.Item name={["watermark", "depth"]} noStyle>
								<MagicRadio.Group
									className={cx(
										styles.intensityGroup,
										(!enabled || !canEdit) && styles.disabled,
									)}
									optionType="button"
									buttonStyle="solid"
									disabled={!enabled || !canEdit}
									options={[
										{
											label: t("watermarkIntensityOptions.light"),
											value: "light",
										},
										{
											label: t("watermarkIntensityOptions.standard"),
											value: "standard",
										},
										{
											label: t("watermarkIntensityOptions.strong"),
											value: "strong",
										},
									]}
								/>
							</Form.Item>
						</div>
					</div>

					{showDefaultTip && (
						<div className={styles.watermarkNotice}>
							<Info size={16} />
							<span>{t("watermarkDefaultTip")}</span>
						</div>
					)}
				</div>

				<div className={styles.previewPanel}>
					<div className={styles.watermarkTitle}>{t("watermarkPreview")}</div>
					<div className={styles.previewBox}>
						<div
							className={styles.previewLayer}
							style={{ opacity: enabled ? 1 : 0.35 }}
						>
							{Array.from({ length: 12 }, (_, index) => (
								<span
									key={index}
									style={{
										color: previewStyle.textColor,
									}}
								>
									{previewText || t("watermarkPreviewFallback")}
								</span>
							))}
						</div>
					</div>
					<div className={styles.watermarkHint}>{t("watermarkPreviewTip")}</div>
				</div>
			</div>
		</>
	)
}
