import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	AbsoluteTimeField,
	CalendarMonthPanel,
	TimeOptionButton,
} from "@magic-admin-v2/components/time-filter-panel/components/time-filter-panel-ui"
import type { TimePrecision } from "@magic-admin-v2/components/time-filter-panel/types"
import {
	addMonths,
	formatCalendarMonth,
	getAbsolutePresetLabel,
	getAbsoluteTimeInputValue,
	getCommonAbsolutePresetRanges,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import { useTranslation } from "react-i18next"
import { cn } from "@magic-admin-v2/utils/cn"

/** 绝对时间 Tab 的展示契约；日期范围状态和提交逻辑由父级统一管理。 */
type AbsoluteTimeTabProps = {
	/** 是否直接 inline 展示；影响单月或双月日历布局。 */
	isInline: boolean
	/** 是否只精确到自然日；为 true 时隐藏时间选择器。 */
	isAbsoluteDateOnly: boolean
	/** 当前范围结束日期；未选择时为 null。 */
	absoluteEndDate: Date | null
	/** 当前日期范围是否无效，例如结束日期早于开始日期。 */
	absoluteRangeInvalid: boolean
	/** 当前绝对时间范围的格式化展示文本。 */
	absoluteRangeText: string
	/** 当前范围开始日期；未选择时为 null。 */
	absoluteStartDate: Date | null
	/** 用于格式化月份标题和星期名称的 Intl locale。 */
	intlLocale: string
	/** 当前绝对时间筛选的时间精度。 */
	timePrecision: TimePrecision
	/** 可选择的最大自然日；未设置时不限制。 */
	maxDate?: Date
	/** 日历当前可见的起始月份。 */
	visibleMonth: Date
	/** 提交当前绝对时间范围。 */
	onAbsoluteApply: () => void
	/** 关闭 inline 面板且不提交当前编辑。 */
	onCancel: () => void
	/** 选择日历中的日期，并由父组件决定如何组成范围。 */
	onAbsoluteDateSelect: (date: Date) => void
	/** 选择标准绝对时间预设并更新日历选中范围。 */
	onAbsolutePresetSelect: (start: Date, end: Date) => void
	/** 修改开始或结束日期的时间部分。 */
	onAbsoluteTimeChange: (boundary: "start" | "end", value: string) => void
	/** 按月切换日历；负数表示上一个月，正数表示下一个月。 */
	onMonthChange: (offset: number) => void
	testIdPrefix?: string
}

export function AbsoluteTimeTab({
	absoluteEndDate,
	absoluteRangeInvalid,
	absoluteRangeText,
	absoluteStartDate,
	intlLocale,
	isAbsoluteDateOnly,
	isInline,
	timePrecision,
	maxDate,
	visibleMonth,
	onAbsoluteApply,
	onCancel,
	onAbsoluteDateSelect,
	onAbsolutePresetSelect,
	onAbsoluteTimeChange,
	onMonthChange,
	testIdPrefix,
}: AbsoluteTimeTabProps) {
	const testId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined)
	const { t } = useTranslation()

	return (
		<div className="space-y-4">
			<section className="space-y-3">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.dateRange")}
				</div>
				<div className="grid min-w-0 gap-3 rounded-lg border bg-card p-3">
					{!isAbsoluteDateOnly ? (
						<div className="grid gap-2 sm:grid-cols-2">
							<AbsoluteTimeField
								label={t("timeFilter.startDate")}
								disabled={!absoluteStartDate}
								onChange={(value) => onAbsoluteTimeChange("start", value)}
								precision={timePrecision}
								testId={testId("start-time-trigger")}
								value={getAbsoluteTimeInputValue(absoluteStartDate, timePrecision)}
							/>
							<AbsoluteTimeField
								label={t("timeFilter.endDate")}
								disabled={!absoluteEndDate}
								onChange={(value) => onAbsoluteTimeChange("end", value)}
								precision={timePrecision}
								testId={testId("end-time-trigger")}
								value={getAbsoluteTimeInputValue(absoluteEndDate, timePrecision)}
							/>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-2">
						<Button
							aria-label="Previous month"
							data-testid={testId("previous-month-button")}
							onClick={() => onMonthChange(-1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<ChevronLeft className="size-4" aria-hidden="true" />
						</Button>
						<div className="min-w-0 truncate text-sm font-medium">
							{formatCalendarMonth(visibleMonth, intlLocale)}
							{!isInline
								? ` - ${formatCalendarMonth(addMonths(visibleMonth, 1), intlLocale)}`
								: null}
						</div>
						<Button
							aria-label="Next month"
							data-testid={testId("next-month-button")}
							onClick={() => onMonthChange(1)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<ChevronRight className="size-4" aria-hidden="true" />
						</Button>
					</div>
					<div className={cn("grid min-w-0 gap-1.5", !isInline && "lg:grid-cols-2")}>
						<CalendarMonthPanel
							dateButtonTestId={testId("date-button")}
							endDate={absoluteEndDate}
							intlLocale={intlLocale}
							maxDate={maxDate}
							month={visibleMonth}
							onSelect={onAbsoluteDateSelect}
							startDate={absoluteStartDate}
						/>
						{!isInline ? (
							<CalendarMonthPanel
								dateButtonTestId={testId("date-button")}
								endDate={absoluteEndDate}
								intlLocale={intlLocale}
								maxDate={maxDate}
								month={addMonths(visibleMonth, 1)}
								onSelect={onAbsoluteDateSelect}
								startDate={absoluteStartDate}
							/>
						) : null}
					</div>
				</div>
			</section>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.standardPreset")}
				</div>
				<div
					className={cn(
						"grid grid-cols-2 gap-1.5 sm:grid-cols-3",
						!isInline && "lg:grid-cols-6",
					)}
				>
					{getCommonAbsolutePresetRanges(maxDate ?? new Date(), isAbsoluteDateOnly).map((preset) => (
						<TimeOptionButton
							key={preset.key}
							onClick={() => onAbsolutePresetSelect(...preset.value)}
							testId={testId("preset-option")}
						>
							{getAbsolutePresetLabel(preset.key, t)}
						</TimeOptionButton>
					))}
				</div>
			</section>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.selectedRange")}
				</div>
				<div
					className={cn(
						"flex flex-col gap-2",
						!isInline && "sm:flex-row sm:items-center sm:justify-between",
					)}
				>
					<div className="min-w-0 break-all font-mono text-xs text-muted-foreground">
						{absoluteRangeText}
					</div>
					<div className="flex items-center gap-2">
						{isInline ? (
							<Button onClick={onCancel} size="sm" variant="outline">
								{t("timeFilter.cancel")}
							</Button>
						) : null}
						<Button
							className="w-fit shrink-0"
							data-testid={testId("apply-button")}
							disabled={!absoluteStartDate || !absoluteEndDate || absoluteRangeInvalid}
							onClick={onAbsoluteApply}
						>
							{t("timeFilter.confirm")}
						</Button>
					</div>
				</div>
				{absoluteRangeInvalid ? (
					<div className="text-xs text-destructive">{t("timeFilter.invalidRange")}</div>
				) : null}
			</section>
		</div>
	)
}
