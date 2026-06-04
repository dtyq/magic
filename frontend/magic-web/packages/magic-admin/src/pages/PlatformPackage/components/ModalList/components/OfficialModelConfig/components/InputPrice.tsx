import { memo } from "react"
import type { FormItemProps } from "antd"
import { Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicInputNumberProps } from "@admin-components"
import { MagicInputNumber, MagicSwitch } from "@admin-components"
import { get } from "lodash-es"
import { useStyles } from "../styles"

interface InputPriceProps extends FormItemProps {
	desc?: string
	inputNumberProps: MagicInputNumberProps
	withSwitch?: boolean
}

const InputPrice = memo(
	({ name, label, desc, inputNumberProps, withSwitch = true, ...rest }: InputPriceProps) => {
		const { t } = useTranslation("admin/ai/model")
		const { styles } = useStyles()

		// 生成开关字段名，例如 input_pricing_enabled
		const switchName = withSwitch
			? Array.isArray(name)
				? [...name.slice(0, -1), `${name[name.length - 1]}_enabled`]
				: `${name}_enabled`
			: undefined

		return (
			<Form.Item
				label={
					<Flex gap={10} align="center">
						{label}
						{withSwitch && (
							<Form.Item
								name={switchName}
								noStyle
								valuePropName="checked"
								initialValue
							>
								<MagicSwitch size="small" />
							</Form.Item>
						)}
					</Flex>
				}
				className={styles.formItem}
			>
				<Form.Item
					noStyle
					shouldUpdate={(prevValues, currentValues) => {
						const prevSwitchValue = get(prevValues, switchName)
						const currentSwitchValue = get(currentValues, switchName)

						return prevSwitchValue !== currentSwitchValue
					}}
				>
					{({ getFieldValue }) => {
						const isEnabled = withSwitch
							? Array.isArray(switchName)
								? getFieldValue(switchName[0])?.[switchName[1]]
								: getFieldValue(switchName)
							: false

						return (
							<Flex gap={6} vertical>
								<Form.Item
									name={name}
									style={{ marginBottom: 0 }}
									rules={isEnabled ? [{ required: true, message: "" }] : []}
									{...rest}
								>
									<MagicInputNumber
										placeholder={t("form.pleaseInputPrice")}
										style={{ width: "100%" }}
										disabled={withSwitch && !isEnabled}
										{...inputNumberProps}
									/>
								</Form.Item>
								{desc && <div className={styles.desc}>{desc}</div>}
							</Flex>
						)
					}}
				</Form.Item>
			</Form.Item>
		)
	},
)

export default InputPrice
