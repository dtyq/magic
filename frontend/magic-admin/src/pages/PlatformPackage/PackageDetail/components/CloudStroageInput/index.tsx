import { Flex, Form, Select } from "antd"
import { memo, useState } from "react"
import InputNumber from "../InputNumber"
import { useGetStyles } from "../../index.page"

interface CloudStroageInputProps {
	name: string[] | string
	label?: string
	// placeholder?: string
	// precision?: number
}

export const GB = 1024 * 1024 * 1024
export const TB = 1024 * GB

const CloudStroageInput = memo(({ name, label }: CloudStroageInputProps) => {
	const styles = useGetStyles()
	const [unit, setUnit] = useState("GB")
	const form = Form.useFormInstance()

	// 单位转换函数
	const convertValue = (value: number, fromUnit: string, toUnit: string): number => {
		if (!value || fromUnit === toUnit) return value

		// 先转换为字节
		let bytes = value
		if (fromUnit === "GB") {
			bytes = value * GB
		} else if (fromUnit === "TB") {
			bytes = value * TB
		}

		// 再转换为目标单位
		if (toUnit === "B") {
			return Math.round(bytes)
		}
		if (toUnit === "GB") {
			return bytes / GB
		}
		if (toUnit === "TB") {
			return bytes / TB
		}

		return value
	}

	const handleUnitChange = (newUnit: string) => {
		const currentValue = form.getFieldValue(name)
		if (currentValue && currentValue > 0) {
			const convertedValue = convertValue(currentValue, unit, newUnit)
			form.setFieldValue(name, convertedValue)
		}
		setUnit(newUnit)
	}

	return (
		<Form.Item
			label={label}
			required
			className={styles.formItem}
			rules={[{ required: true, message: "" }]}
		>
			<Flex gap={8}>
				<Form.Item noStyle name="cloud_storage_capacity_unit" initialValue="GB">
					<Select
						style={{ width: 120 }}
						options={[
							{ label: "B", value: "B" },
							{ label: "GB", value: "GB" },
							{ label: "TB", value: "TB" },
						]}
						onChange={handleUnitChange}
					/>
				</Form.Item>
				<InputNumber name={name} addonAfter={unit} stringMode />
			</Flex>
		</Form.Item>
	)
})

export default CloudStroageInput
