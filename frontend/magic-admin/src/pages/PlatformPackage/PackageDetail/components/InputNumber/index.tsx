import { Form } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { MagicInputNumber, type MagicInputNumberProps } from "components"
import { useGetStyles } from "../../index.page"

interface InputNumberProps extends Omit<MagicInputNumberProps, "name"> {
	name: string[] | string
	label?: string
	placeholder?: string
}

const InputNumber = memo(
	({ name, label, placeholder, precision = 0, ...props }: InputNumberProps) => {
		const { t: tCommon } = useTranslation("admin/common")
		const styles = useGetStyles()

		return (
			<Form.Item
				name={name}
				label={label}
				required
				className={styles.formItem}
				rules={[{ required: true, message: "" }]}
			>
				<MagicInputNumber
					style={{ width: "100%" }}
					placeholder={
						placeholder ??
						tCommon("pleaseInputPlaceholder", {
							name: label,
						})
					}
					onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
						if (precision !== 0) return
						if (["e", "+", "-", ".", "。"].includes(e.key)) {
							e.preventDefault()
						}
					}}
					min={0}
					step={1}
					precision={precision}
					{...props}
				/>
			</Form.Item>
		)
	},
)

export default InputNumber
