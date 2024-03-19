import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import dayjs from "@/opensource/lib/dayjs"
import { MagicDatePicker, MagicSelect, MagicTimePicker } from "@/opensource/components/base"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { ScheduledTask } from "@/opensource/types/scheduledTask"
import { DEFAULT_TIME, DAY_OPTIONS, SCHEDULE_OPTIONS, WEEKDAY_OPTIONS } from "../constants"
import { useScheduledItemStyles } from "../styles"
import type { ScheduleFormValues, ScheduledItemProps } from "../types"
import { configToFormValues, formValuesToConfig, validateScheduleConfig } from "../utils"

export function ScheduledItem({ value, onChange, disabled }: ScheduledItemProps) {
	const { t } = useTranslation("interface")
	const { styles } = useScheduledItemStyles()
	const [formValues, setFormValues] = useState<ScheduleFormValues>(() => {
		if (value) return configToFormValues(value)
		return {
			scheduleType: ScheduledTask.ScheduleType.Once,
			time: DEFAULT_TIME,
		}
	})

	useEffect(() => {
		if (value) setFormValues(configToFormValues(value))
	}, [value])

	const updateFormValues = useMemoizedFn((updates: Partial<ScheduleFormValues>) => {
		const nextValues = { ...formValues, ...updates }
		setFormValues(nextValues)
		const config = formValuesToConfig(nextValues)

		if (config && validateScheduleConfig(config)) onChange?.(config)
		else magicToast.error(t("accountPanel.timedTasks.scheduleConfigTimeInvalid"))
	})

	const handleScheduleTypeChange = useMemoizedFn((scheduleType: ScheduledTask.ScheduleType) => {
		const baseValues: ScheduleFormValues = {
			scheduleType,
			time: formValues.time || DEFAULT_TIME,
		}

		switch (scheduleType) {
			case ScheduledTask.ScheduleType.Once:
				baseValues.day = dayjs().add(1, "day").format("YYYY-MM-DD")
				break
			case ScheduledTask.ScheduleType.Weekly:
				baseValues.day = "1"
				break
			case ScheduledTask.ScheduleType.Monthly:
				baseValues.day = "1"
				break
		}

		updateFormValues(baseValues)
	})

	const renderTimeSelector = () => (
		<MagicTimePicker
			defaultValue={
				formValues.time ? dayjs(`2000-01-01 ${formValues.time}`, "HH:mm") : undefined
			}
			onChange={(time) => {
				if (time) updateFormValues({ time: time.format("HH:mm") })
			}}
			format="HH:mm"
			disabled={disabled}
			className={styles.selector}
			needConfirm={false}
			changeOnScroll={true}
		/>
	)

	return (
		<div className={styles.container}>
			<div className={styles.column}>
				<MagicSelect
					value={formValues.scheduleType}
					onChange={handleScheduleTypeChange}
					disabled={disabled}
					className={styles.selector}
					options={SCHEDULE_OPTIONS}
				/>
			</div>
			<div className={styles.column}>
				{formValues.scheduleType === ScheduledTask.ScheduleType.Once ? (
					<MagicDatePicker
						value={formValues.day ? dayjs(formValues.day, "YYYY/MM/DD") : undefined}
						onChange={(date) => {
							if (date) updateFormValues({ day: date.format("YYYY-MM-DD") })
						}}
						format="YYYY/MM/DD"
						disabled={disabled}
						disabledDate={(current) => current && current < dayjs().startOf("day")}
						className={styles.selector}
					/>
				) : null}
				{formValues.scheduleType === ScheduledTask.ScheduleType.Daily
					? renderTimeSelector()
					: null}
				{formValues.scheduleType === ScheduledTask.ScheduleType.Weekly ? (
					<MagicSelect
						value={formValues.day}
						onChange={(weekday: string) => updateFormValues({ day: weekday })}
						disabled={disabled}
						className={styles.selector}
						options={WEEKDAY_OPTIONS}
					/>
				) : null}
				{formValues.scheduleType === ScheduledTask.ScheduleType.Monthly ? (
					<MagicSelect
						value={formValues.day}
						onChange={(day: string) => updateFormValues({ day })}
						disabled={disabled}
						className={styles.selector}
						options={DAY_OPTIONS}
					/>
				) : null}
			</div>
			<div className={styles.column}>
				{formValues.scheduleType === ScheduledTask.ScheduleType.Daily
					? null
					: renderTimeSelector()}
			</div>
		</div>
	)
}
