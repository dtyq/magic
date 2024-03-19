import { type TimePickerProps } from "antd"
import dayjs from "@/opensource/lib/dayjs"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicTimePickerDesktop from "./MagicTimePickerDesktop"
import MagicTimePickerMobile from "./MagicTimePickerMobile"

export interface MagicTimePickerProps extends Omit<
	TimePickerProps,
	"defaultValue" | "value" | "onChange"
> {
	/**
	 * Default value, can be a dayjs object or a string in "HH:mm" format
	 */
	defaultValue?: dayjs.Dayjs | string | null
	/**
	 * Current value, can be a dayjs object or a string in "HH:mm" format
	 */
	value?: dayjs.Dayjs | string | null
	/**
	 * Callback when time changes
	 */
	onChange?: (time: dayjs.Dayjs | null) => void
	/**
	 * Time format, defaults to "HH:mm"
	 */
	format?: string
	/**
	 * Whether to need confirm before closing, defaults to false
	 */
	needConfirm?: boolean
	/**
	 * Whether to change value on scroll, defaults to true
	 */
	changeOnScroll?: boolean
}

/**
 * MagicTimePicker - A responsive time picker component
 * with convenient defaults and string format support
 *
 * Features:
 * - Automatically switches between Desktop (Ant Design TimePicker) and Mobile (shadcn/ui + MagicPopup) implementations
 * - Supports string format ("HH:mm") for defaultValue and value
 * - Default format: "HH:mm"
 * - Default needConfirm: false
 * - Default changeOnScroll: true
 */
function MagicTimePicker(props: MagicTimePickerProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <MagicTimePickerMobile {...props} />
	}

	return <MagicTimePickerDesktop {...props} />
}

export default MagicTimePicker
