import type { FormItemProps } from "antd"
import { Form } from "antd"
import { memo } from "react"
import type { DefaultOptionType } from "antd/es/select"
import MagicSelect from "../MagicSelect"
import { useStyles } from "./style"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicInput from "../MagicInput"

export interface PhoneInputProps extends FormItemProps {
	options: DefaultOptionType[]
}

const PhoneInput = ({ options, ...props }: PhoneInputProps) => {
	const { styles } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("PhoneInput")

	return (
		<Form.Item label={locale.phone} className={styles.phoneInputWrapper} {...props}>
			<Form.Item name="state_code" noStyle initialValue={options?.[0]?.value}>
				<MagicSelect options={options} style={{ width: "24%" }} />
			</Form.Item>
			<Form.Item
				name="mobile"
				noStyle
				style={{ width: "76%" }}
				dependencies={["state_code"]}
				rules={[
					{ required: true, message: "" },
					{
						validator: (_, value) => {
							if (!value) return Promise.resolve()

							// 基本手机号码格式验证（只包含数字，长度在7-15位之间）
							const phoneRegex = /^[0-9]{7,15}$/

							if (!phoneRegex.test(value)) {
								return Promise.reject(new Error(locale.phoneFormatError))
							}

							return Promise.resolve()
						},
					},
				]}
			>
				<MagicInput />
			</Form.Item>
		</Form.Item>
	)
}

export default memo(PhoneInput)
