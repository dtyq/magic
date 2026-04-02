import { memo, useCallback } from "react"
import { Flex, Form, Input, Space } from "antd"
import type { Rule } from "antd/es/form"
import { useTranslation } from "react-i18next"
import { MagicButton } from "components"
import { useStyles } from "./styles"

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
	/* 提交前规范化（如 trim） */
	normalize?: (value: unknown) => unknown
	/* 一键填入默认 API 地址 */
	fillDefaultUrl?: string
}

interface FormFieldProps extends FieldConfig {
	isLeftDesc: boolean
}

/* 通用表单字段组件 */
function FormField({
	name,
	label,
	description,
	placeholder,
	required = false,
	inputType = "text",
	rules = [],
	normalize,
	fillDefaultUrl,
	isLeftDesc,
}: FormFieldProps) {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles({ isLeftDesc })
	const form = Form.useFormInstance()

	const handleFillDefaultUrl = useCallback(() => {
		if (!fillDefaultUrl) return
		form.setFieldValue(name, fillDefaultUrl)
		void form.validateFields([name]).catch(() => {
			/* 仅刷新校验态，失败时保留表单项错误提示 */
		})
	}, [fillDefaultUrl, form, name])

	const defaultRules: Rule[] = required
		? [
				{
					required: true,
					message: isLeftDesc ? `${t("apiKeyPlaceholder")} ${label}` : "",
				},
		  ]
		: []

	const InputComponent =
		inputType === "password"
			? Input.Password
			: inputType === "textarea"
			? Input.TextArea
			: Input

	return (
		<Flex
			justify="space-between"
			gap={isLeftDesc ? 50 : 0}
			align={isLeftDesc ? "center" : "flex-start"}
		>
			<Flex gap={4} vertical className={styles.label}>
				<div className={cx(styles.labelText, required && styles.required)}>{label}</div>
				{isLeftDesc && description && <div className={styles.labelDesc}>{description}</div>}
			</Flex>
			<Flex vertical gap={6} flex={60}>
				<Space.Compact>
					<Form.Item
						className={
							inputType === "textarea" ? styles.textareaFormItem : styles.formItem
						}
						name={name}
						rules={[...defaultRules, ...rules]}
						normalize={normalize}
					>
						<InputComponent placeholder={placeholder} />
					</Form.Item>
					{fillDefaultUrl && inputType === "text" && (
						<MagicButton
							size="small"
							className={styles.fillDefaultUrlBtn}
							onClick={handleFillDefaultUrl}
						>
							{t("form.useDefaultApiUrl")}
						</MagicButton>
					)}
				</Space.Compact>
				{!isLeftDesc && description && (
					<div className={styles.labelDesc}>{description}</div>
				)}
			</Flex>
		</Flex>
	)
}

export default memo(FormField)
