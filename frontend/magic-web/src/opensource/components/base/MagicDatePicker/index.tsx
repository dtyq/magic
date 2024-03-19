import { type DatePickerProps } from "antd"
import dayjs from "@/opensource/lib/dayjs"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicDatePickerDesktop from "./MagicDatePickerDesktop"
import MagicDatePickerMobile from "./MagicDatePickerMobile"

export interface MagicDatePickerProps extends Omit<
	DatePickerProps,
	"defaultValue" | "value" | "onChange" | "disabledDate"
> {
	/**
	 * Default value, can be a dayjs object or a string in the specified format
	 */
	defaultValue?: dayjs.Dayjs | string | null
	/**
	 * Current value, can be a dayjs object or a string in the specified format
	 */
	value?: dayjs.Dayjs | string | null
	/**
	 * Callback when date changes
	 */
	onChange?: (date: dayjs.Dayjs | null) => void
	/**
	 * Date format, defaults to "YYYY/MM/DD"
	 */
	format?: string
	/**
	 * Function to determine if a date should be disabled
	 */
	disabledDate?: (current: dayjs.Dayjs) => boolean
}

/**
 * MagicDatePicker - A responsive date picker component
 * with convenient defaults and string format support
 *
 * Features:
 * - Automatically switches between Desktop (Ant Design DatePicker) and Mobile (shadcn/ui Calendar + MagicPopup) implementations
 * - Supports string format for defaultValue and value
 * - Default format: "YYYY/MM/DD"
 */
function MagicDatePicker(props: MagicDatePickerProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <MagicDatePickerMobile {...props} />
	}

	return <MagicDatePickerDesktop {...props} />
}

export default MagicDatePicker
