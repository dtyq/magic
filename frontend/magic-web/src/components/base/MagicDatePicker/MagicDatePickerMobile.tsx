import { useState, useMemo, useEffect } from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DatePicker } from "antd-mobile"
import dayjs from "@/lib/dayjs"
import type { MagicDatePickerProps } from "./index"
import { useTranslation } from "react-i18next"

function MagicDatePickerMobile({
	defaultValue,
	value,
	onChange,
	format = "YYYY/MM/DD",
	disabled,
	className,
	placeholder,
	disabledDate,
}: MagicDatePickerProps) {
	const { t } = useTranslation("component")
	const [visible, setVisible] = useState(false)
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

	// Initialize selected date from value or defaultValue
	useEffect(() => {
		const dateValue = value ?? defaultValue
		if (dateValue) {
			let dateObj: dayjs.Dayjs
			if (typeof dateValue === "string") {
				dateObj = dayjs(dateValue, format)
			} else {
				dateObj = dateValue
			}
			if (dateObj.isValid()) {
				setSelectedDate(dateObj.toDate())
			}
		} else {
			setSelectedDate(undefined)
		}
	}, [value, defaultValue, format])

	// Get display text
	const displayText = useMemo(() => {
		if (selectedDate) {
			return dayjs(selectedDate).format(format)
		}
		return placeholder || t("magicDatePicker.selectDate")
	}, [selectedDate, format, placeholder, t])

	// Handle confirm
	const handleConfirm = (date: Date | null) => {
		if (date) {
			const dateObj = dayjs(date)
			setSelectedDate(date)
			onChange?.(dateObj)
		} else {
			setSelectedDate(undefined)
			onChange?.(null)
		}
		setVisible(false)
	}

	// Convert disabledDate function to ant-mobile filter format
	// ant-mobile filter returns true if date is ENABLED, false if DISABLED
	// Our disabledDate returns true if date is DISABLED, false if ENABLED
	const filter = useMemo(() => {
		if (!disabledDate) return undefined
		return {
			day: (_val: number, extend: { date: Date }) => {
				const dayjsDate = dayjs(extend.date)
				return !disabledDate(dayjsDate) // Invert: filter returns true for enabled dates
			},
		}
	}, [disabledDate])

	return (
		<>
			<button
				type="button"
				onClick={() => !disabled && setVisible(true)}
				disabled={disabled}
				className={cn(
					"shadow-xs flex h-9 w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-ring/50",
					"focus-visible:border-ring focus-visible:ring-[3px]",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"data-[placeholder]:text-muted-foreground",
					className,
				)}
				data-placeholder={!displayText || displayText === placeholder}
			>
				<CalendarIcon className="size-4 opacity-50" />
				<span className="line-clamp-1">{displayText}</span>
			</button>

			<DatePicker
				title={t("magicDatePicker.selectDate")}
				className="z-popup"
				visible={visible}
				value={selectedDate}
				onClose={() => setVisible(false)}
				onConfirm={handleConfirm}
				filter={filter}
			/>
		</>
	)
}

export default MagicDatePickerMobile
