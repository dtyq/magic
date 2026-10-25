import { Check, ChevronDown, Clock3 } from "lucide-react"
import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import type { TimePrecision } from "@magic-admin-v2/components/time-filter-panel/types"
import { cn } from "@magic-admin-v2/utils/cn"
import { useTranslation } from "react-i18next"

type TimePickerProps = {
	/** 是否禁用时间选择器。 */
	disabled?: boolean
	/** 输入控件的无障碍标签。 */
	label: string
	/** 选择时间后返回 HH:00、HH:mm 或 HH:mm:ss 格式的文本。 */
	onChange: (value: string) => void
	/** 时间选择精度；day 由上层日期控件处理。 */
	precision: Exclude<TimePrecision, "day">
	testId?: string
	/** 当前时间文本，格式必须与 precision 对应。 */
	value: string
}

const hourOptions = createOptions(24)
const minuteOptions = createOptions(60)
const secondOptions = createOptions(60)

export function TimePicker({
	disabled = false,
	label,
	onChange,
	precision,
	testId,
	value,
}: TimePickerProps) {
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)
	const [hours, minutes, seconds] = useMemo(() => {
		const [nextHours = "00", nextMinutes = "00", nextSeconds = "00"] = value.split(":")
		return [nextHours, nextMinutes, nextSeconds]
	}, [value])

	function updatePart(part: "hours" | "minutes" | "seconds", nextValue: string) {
		const nextParts = { hours, minutes, seconds, [part]: nextValue }
		onChange(
			precision === "second"
				? `${nextParts.hours}:${nextParts.minutes}:${nextParts.seconds}`
				: precision === "hour"
					? `${nextParts.hours}:00`
					: `${nextParts.hours}:${nextParts.minutes}`,
		)
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				aria-expanded={open}
				aria-label={label}
				className={cn(
					"flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					disabled && "cursor-not-allowed opacity-50 hover:bg-card",
				)}
				disabled={disabled}
				data-testid={testId}
			>
				<span className="flex min-w-0 items-center gap-2">
					<Clock3
						className="size-3.5 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<span className="font-mono tabular-nums">{value || "--:--"}</span>
				</span>
				<ChevronDown
					className={cn(
						"size-3.5 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-1.5"
				data-testid={testId ? `${testId}-content` : undefined}
			>
				<div
					className={cn(
						"grid items-start gap-1",
						precision === "second"
							? "grid-cols-[1fr_auto_1fr_auto_1fr]"
							: precision === "hour"
								? "grid-cols-1"
								: "grid-cols-[1fr_auto_1fr]",
					)}
				>
					<TimeColumn
						label={t("timeFilter.unit.hour")}
						onChange={(nextValue) => updatePart("hours", nextValue)}
						options={hourOptions}
						value={hours}
					/>
					{precision !== "hour" ? (
						<>
							<TimeSeparator />
							<TimeColumn
								label={t("timeFilter.unit.minute")}
								onChange={(nextValue) => updatePart("minutes", nextValue)}
								options={minuteOptions}
								value={minutes}
							/>
						</>
					) : null}
					{precision === "second" ? <TimeSeparator /> : null}
					{precision === "second" ? (
						<TimeColumn
							label={t("timeFilter.unit.second")}
							onChange={(nextValue) => updatePart("seconds", nextValue)}
							options={secondOptions}
							value={seconds}
						/>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	)
}

function TimeColumn({
	label,
	onChange,
	options,
	value,
}: {
	/** 当前列的单位名称，同时用于 listbox 无障碍标签。 */
	label: string
	/** 选择某个时间值后的回调。 */
	onChange: (value: string) => void
	/** 当前列可选的两位数字时间值。 */
	options: string[]
	/** 当前列选中的时间值。 */
	value: string
}) {
	return (
		<div aria-label={label} className="min-w-0" role="listbox">
			<div className="px-1 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<div className="max-h-52 overscroll-contain overflow-y-auto rounded-md bg-muted/30 p-1">
				{options.map((option) => {
					const selected = option === value

					return (
						<button
							aria-selected={selected}
							className={cn(
								"flex h-8 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								selected
									? "bg-primary text-primary-foreground"
									: "text-foreground hover:bg-accent hover:text-accent-foreground",
							)}
							key={option}
							onClick={() => onChange(option)}
							role="option"
							type="button"
							data-testid="time-picker-action-button"
						>
							<span>{option}</span>
							{selected ? <Check className="sr-only" aria-hidden="true" /> : null}
						</button>
					)
				})}
			</div>
		</div>
	)
}

function TimeSeparator() {
	return (
		<span className="mt-8 flex h-8 items-center text-sm font-medium text-muted-foreground">
			:
		</span>
	)
}

function createOptions(size: number) {
	return Array.from({ length: size }, (_, index) => String(index).padStart(2, "0"))
}
