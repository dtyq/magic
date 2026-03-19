import type { MagicDatePickerProps } from "./index"
import { DatePicker, DatePickerProps } from "antd"

function MagicDatePickerDesktop(props: MagicDatePickerProps) {
	return <DatePicker {...(props as DatePickerProps)} />
}

export default MagicDatePickerDesktop
