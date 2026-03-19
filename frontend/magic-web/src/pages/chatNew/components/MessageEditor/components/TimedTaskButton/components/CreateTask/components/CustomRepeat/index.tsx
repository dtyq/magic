import { Form, Flex, Select } from "antd"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { TimeSelect } from "../TimeSelect"
import { Units, WEEK_OPTION, MONTH_OPTION, YEAR_OPTION } from "../../constant"
import { CustomSelect } from "../CustomSelect"

interface CustomRepeatProps {
	type: Units
}

export const CustomRepeat = memo(function CustomRepeat(props: CustomRepeatProps) {
	const { t } = useTranslation("interface")
	const { type } = props

	const weekOption = useMemo(() => WEEK_OPTION(t), [t])
	const monthOption = useMemo(() => MONTH_OPTION(t), [t])
	const yearOption = useMemo(() => YEAR_OPTION(t), [t])

	const content = useMemo(() => {
		switch (type) {
			case Units.DAY:
				return <TimeSelect />
			case Units.WEEK:
				return (
					<CustomSelect
						mode="multiple"
						name={["value", "values"]}
						message={t("chat.timedTask.weeklyTimePlaceholder")}
						width={50}
						options={weekOption}
					/>
				)
			case Units.MONTH:
				return (
					<CustomSelect
						mode="multiple"
						name={["value", "values"]}
						message={t("chat.timedTask.monthlyTimePlaceholder")}
						width={50}
						options={monthOption}
					/>
				)
			case Units.YEAR:
				return (
					<Flex gap={4}>
						<Form.Item
							noStyle
							name={["value", "month"]}
							initialValue={yearOption[0].value}
							rules={[
								{
									required: true,
									message: t("chat.timedTask.yearlyTimePlaceholder"),
								},
							]}
						>
							<Select options={yearOption} style={{ width: "33%" }} />
						</Form.Item>
						<CustomSelect
							name={["value", "values"]}
							mode="multiple"
							message={t("chat.timedTask.monthlyTimePlaceholder")}
							width={50}
							options={monthOption}
						/>
					</Flex>
				)
			default:
				return null
		}
	}, [monthOption, t, type, weekOption, yearOption])

	return content
})
