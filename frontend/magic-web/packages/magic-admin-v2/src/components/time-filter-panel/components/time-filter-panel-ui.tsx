import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { TimePicker } from "@magic-admin-v2/components/time-filter-panel/components/time-picker"
import type { TimePrecision } from "@magic-admin-v2/components/time-filter-panel/types"
import {
	compareDateOnly,
	formatCalendarMonth,
	formatDateTime,
	getCalendarDays,
	isDateBetween,
	isSameDate,
	startOf,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import { cn } from "@magic-admin-v2/utils/cn"

export function TimeOptionButton({
	active,
	children,
	disabled = false,
	onClick,
	testId,
}: {
	/** 当前选项是否处于选中状态。 */
	active?: boolean
	/** 选项按钮中展示的文案或节点。 */
	children: ReactNode
	/** 是否禁止选择当前选项。 */
	disabled?: boolean
	/** 点击选项后的处理函数。 */
	onClick: () => void
	testId?: string
}) {
	return (
		<button
			data-testid={testId}
			className={cn(
				"flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
				active && "bg-accent text-accent-foreground",
				disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-inherit",
			)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<span className="truncate">{children}</span>
			{active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
		</button>
	)
}

export function AbsoluteTimeField({
	disabled,
	label,
	onChange,
	precision,
	testId,
	value,
}: {
	/** 是否禁用时间输入；通常在对应日期尚未选择时禁用。 */
	disabled: boolean
	/** 输入字段的无障碍标签和可见标题。 */
	label: string
	/** 时间文本变化回调，值为 HH:mm 或 HH:mm:ss。 */
	onChange: (value: string) => void
	/** 时间输入精度；day 会在组件内部转换为 minute。 */
	precision: TimePrecision
	testId?: string
	/** 当前时间输入值，格式由 precision 决定。 */
	value: string
}) {
	return (
		<label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
			<span>{label}</span>
			<TimePicker
				disabled={disabled}
				label={label}
				onChange={onChange}
				precision={precision === "day" ? "minute" : precision}
				testId={testId}
				value={value}
			/>
		</label>
	)
}

export function CalendarMonthPanel({
	dateButtonTestId,
	endDate,
	intlLocale,
	maxDate,
	month,
	onSelect,
	startDate,
}: {
	dateButtonTestId?: string
	/** 当前范围结束日期，用于渲染结束标记和范围高亮。 */
	endDate: Date | null
	/** 用于格式化月份标题和星期名称的 Intl locale。 */
	intlLocale: string
	/** 可选择的最大自然日；未设置时不限制。 */
	maxDate?: Date
	/** 要渲染的月份；包含该月的完整日历网格。 */
	month: Date
	/** 选择某一天后的回调。 */
	onSelect: (date: Date) => void
	/** 当前范围开始日期，用于渲染开始标记和范围高亮。 */
	startDate: Date | null
}) {
	const calendarDays = getCalendarDays(month)
	const weekdayLabels = getWeekdayLabels(intlLocale)
	const today = new Date()

	return (
		<div className="bg-background">
			<div className="px-1 pb-2 text-center text-sm font-medium">
				{formatCalendarMonth(month, intlLocale)}
			</div>
			<div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
				{weekdayLabels.map((label) => (
					<div className="py-1" key={label}>
						{label}
					</div>
				))}
			</div>
			<div className="mt-1 grid grid-cols-7 gap-1">
				{calendarDays.map((date) => {
					const isOutsideMonth =
						date.getMonth() !== month.getMonth() ||
						date.getFullYear() !== month.getFullYear()
					const dateKey = formatDateTime(startOf(date, "day")).slice(0, 10)

					if (isOutsideMonth) {
						return <span aria-hidden="true" className="h-8 w-full" key={dateKey} />
					}

					const isRangeStart = isSameDate(date, startDate)
					const isRangeEnd = isSameDate(date, endDate)
					const isSelected = isRangeStart || isRangeEnd
					const isInRange = isDateBetween(date, startDate, endDate)
					const isToday = isSameDate(date, today)
					const isDisabled = maxDate ? compareDateOnly(date, maxDate) > 0 : false

					return (
						<button
							aria-label={dateKey}
							data-testid={dateButtonTestId}
							className={cn(
								"flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isInRange && !isDisabled && "bg-accent text-accent-foreground",
								isToday && !isSelected && "ring-1 ring-border",
								isSelected &&
									"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
								isDisabled &&
									"cursor-not-allowed bg-transparent text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/50",
							)}
							disabled={isDisabled}
							key={dateKey}
							onClick={() => onSelect(new Date(date))}
							type="button"
						>
							{date.getDate()}
						</button>
					)
				})}
			</div>
		</div>
	)
}

function getWeekdayLabels(intlLocale: string) {
	const firstSunday = new Date(2024, 0, 7)

	return Array.from({ length: 7 }, (_, index) =>
		new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(
			new Date(
				firstSunday.getFullYear(),
				firstSunday.getMonth(),
				firstSunday.getDate() + index,
			),
		),
	)
}
