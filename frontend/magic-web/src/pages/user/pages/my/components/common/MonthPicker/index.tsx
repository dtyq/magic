import { HTMLAttributes, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

type Month = {
	number: number
	name: string
}

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
				secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-md px-3",
				lg: "h-11 rounded-md px-8",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

type MonthCalProps = {
	selectedMonth?: Date
	onMonthSelect?: (date: Date) => void
	onYearForward?: () => void
	onYearBackward?: () => void
	callbacks?: {
		yearLabel?: (year: number) => string
		monthLabel?: (month: Month) => string
	}
	variant?: {
		calendar?: {
			main?: ButtonVariant
			selected?: ButtonVariant
		}
		chevrons?: ButtonVariant
	}
	minDate?: Date
	maxDate?: Date
	disabledDates?: Date[]
	onReset?: () => void
}

type ButtonVariant =
	| "default"
	| "outline"
	| "ghost"
	| "link"
	| "destructive"
	| "secondary"
	| null
	| undefined

function MonthPicker({
	onMonthSelect,
	selectedMonth,
	minDate,
	maxDate,
	disabledDates,
	callbacks,
	onYearBackward,
	onYearForward,
	variant,
	className,
	onReset,
	...props
}: HTMLAttributes<HTMLDivElement> & MonthCalProps) {
	return (
		<div className={cn("w-[280px] min-w-[200px] p-3", className)} {...props}>
			<div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
				<div className="w-full space-y-4">
					<MonthCal
						onMonthSelect={onMonthSelect}
						callbacks={callbacks}
						selectedMonth={selectedMonth}
						onYearBackward={onYearBackward}
						onYearForward={onYearForward}
						variant={variant}
						minDate={minDate}
						maxDate={maxDate}
						disabledDates={disabledDates}
						onReset={onReset}
					></MonthCal>
				</div>
			</div>
		</div>
	)
}

function MonthCal({
	selectedMonth,
	onMonthSelect,
	callbacks,
	variant,
	minDate,
	maxDate,
	disabledDates,
	onYearBackward,
	onYearForward,
	onReset,
}: MonthCalProps) {
	const { t } = useTranslation("interface")

	const MONTHS: Month[][] = useMemo(() => {
		return [
			[
				{ number: 0, name: t("monthPicker.january") },
				{ number: 1, name: t("monthPicker.february") },
				{ number: 2, name: t("monthPicker.march") },
				{ number: 3, name: t("monthPicker.april") },
			],
			[
				{ number: 4, name: t("monthPicker.may") },
				{ number: 5, name: t("monthPicker.june") },
				{ number: 6, name: t("monthPicker.july") },
				{ number: 7, name: t("monthPicker.august") },
			],
			[
				{ number: 8, name: t("monthPicker.september") },
				{ number: 9, name: t("monthPicker.october") },
				{ number: 10, name: t("monthPicker.november") },
				{ number: 11, name: t("monthPicker.december") },
			],
		]
	}, [t])

	const [year, setYear] = useState<number>(
		selectedMonth?.getFullYear() ?? new Date().getFullYear(),
	)
	const [month, setMonth] = useState<number>(selectedMonth?.getMonth() ?? -1)
	const [menuYear, setMenuYear] = useState<number>(year)

	if (minDate && maxDate && minDate > maxDate) minDate = maxDate

	const disabledDatesMapped = disabledDates?.map((d) => {
		return { year: d.getFullYear(), month: d.getMonth() }
	})

	useEffect(() => {
		setMonth(selectedMonth?.getMonth() ?? -1)
	}, [selectedMonth])

	return (
		<>
			<div className="relative flex items-center justify-center pt-1">
				<div className="text-sm font-medium">
					{callbacks?.yearLabel ? callbacks?.yearLabel(menuYear) : menuYear}
				</div>
				<div className="flex items-center space-x-1">
					<button
						onClick={() => {
							setMenuYear(menuYear - 1)
							if (onYearBackward) onYearBackward()
						}}
						className={cn(
							buttonVariants({ variant: variant?.chevrons ?? "outline" }),
							"absolute left-1 inline-flex h-7 w-7 items-center justify-center p-0",
						)}
					>
						<ChevronLeft className="h-4 w-4 opacity-50" />
					</button>
					<button
						onClick={() => {
							setMenuYear(menuYear + 1)
							if (onYearForward) onYearForward()
						}}
						className={cn(
							buttonVariants({ variant: variant?.chevrons ?? "outline" }),
							"absolute right-1 inline-flex h-7 w-7 items-center justify-center p-0",
						)}
					>
						<ChevronRight className="h-4 w-4 opacity-50" />
					</button>
				</div>
			</div>
			<table className="w-full border-collapse space-y-1">
				<tbody>
					{MONTHS.map((monthRow, a) => {
						return (
							<tr key={"row-" + a} className="mt-2 flex w-full">
								{monthRow.map((m) => {
									return (
										<td
											key={m.number}
											className="relative h-10 w-1/4 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md"
										>
											<button
												onClick={() => {
													setMonth(m.number)
													setYear(menuYear)
													if (onMonthSelect)
														onMonthSelect(new Date(menuYear, m.number))
												}}
												disabled={
													(maxDate
														? menuYear > maxDate?.getFullYear() ||
														(menuYear == maxDate?.getFullYear() &&
															m.number > maxDate.getMonth())
														: false) ||
													(minDate
														? menuYear < minDate?.getFullYear() ||
														(menuYear == minDate?.getFullYear() &&
															m.number < minDate.getMonth())
														: false) ||
													(disabledDatesMapped
														? disabledDatesMapped?.some(
															(d) =>
																d.year == menuYear &&
																d.month == m.number,
														)
														: false)
												}
												className={cn(
													buttonVariants({
														variant:
															month == m.number && menuYear == year
																? (variant?.calendar?.selected ??
																	"default")
																: (variant?.calendar?.main ??
																	"ghost"),
													}),
													"h-full w-full p-0 font-normal aria-selected:opacity-100",
												)}
											>
												{callbacks?.monthLabel
													? callbacks.monthLabel(m)
													: m.name}
											</button>
										</td>
									)
								})}
							</tr>
						)
					})}
				</tbody>
			</table>
			<div className="flex justify-center">
				<Button variant="ghost" size="sm" onClick={() => onReset?.()}>
					{t("monthPicker.reset")}
				</Button>
			</div>
		</>
	)
}

MonthPicker.displayName = "MonthPicker"

export { MonthPicker }
