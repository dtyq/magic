import { memo, useEffect } from "react"
import { Flex, Form, Input } from "antd"
import type { Rule } from "antd/es/form"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"

export interface FieldConfig {
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
	/* 初始值 */
	initialValue?: string
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
	initialValue,
	isLeftDesc,
}: FormFieldProps) {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles({ isLeftDesc })
	const form = Form.useFormInstance()

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

	useEffect(() => {
		if (initialValue) {
			form.setFieldValue(name, initialValue)
		}
	}, [initialValue, form, name])

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
				<Form.Item
					className={inputType === "textarea" ? styles.textareaFormItem : styles.formItem}
					name={name}
					rules={[...defaultRules, ...rules]}
					normalize={normalize}
				>
					<InputComponent placeholder={placeholder} />
				</Form.Item>
				{!isLeftDesc && description && (
					<div className={styles.labelDesc}>{description}</div>
				)}
			</Flex>
		</Flex>
	)
}

export default memo(FormField)
