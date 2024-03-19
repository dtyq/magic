import { Flex, Form } from "antd"
import { MagicSelect } from "components"
import { memo } from "react"
import { get } from "lodash-es"
import { PlatformPackage } from "@/types/platformPackage"
import InputNumber from "../InputNumber"
import { useGetStyles } from "../../index.page"

interface LimitInputProps {
	label: string
	name1?: string[]
	name: string[] | string
	addonAfter: string
	description?: string
	options?: PlatformPackage.OptionsType[]
}

const LimitInput = memo(
	({ label, name1, name, addonAfter, description, options }: LimitInputProps) => {
		const styles = useGetStyles()

		return (
			<Form.Item label={label} className={styles.formItem} required>
				<Flex gap={10}>
					{name1 && (
						<Form.Item
							noStyle
							name={name1}
							initialValue={PlatformPackage.NumberLimit.Limited}
						>
							<MagicSelect options={options} style={{ width: 120 }} />
						</Form.Item>
					)}
					<Form.Item
						noStyle
						shouldUpdate={(prevValues, currentValues) => {
							if (!name1) return false
							const prevValue = get(prevValues, name1)
							const currentValue = get(currentValues, name1)

							return prevValue !== currentValue
						}}
					>
						{({ getFieldValue }) => {
							return !name1 ||
								getFieldValue(name1) !== PlatformPackage.NumberLimit.Unlimited ? (
								<InputNumber name={name} addonAfter={addonAfter} />
							) : null
						}}
					</Form.Item>
				</Flex>
				{description && <div className={styles.desc}>{description}</div>}
			</Form.Item>
		)
	},
)

export default LimitInput
