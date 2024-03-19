import { useCallback, useMemo } from "react"
import { cloneDeep } from "lodash-es"
import dayjs from "@/opensource/lib/dayjs"
import { DatePicker, Radio } from "antd"
import { cx } from "antd-style"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useTranslation } from "react-i18next"
import type { TimeTriggerParams } from "../../types"
import { UNIT_OPTIONS, Units, WEEK_MAP } from "../../constants"
import styles from "./index.module.less"

type CustomRepeatProps = {
	value?: TimeTriggerParams["value"]
	onChange?: (value: TimeTriggerParams["value"]) => void
}

const CustomRepeat = ({ value, onChange }: CustomRepeatProps) => {
	const { t } = useTranslation()
	const displayValue = useMemo(() => {
		const copyValue = cloneDeep(!value ? {} : value)
		return copyValue as TimeTriggerParams["value"]
	}, [value])

	const rateOptions = useMemo(() => {
		const options = []
		for (let i = 1; i <= 30; i += 1) {
			options.push({
				label: `${i}`,
				id: `${i}`,
			})
		}
		return options
	}, [])

	const updateInterval = useCallback(
		(val: number) => {
			onChange?.({
				...displayValue,
				interval: val,
				values: [],
			})
		},
		[displayValue, onChange],
	)

	const updateUnit = useCallback(
		(val: Units) => {
			onChange?.({
				...displayValue,
				unit: val,
				values: [],
			})
		},
		[displayValue, onChange],
	)

	const updateDeadline = useCallback(
		(e: any) => {
			onChange?.({
				...displayValue,
				deadline: e.target.value === 1 ? null : dayjs().format("YYYY-MM-DD"),
			})
		},
		[displayValue, onChange],
	)

	const updateExpiryDate = useCallback(
		(
			// @ts-ignore
			dayJsDate: any,
			dateStr: string | string[],
		) => {
			onChange?.({
				...displayValue,
				deadline: dateStr as string,
			})
		},
		[onChange, displayValue],
	)

	const onChecked = useCallback(
		(val: number) => {
			if (!Array.isArray(displayValue.values)) {
				onChange?.({ ...displayValue, values: [val] })
				return
			}

			const copyValue = cloneDeep(displayValue)
			const index = copyValue.values.indexOf(val)
			if (index === -1) copyValue.values.push(val)
			else copyValue.values.splice(index, 1)
			onChange?.(copyValue)
		},
		[displayValue, onChange],
	)

	const deadType = useMemo(() => {
		return displayValue.deadline ? 2 : 1
	}, [displayValue])

	const deadline = useMemo(() => {
		return displayValue.deadline ? dayjs(displayValue.deadline) : null
	}, [displayValue])

	return (
		<div className={styles.customRepeat}>
			<p>{t("start.repeatCustom", { ns: "flow" })}</p>
			<div className={styles.repeatRate}>
				<p>{t("start.repeatFrequency", { ns: "flow" })}</p>
				<div className={styles.repeatType}>
					<span>{t("start.per", { ns: "flow" })}</span>
					<MagicSelect
						onChange={updateInterval}
						value={displayValue.interval}
						options={rateOptions}
						fieldNames={{ value: "id" }}
					/>
					<MagicSelect
						onChange={updateUnit}
						value={displayValue.unit}
						options={UNIT_OPTIONS}
						fieldNames={{ value: "id" }}
					/>
				</div>
				{displayValue.unit === Units.WEEK && (
					<div className={styles.rate}>
						{new Array(7).fill(0).map((unit, index) => {
							return (
								<span
									onClick={() => onChecked(index)}
									className={cx({
										[styles.checked]: displayValue?.values?.includes(index),
									})}
									key={`${unit}_${index}`}
								>
									{WEEK_MAP[`${index}`]}
								</span>
							)
						})}
					</div>
				)}

				{displayValue.unit === Units.MONTH && (
					<div className={cx(styles.rate, styles.dateRate)}>
						{new Array(31).fill(0).map((unit, index) => {
							const val = index + 1
							return (
								<span
									onClick={() => onChecked(val)}
									className={cx({
										[styles.checked]: displayValue?.values?.includes(val),
									})}
									key={`${unit}_${index}`}
								>
									{val}
								</span>
							)
						})}
					</div>
				)}
			</div>
			<div className={styles.deadline}>
				<p>{t("start.endTime", { ns: "flow" })}</p>
				<Radio.Group onChange={updateDeadline} value={deadType}>
					<Radio value={1}>{t("start.neverEnd", { ns: "flow" })}</Radio>
					<Radio value={2} />
				</Radio.Group>
				<DatePicker
					value={deadline}
					onChange={updateExpiryDate}
					suffixIcon={null}
					placeholder={t("common.pleaseSelect", { ns: "flow" })}
				/>
			</div>
		</div>
	)
}

export default CustomRepeat
