import type { DatePickerProps } from "antd"
import { DatePicker } from "antd"
import type { RangePickerProps } from "antd/es/date-picker"
import { IconCalendarClock } from "@tabler/icons-react"
import { useStyles } from "./style"

export type MagicDatePickerProps = DatePickerProps
export type MagicDatePickerRangePickerProps = RangePickerProps
const MagicDatePicker = ({ className, ...props }: MagicDatePickerProps) => {
	const { styles, cx } = useStyles()
	return <DatePicker className={cx(styles.datePicker, className)} {...props} />
}

const MagicDatePickerRangePicker = ({ className, ...props }: MagicDatePickerRangePickerProps) => {
	const { styles, cx } = useStyles()
	return (
		<DatePicker.RangePicker
			className={cx(styles.datePickerRangePicker, className)}
			separator="~"
			suffixIcon={<IconCalendarClock color="currentColor" size={16} />}
			{...props}
		/>
	)
}

MagicDatePicker.RangePicker = MagicDatePickerRangePicker
MagicDatePicker.MonthPicker = DatePicker.MonthPicker
MagicDatePicker.YearPicker = DatePicker.YearPicker
MagicDatePicker.WeekPicker = DatePicker.WeekPicker
MagicDatePicker.QuarterPicker = DatePicker.QuarterPicker
MagicDatePicker.TimePicker = DatePicker.TimePicker

export default MagicDatePicker
