import { Check, ChevronDown } from "lucide-react"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Input } from "@magic-admin-v2/components/ui/input"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { TimeOptionButton } from "@magic-admin-v2/components/time-filter-panel/components/time-filter-panel-ui"
import {
	formatMonthLabel,
	formatTemplate,
	getPresetLabel,
	getQuickPresetGroupLabel,
	getUnitLabel,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import {
	relativeMode,
	type RelativeMode,
	type RelativeUnit,
	type TimePresetKey,
	type TimePresetOption,
	type TimeRangeValue,
} from "@magic-admin-v2/components/time-filter-panel/types"
import { useTranslation } from "react-i18next"
import { cn } from "@magic-admin-v2/utils/cn"

type QuickPresetGroup = {
	/** 用于分组标题和列表渲染的稳定标识。 */
	key: string
	/** 当前分组内可展示的相对时间预设。 */
	options: TimePresetOption[]
}

/** 相对时间 Tab 的展示契约；状态和业务操作由父级 TimeFilterPanel 统一管理。 */
export type RelativeTimeTabProps = {
	/** 是否按所选单位的起点对齐相对范围。 */
	alignToUnit: boolean
	/** 当前已选范围的格式化文本。 */
	currentRangeText: string
	/** 自定义相对范围当前使用的时间单位。 */
	customUnit: RelativeUnit
	/** 自定义时间单位下拉菜单是否展开。 */
	customUnitMenuOpen: boolean
	/** 自定义相对范围的数量，最小值由父组件保证为 1。 */
	customValue: number
	/** 是否将面板直接渲染在页面中；影响布局断点和网格列数。 */
	isInline: boolean
	/** 当前是否只展示按自然日筛选的相对范围。 */
	isRelativeDayOnly: boolean
	/** 可供按月筛选展示的月份 key，格式为 YYYY-MM。 */
	monthKeys: string[]
	/** 按时间单位分组后的快捷预设。 */
	quickPresetGroups: QuickPresetGroup[]
	/** 当前选中的快捷或标准预设；自定义和按月模式下为空。 */
	selectedPresetKey: TimePresetKey | null
	/** 当前相对时间选择模式，用于渲染选中状态。 */
	selectedRelativeMode: RelativeMode
	/** 标准时间预设列表。 */
	standardPresetOptions: TimePresetOption[]
	/** 自定义时间单位的可选项，已由父组件完成归一化。 */
	supportedUnits: readonly RelativeUnit[]
	/** 当前面板对外的时间范围值，用于判断按月选中状态。 */
	timeRangeValue: TimeRangeValue | null | undefined
	/** 切换是否按单位起点对齐。 */
	onAlignToUnitChange: (value: boolean) => void
	/** 提交当前自定义相对范围。 */
	onCustomRelativeApply: () => void
	/** 关闭 inline 面板且不提交当前编辑。 */
	onCancel: () => void
	/** 更新自定义相对范围的时间单位。 */
	onCustomUnitChange: (unit: RelativeUnit) => void
	/** 控制自定义时间单位菜单的展开状态。 */
	onCustomUnitMenuOpenChange: (open: boolean) => void
	/** 更新自定义相对范围的数量。 */
	onCustomValueChange: (value: number) => void
	/** 提交指定月份的时间范围。 */
	onMonthApply: (monthKey: string) => void
	/** 提交指定的快捷或标准预设。 */
	onPresetApply: (presetKey: TimePresetKey) => void
	testIdPrefix?: string
}

export function RelativeTimeTab({
	alignToUnit,
	currentRangeText,
	customUnit,
	customUnitMenuOpen,
	customValue,
	isInline,
	isRelativeDayOnly,
	monthKeys,
	quickPresetGroups,
	selectedPresetKey,
	selectedRelativeMode,
	standardPresetOptions,
	supportedUnits,
	timeRangeValue,
	onAlignToUnitChange,
	onCustomRelativeApply,
	onCancel,
	onCustomUnitChange,
	onCustomUnitMenuOpenChange,
	onCustomValueChange,
	onMonthApply,
	onPresetApply,
	testIdPrefix,
}: RelativeTimeTabProps) {
	const testId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined)
	const { t } = useTranslation()

	return (
		<div className="space-y-4">
			<div
				className={cn(
					"flex flex-col gap-3 rounded-lg border bg-muted/30 p-3",
					!isInline && "sm:flex-row sm:items-center sm:justify-between",
				)}
			>
				<div className="min-w-0">
					<div className="text-xs font-medium text-muted-foreground">
						{t("timeFilter.selectedRange")}
					</div>
					<div className="mt-1 break-all font-mono text-xs text-foreground">
						{currentRangeText}
					</div>
				</div>
				{!isRelativeDayOnly ? (
					<div className="flex shrink-0 items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground">
							{t("timeFilter.alignToUnit")}
						</span>
						<Switch
							checked={alignToUnit}
							data-testid={testId("align-switch")}
							onCheckedChange={onAlignToUnitChange}
						/>
					</div>
				) : null}
			</div>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.quickPreset")}
				</div>
				<div className="space-y-3">
					{quickPresetGroups.map((group) => (
						<div
							className={cn(
								isInline && "space-y-2",
								!isInline &&
									!isRelativeDayOnly &&
									"grid gap-2 sm:grid-cols-[56px_1fr] sm:items-start",
							)}
							key={group.key}
						>
							{!isRelativeDayOnly ? (
								<div
									className={cn(
										"text-sm font-medium text-muted-foreground",
										!isInline && "pt-1",
									)}
								>
									{getQuickPresetGroupLabel(group.key, t)}
								</div>
							) : null}
							<div
								className={cn(
									"grid grid-cols-2 gap-1.5",
									isInline && "sm:grid-cols-3",
									!isInline && isRelativeDayOnly && "sm:grid-cols-4",
									!isInline && !isRelativeDayOnly && "sm:grid-cols-5",
								)}
							>
								{group.options.map((option) => (
									<TimeOptionButton
										active={
											selectedRelativeMode === relativeMode.preset &&
											selectedPresetKey === option.key
										}
										key={option.key}
										onClick={() => onPresetApply(option.key)}
										testId={testId("quick-preset-option")}
									>
										{getPresetLabel(option.labelKey, t)}
									</TimeOptionButton>
								))}
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.standardPreset")}
				</div>
				<div
					className={cn(
						"grid grid-cols-2 gap-1.5",
						isInline ? "sm:grid-cols-3" : "sm:grid-cols-4",
					)}
				>
					{standardPresetOptions.map((option) => (
						<TimeOptionButton
							active={
								selectedRelativeMode === relativeMode.preset &&
								selectedPresetKey === option.key
							}
							key={option.key}
							onClick={() => onPresetApply(option.key)}
						>
							{getPresetLabel(option.labelKey, t)}
						</TimeOptionButton>
					))}
				</div>
			</section>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.monthly")}
				</div>
				<div
					className={cn(
						"grid grid-cols-2 gap-1.5 sm:grid-cols-3",
						!isInline && "lg:grid-cols-6",
					)}
				>
					{monthKeys.slice(0, 6).map((monthKey) => (
						<TimeOptionButton
							active={
								selectedRelativeMode === relativeMode.monthly &&
								timeRangeValue?.label ===
									formatTemplate(t("timeFilter.monthLabel"), {
										month: formatMonthLabel(monthKey, t),
									})
							}
							key={monthKey}
							onClick={() => onMonthApply(monthKey)}
							testId={testId("month-option")}
						>
							{formatMonthLabel(monthKey, t)}
						</TimeOptionButton>
					))}
				</div>
			</section>

			<section className="space-y-2 border-t pt-4">
				<div className="text-xs font-medium text-muted-foreground">
					{t("timeFilter.custom")}
				</div>
				<div
					className={cn(
						"flex flex-col gap-2",
						!isInline && "sm:flex-row sm:items-center sm:justify-between",
					)}
				>
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{t("timeFilter.closest")}
						</span>
						<Input
							className="h-8 w-20"
							data-testid={testId("custom-value-input")}
							min={1}
							onChange={(event) =>
								onCustomValueChange(Math.max(1, Number(event.target.value) || 1))
							}
							type="number"
							value={customValue}
						/>
						<div className="relative max-w-full">
							<button
								aria-expanded={customUnitMenuOpen}
								aria-haspopup="listbox"
								className="flex h-8 w-28 max-w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								data-testid={testId("custom-unit-trigger")}
								onClick={() => onCustomUnitMenuOpenChange(!customUnitMenuOpen)}
								type="button"
							>
								<span>{getUnitLabel(customUnit, t)}</span>
								<ChevronDown
									className={cn(
										"size-4 text-muted-foreground transition-transform",
										customUnitMenuOpen && "rotate-180",
									)}
									aria-hidden="true"
								/>
							</button>
							{customUnitMenuOpen ? (
								<div
									className="absolute bottom-full left-0 z-[90] mb-1 w-28 max-w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
									role="listbox"
								>
									{supportedUnits.map((unit) => (
										<button
											aria-selected={customUnit === unit}
											data-testid={testId("custom-unit-option")}
											className={cn(
												"flex h-8 w-full items-center justify-between rounded-sm px-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
												customUnit === unit &&
													"bg-accent text-accent-foreground",
											)}
											key={unit}
											onClick={() => {
												onCustomUnitChange(unit)
												onCustomUnitMenuOpenChange(false)
											}}
											role="option"
											type="button"
										>
											<span>{getUnitLabel(unit, t)}</span>
											{customUnit === unit ? (
												<Check className="size-3.5" aria-hidden="true" />
											) : null}
										</button>
									))}
								</div>
							) : null}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{isInline ? (
							<Button onClick={onCancel} size="sm" variant="outline">
								{t("timeFilter.cancel")}
							</Button>
						) : null}
						<Button
							className="w-fit"
							data-testid={testId("custom-apply-button")}
							onClick={onCustomRelativeApply}
							size="sm"
						>
							{t("timeFilter.confirm")}
						</Button>
					</div>
				</div>
			</section>
		</div>
	)
}
