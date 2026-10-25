import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import dayjs from "@/infrastructure/vendors/dayjs"
import MagicTimePicker from "@/components/base/MagicTimePicker"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn-ui/toggle-group"
import { CLAW_CRON_RECURRING_CYCLE, type ClawCronRecurringCycle } from "./claw-cron-task-file"

interface ClawRecurringScheduleFieldsProps {
	cycle: ClawCronRecurringCycle
	time: string
	weekdays: number[]
	monthDays: number[]
	expr: string
	exprError?: string
	/** Popup class names come from the modal so this component stays free of antd-style. */
	timePickerClassNames?: ComponentProps<typeof MagicTimePicker>["classNames"]
	onCycleChange: (cycle: ClawCronRecurringCycle) => void
	onTimeChange: (time: string) => void
	onWeekdaysChange: (weekdays: number[]) => void
	onMonthDaysChange: (monthDays: number[]) => void
	onExprChange: (expr: string) => void
}

export function ClawRecurringScheduleFields({
	cycle,
	time,
	weekdays,
	monthDays,
	expr,
	exprError,
	timePickerClassNames,
	onCycleChange,
	onTimeChange,
	onWeekdaysChange,
	onMonthDaysChange,
	onExprChange,
}: ClawRecurringScheduleFieldsProps) {
	const { t } = useTranslation("interface")

	// Monday first, matching the usual calendar order; values follow cron (0 is Sunday).
	const weekdayOptions = [
		{ value: 1, label: t("accountPanel.timedTasks.clawWeekdayMon") },
		{ value: 2, label: t("accountPanel.timedTasks.clawWeekdayTue") },
		{ value: 3, label: t("accountPanel.timedTasks.clawWeekdayWed") },
		{ value: 4, label: t("accountPanel.timedTasks.clawWeekdayThu") },
		{ value: 5, label: t("accountPanel.timedTasks.clawWeekdayFri") },
		{ value: 6, label: t("accountPanel.timedTasks.clawWeekdaySat") },
		{ value: 0, label: t("accountPanel.timedTasks.clawWeekdaySun") },
	]
	// Ordered as the five cron fields: minute hour day-of-month month day-of-week.
	const cronFieldOptions = [
		{ label: t("accountPanel.timedTasks.clawCronFieldMinute"), range: "0-59" },
		{ label: t("accountPanel.timedTasks.clawCronFieldHour"), range: "0-23" },
		{ label: t("accountPanel.timedTasks.clawCronFieldDay"), range: "1-31" },
		{ label: t("accountPanel.timedTasks.clawCronFieldMonth"), range: "1-12" },
		{ label: t("accountPanel.timedTasks.clawCronFieldWeekday"), range: "0-6" },
	]
	const cronSymbolOptions = [
		{ symbol: "*", label: t("accountPanel.timedTasks.clawCronSymbolAny") },
		{ symbol: ",", label: t("accountPanel.timedTasks.clawCronSymbolList") },
		{ symbol: "-", label: t("accountPanel.timedTasks.clawCronSymbolRange") },
		{ symbol: "/", label: t("accountPanel.timedTasks.clawCronSymbolStep") },
	]
	const isCustomCycle = cycle === CLAW_CRON_RECURRING_CYCLE.Custom
	const isWeeklyCycle = cycle === CLAW_CRON_RECURRING_CYCLE.Weekly
	const isMonthlyCycle = cycle === CLAW_CRON_RECURRING_CYCLE.Monthly
	const isTimeBelowOptions = isWeeklyCycle || isMonthlyCycle
	const hasLateMonthDay = monthDays.some((day) => day > 28)
	const pickerTime = dayjs(`2000-01-01 ${time}`, "YYYY-MM-DD HH:mm", true)

	const timePicker = (
		<div className="flex-1" data-testid="claw-scheduled-task-recurring-time-input">
			<MagicTimePicker
				classNames={timePickerClassNames}
				value={pickerTime.isValid() ? pickerTime : undefined}
				onChange={(nextTime) => {
					if (!nextTime) return
					onTimeChange(nextTime.format("HH:mm"))
				}}
				format="HH:mm"
				needConfirm={false}
				changeOnScroll={true}
				className="w-full"
			/>
		</div>
	)

	function handleNumberListChange(values: string[], onChange: (values: number[]) => void) {
		onChange(values.map(Number).sort((left, right) => left - right))
	}

	return (
		<div className="space-y-2">
			<div className="flex gap-2">
				<Select
					value={cycle}
					onValueChange={(value) => onCycleChange(value as ClawCronRecurringCycle)}
				>
					<SelectTrigger
						className="h-9 flex-1"
						data-testid="claw-scheduled-task-recurring-cycle-select"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={CLAW_CRON_RECURRING_CYCLE.Daily}>
							{t("accountPanel.timedTasks.dailyCycleLabel")}
						</SelectItem>
						<SelectItem value={CLAW_CRON_RECURRING_CYCLE.Weekdays}>
							{t("accountPanel.timedTasks.clawRecurringWeekdays")}
						</SelectItem>
						<SelectItem value={CLAW_CRON_RECURRING_CYCLE.Weekly}>
							{t("accountPanel.timedTasks.clawRecurringWeekly")}
						</SelectItem>
						<SelectItem value={CLAW_CRON_RECURRING_CYCLE.Monthly}>
							{t("accountPanel.timedTasks.clawRecurringMonthly")}
						</SelectItem>
						<SelectItem value={CLAW_CRON_RECURRING_CYCLE.Custom}>
							{t("accountPanel.timedTasks.clawRecurringCustom")}
						</SelectItem>
					</SelectContent>
				</Select>
				{isCustomCycle || isTimeBelowOptions ? null : timePicker}
			</div>

			{isWeeklyCycle ? (
				<ToggleGroup
					type="multiple"
					variant="outline"
					size="sm"
					spacing={1}
					className={selectableGroupClassName}
					value={weekdays.map(String)}
					onValueChange={(values) => handleNumberListChange(values, onWeekdaysChange)}
					data-testid="claw-scheduled-task-recurring-weekdays"
				>
					{weekdayOptions.map((option) => (
						<ToggleGroupItem
							key={option.value}
							value={String(option.value)}
							className={selectableItemClassName}
							data-testid={`claw-scheduled-task-recurring-weekday-${option.value}`}
						>
							{option.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			) : null}

			{isMonthlyCycle ? (
				<div className="space-y-1.5">
					<ToggleGroup
						type="multiple"
						variant="outline"
						size="sm"
						spacing={1}
						className={selectableGroupClassName}
						value={monthDays.map(String)}
						onValueChange={(values) =>
							handleNumberListChange(values, onMonthDaysChange)
						}
						data-testid="claw-scheduled-task-recurring-month-days"
					>
						{MONTH_DAYS.map((day) => (
							<ToggleGroupItem
								key={day}
								value={String(day)}
								className={selectableItemClassName}
								data-testid={`claw-scheduled-task-recurring-month-day-${day}`}
							>
								{day}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					{hasLateMonthDay ? (
						<div className="text-xs text-muted-foreground">
							{t("accountPanel.timedTasks.clawMonthDaySkipHint")}
						</div>
					) : null}
				</div>
			) : null}

			{isTimeBelowOptions ? timePicker : null}

			{isCustomCycle ? (
				<div className="space-y-1.5">
					<div className="text-sm font-medium">
						{t("accountPanel.timedTasks.clawCronExpressionLabel")}
					</div>
					<Input
						value={expr}
						onChange={(event) => onExprChange(event.target.value)}
						placeholder={t("accountPanel.timedTasks.clawCronExpressionPlaceholder")}
						aria-invalid={Boolean(exprError)}
						className="h-9 font-mono"
						data-testid="claw-scheduled-task-recurring-expr-input"
					/>
					{exprError ? <div className="text-xs text-destructive">{exprError}</div> : null}
					<div
						className="space-y-1.5 rounded-md border bg-background p-2 text-xs text-muted-foreground"
						data-testid="claw-scheduled-task-recurring-expr-help"
					>
						<div className="grid grid-cols-5 gap-1 text-center">
							{cronFieldOptions.map((field) => (
								<div key={field.label} className="rounded bg-muted/50 px-1 py-1">
									<div className="font-medium text-foreground">{field.label}</div>
									<div className="font-mono">{field.range}</div>
								</div>
							))}
						</div>
						<div className="flex flex-wrap gap-x-3 gap-y-1">
							{cronSymbolOptions.map((option) => (
								<span
									key={option.symbol}
									className="inline-flex items-center gap-1"
								>
									<code className="rounded bg-muted px-1 font-mono text-foreground">
										{option.symbol}
									</code>
									{option.label}
								</span>
							))}
						</div>
						<div>{t("accountPanel.timedTasks.clawCronSundayHint")}</div>
						<div>{t("accountPanel.timedTasks.clawCronExampleHint")}</div>
					</div>
				</div>
			) : null}
		</div>
	)
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

// ToggleGroup's built-in `spacing` relies on Tailwind v4 `--spacing()`, which this Tailwind 3
// project does not generate, so the gap is set explicitly here.
const selectableGroupClassName = "grid w-full grid-cols-7 gap-1.5"

// The schedule card uses a tinted background, so unselected items sit on bg-background and
// selected items switch to the primary color to stay distinguishable from hover.
const selectableItemClassName =
	"w-full rounded-md bg-background px-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
