import { Form, Flex, Select } from "antd"
import { memo } from "react"
import type { DefaultOptionType } from "antd/es/select"
import { TimeSelect } from "../TimeSelect"

interface CustomSelectProps {
	name: string | string[]
	message: string
	options: DefaultOptionType[]
	width?: number
	mode?: "multiple" | "tags"
}

export const CustomSelect = memo(
	({ name, message, options, mode, width = 50 }: CustomSelectProps) => {
		return (
			<Flex gap={4}>
				<Form.Item
					noStyle
					name={name}
					rules={[
						{
							required: true,
							message,
						},
					]}
					// initialValue={[options[0].value]}
				>
					<Select
						style={{ width: `${width}%` }}
						options={options}
						mode={mode}
						maxTagCount="responsive"
					/>
				</Form.Item>
				<TimeSelect width={50} />
			</Flex>
		)
	},
)
