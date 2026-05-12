import { useState, useMemo, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Picker } from "antd-mobile"
import type { PickerValue } from "antd-mobile/es/components/picker"
import dayjs from "@/lib/dayjs"
import type { MagicTimePickerProps } from "./index"
import { useTranslation } from "react-i18next"

// Generate hour options (0-23)
const generateHourOptions = () => {
	const options = []
	for (let hour = 0; hour < 24; hour += 1) {
		const hourStr = hour.toString().padStart(2, "0")
		options.push({ label: hourStr, value: hourStr })
	}
	return options
}

// Generate minute options (0-59)
const generateMinuteOptions = () => {
	const options = []
	for (let minute = 0; minute < 60; minute += 1) {
		const minuteStr = minute.toString().padStart(2, "0")
		options.push({ label: minuteStr, value: minuteStr })
	}
	return options
}

function MagicTimePickerMobile({
	defaultValue,
	value,
	onChange,
	format = "HH:mm",
	disabled,
	disabledTime,
	className,
	placeholder,
}: MagicTimePickerProps) {
	const { t } = useTranslation("component")
	const [visible, setVisible] = useState(false)
	const [selectedTime, setSelectedTime] = useState<[string, string]>(["00", "00"])

	const allHourOptions = useMemo(() => generateHourOptions(), [])
	const allMinuteOptions = useMemo(() => generateMinuteOptions(), [])

	const disabledHourValues = useMemo(() => {
		if (!disabledTime) return new Set<number>()

		const pickerTime = dayjs(
			`2000-01-01 ${selectedTime[0] || "00"}:${selectedTime[1] || "00"}`,
			"YYYY-MM-DD HH:mm",
		)
		return new Set(disabledTime(pickerTime)?.disabledHours?.() || [])
	}, [disabledTime, selectedTime])

	const hourOptions = useMemo(
		() => allHourOptions.filter((option) => !disabledHourValues.has(Number(option.value))),
		[allHourOptions, disabledHourValues],
	)

	const resolvedHourValue = useMemo(() => {
		if (hourOptions.some((option) => option.value === selectedTime[0])) return selectedTime[0]
		return hourOptions[0]?.value?.toString() || "00"
	}, [hourOptions, selectedTime])

	const disabledMinuteValues = useMemo(() => {
		if (!disabledTime) return new Set<number>()

		const pickerTime = dayjs(
			`2000-01-01 ${resolvedHourValue}:${selectedTime[1] || "00"}`,
			"YYYY-MM-DD HH:mm",
		)
		return new Set(disabledTime(pickerTime)?.disabledMinutes?.(Number(resolvedHourValue)) || [])
	}, [disabledTime, resolvedHourValue, selectedTime])

	const minuteOptions = useMemo(
		() => allMinuteOptions.filter((option) => !disabledMinuteValues.has(Number(option.value))),
		[allMinuteOptions, disabledMinuteValues],
	)

	useEffect(() => {
		if (!hourOptions.length || !minuteOptions.length) return

		const nextHourValue = resolvedHourValue
		const nextMinuteValue = minuteOptions.some((option) => option.value === selectedTime[1])
			? selectedTime[1]
			: minuteOptions[0]?.value?.toString() || "00"

		if (selectedTime[0] === nextHourValue && selectedTime[1] === nextMinuteValue) return
		setSelectedTime([nextHourValue, nextMinuteValue])
	}, [hourOptions, minuteOptions, resolvedHourValue, selectedTime])

	// Picker columns configuration
	const columns = useMemo(() => [hourOptions, minuteOptions], [hourOptions, minuteOptions])

	// Initialize selected time from value or defaultValue
	useEffect(() => {
		const timeValue = value ?? defaultValue
		if (timeValue) {
			let timeStr: string
			if (typeof timeValue === "string") {
				timeStr = timeValue
			} else {
				timeStr = timeValue.format(format)
			}
			const [hour, minute] = timeStr.split(":")
			if (hour && minute) {
				setSelectedTime([hour, minute])
			}
		}
	}, [value, defaultValue, format])

	// Get display text
	const displayText = useMemo(() => {
		if (selectedTime[0] && selectedTime[1]) {
			return `${selectedTime[0]}:${selectedTime[1]}`
		}
		return placeholder || t("magicTimePicker.selectTime")
	}, [selectedTime, placeholder, t])

	// Handle confirm
	const handleConfirm = (pickerValue: PickerValue[]) => {
		const hour = pickerValue[0] as string
		const minute = pickerValue[1] as string
		if (hour && minute) {
			setSelectedTime([hour, minute])
			const timeStr = `${hour}:${minute}`
			const timeObj = dayjs(`2000-01-01 ${timeStr}`, "YYYY-MM-DD HH:mm")
			onChange?.(timeObj)
		}
		setVisible(false)
	}

	return (
		<>
			<button
				type="button"
				onClick={() => !disabled && setVisible(true)}
				disabled={disabled}
				className={cn(
					"flex h-9 w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-ring/50",
					"focus-visible:border-ring focus-visible:ring-[3px]",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"data-[placeholder]:text-muted-foreground",
					className,
				)}
				data-placeholder={!displayText || displayText === placeholder}
			>
				<Clock className="size-4 opacity-50" />
				<span className="line-clamp-1">{displayText}</span>
			</button>

			<Picker
				title={t("magicTimePicker.selectTime")}
				columns={columns}
				visible={visible}
				value={selectedTime}
				onClose={() => setVisible(false)}
				onConfirm={handleConfirm}
			/>
		</>
	)
}

export default MagicTimePickerMobile
