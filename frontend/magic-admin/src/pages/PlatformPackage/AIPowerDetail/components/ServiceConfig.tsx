import { MagicSelect, SubHeader } from "components"
import { useTranslation } from "react-i18next"
import { Flex, Form, Input } from "antd"
import type { DefaultOptionType } from "antd/es/select"
import { useParams } from "react-router-dom"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { FieldConfig } from "./serviceConfigFields"
import { getServiceFields } from "./serviceConfigFields"
import { useStyles } from "../styles"

interface ServiceConfigProps {
	providerOptions: DefaultOptionType[]
	currentProvider: string // 当前选择的服务商
	onProviderChange?: (provider: string) => void
}

const ServiceConfig = ({
	providerOptions,
	currentProvider,
	onProviderChange,
}: ServiceConfigProps) => {
	const { t } = useTranslation("admin/ai/power")
	const { t: tCommon } = useTranslation("admin/common")
	const isMobile = useIsMobile()
	const { cx, styles } = useStyles({ isMobile })

	const { code } = useParams()

	// 监听服务商变化
	const handleProviderChange = (value: string) => {
		onProviderChange?.(value)
	}

	// 获取配置字段
	const configFields = getServiceFields(code, currentProvider)

	// 渲染表单字段
	const renderField = (field: FieldConfig) => {
		const labelText = field.label ? t(field.label) : ""
		const placeholder = field.placeholder ? t(field.placeholder) : field.placeholder
		const description = field.description ? t(field.description) : field.description

		// 构建字段路径
		const fieldPath = [
			"config",
			"providers",
			...(Array.isArray(field.name) ? field.name : [field.name]),
		]

		// 渲染组件
		let component = null
		switch (field.type) {
			case "select":
				component = (
					<MagicSelect
						placeholder={placeholder || tCommon("pleaseSelect")}
						options={providerOptions}
						onChange={handleProviderChange}
					/>
				)
				break
			case "password":
				component = (
					<Input.Password
						style={{ width: "100%" }}
						placeholder={placeholder || tCommon("pleaseInput")}
					/>
				)
				break
			case "textarea":
				component = (
					<Input.TextArea
						style={{ width: "100%" }}
						placeholder={placeholder || tCommon("pleaseInput")}
						rows={4}
					/>
				)
				break
			case "input":
			default:
				component = (
					<Input
						style={{ width: "100%" }}
						placeholder={placeholder || tCommon("pleaseInput")}
					/>
				)
		}

		return (
			<Flex
				key={String(field.name)}
				vertical={isMobile}
				gap={10}
				justify={isMobile ? "flex-start" : "space-between"}
				align={isMobile ? "flex-start" : "center"}
			>
				<Flex gap={4} vertical className={styles.label}>
					<div className={cx(styles.labelText, field.required && styles.required)}>
						{labelText}
					</div>
					{description && <div className={styles.labelDesc}>{description}</div>}
				</Flex>
				<Form.Item
					className={styles.formItem}
					name={fieldPath}
					rules={[
						{
							required: field.required,
							message: "",
						},
					]}
				>
					{component}
				</Form.Item>
			</Flex>
		)
	}

	return (
		<>
			{/* 服务配置 */}
			<Flex vertical gap={14}>
				<SubHeader title={t("powerConfig")} className={styles.subHeader} />
				{configFields.filter((field) => field.name === "provider").map(renderField)}
			</Flex>

			{/* API 配置 */}
			<Flex vertical gap={14}>
				<SubHeader title={t("APIConfig")} />
				{configFields.filter((field) => field.name !== "provider").map(renderField)}
			</Flex>
		</>
	)
}

export default ServiceConfig
