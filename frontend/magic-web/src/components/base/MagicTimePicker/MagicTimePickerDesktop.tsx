import type { MagicTimePickerProps } from "./index"
import { TimePicker, TimePickerProps } from "antd"

function MagicTimePickerDesktop(props: MagicTimePickerProps) {
	return <TimePicker {...(props as TimePickerProps)} />
}

export default MagicTimePickerDesktop
