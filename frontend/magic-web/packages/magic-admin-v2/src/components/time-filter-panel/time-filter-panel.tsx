import { CalendarClock, ChevronDown, X } from "lucide-react"
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type ReactNode,
} from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import {
	AbsoluteTimeTab,
	HistoryTimeTab,
	RelativeTimeTab,
} from "@magic-admin-v2/components/time-filter-panel/components"
import {
	formatMonthLabel,
	getPresetLabel,
	getTimeRangeDisplayLabel,
	getUnitLabel,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import {
	historyMode,
	relativeMode,
	relativeUnit,
	timeFilterTab,
	type HistoryMode,
	type RelativeMode,
	type RelativeUnit,
	type TimeFilterHistoryItem,
	type TimeFilterPresentation,
	type TimePrecision,
	type TimeFilterTab,
	type TimePresetKey,
	type TimeRangeValue,
} from "@magic-admin-v2/components/time-filter-panel/types"
import {
	addMonths,
	buildCustomRelativeRange,
	compareDateOnly,
	createHistoryEntry,
	defaultSupportedRelativeUnits,
	endOf,
	formatDateTime,
	formatTimeRangeByPrecision,
	formatTemplate,
	getMonthRange,
	getQuickPresetGroups,
	getRangeByPreset,
	getRecentMonthKeys,
	getRelativePresetOption,
	isDayOnlyRelativeUnits,
	loadHistory,
	normalizeAbsoluteDate,
	normalizeSupportedRelativeUnits,
	parseDateTime,
	quickPresetOptions,
	removeHistory,
	standardPresetOptions,
	startOf,
	upsertHistory,
} from "@magic-admin-v2/components/time-filter-panel/utils"
import { toIntlLocale } from "@magic-admin-v2/i18n/resources"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { useTranslation } from "react-i18next"
import { cn } from "@magic-admin-v2/utils/cn"

const defaultCustomValue = 15

/**
 * 时间筛选面板的公共配置。
 * value 传入 undefined 时为非受控模式；传入 null 表示受控地清空当前范围。
 */
export type TimeFilterPanelProps = {
	/** 自定义触发器和 inline 面板的样式类名。 */
	className?: string
	/** 是否显示触发器中的清空操作；默认开启。 */
	clearable?: boolean
	/** 触发器、面板及清空按钮的测试标识。 */
	clearButtonTestId?: string
	contentTestId?: string
	testIdPrefix?: string
	triggerTestId?: string
	/** 非受控模式首次初始化时使用的相对时间预设。 */
	defaultPresetKey?: TimePresetKey
	/** 可用的最大自然日；同时作为近 X 天等快捷范围的计算基准和最终输出上限。 */
	maxDate?: Date
	/** 范围变化回调；清空时收到 null。 */
	onChange?: (value: TimeRangeValue | null) => void
	/** 面板直接展开或通过 Popover 展开；默认使用 popover。 */
	presentation?: TimeFilterPresentation
	/** 显示在触发器当前范围文本前的前缀内容。 */
	prefix?: ReactNode
	/** 相对时间 Tab 可用的单位；为空或非法值会由工具函数归一化。 */
	supportedRelativeUnits?: readonly RelativeUnit[]
	/** 绝对时间和历史记录展示使用的时间精度；默认精确到秒。 */
	timePrecision?: TimePrecision
	/** 当前范围；传入该字段后组件进入受控模式。 */
	value?: TimeRangeValue | null
}

export function TimeFilterPanel({
	className,
	clearable = true,
	clearButtonTestId,
	contentTestId,
	defaultPresetKey,
	maxDate,
	onChange,
	presentation = "popover",
	prefix,
	supportedRelativeUnits = defaultSupportedRelativeUnits,
	testIdPrefix,
	triggerTestId,
	timePrecision = "second",
	value,
}: TimeFilterPanelProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const intlLocale = toIntlLocale(language)
	const hasInitializedRef = useRef(false)
	const isControlled = value !== undefined
	const isInline = presentation === "inline"
	const panelTestIdPrefix = testIdPrefix ?? triggerTestId?.replace(/-trigger$/, "")
	const testId = (suffix: string) =>
		panelTestIdPrefix ? `${panelTestIdPrefix}-${suffix}` : undefined
	const resolvedTriggerTestId = triggerTestId ?? testId("trigger")
	const resolvedContentTestId = contentTestId ?? testId("content")
	const resolvedClearButtonTestId = clearButtonTestId ?? testId("clear-button")
	const normalizedSupportedUnits = useMemo(
		() => normalizeSupportedRelativeUnits(supportedRelativeUnits),
		[supportedRelativeUnits],
	)
	const defaultCustomUnit = normalizedSupportedUnits.includes(relativeUnit.minute)
		? relativeUnit.minute
		: normalizedSupportedUnits[0]
	const isRelativeDayOnly = isDayOnlyRelativeUnits(normalizedSupportedUnits)
	const isAbsoluteDateOnly = timePrecision === "day"
	const [internalValue, setInternalValue] = useState<TimeRangeValue | null>(null)
	const timeRangeValue = isControlled ? value : internalValue
	const [open, setOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<TimeFilterTab>(timeFilterTab.relative)
	const [selectedPresetKey, setSelectedPresetKey] = useState<TimePresetKey | null>(
		defaultPresetKey ?? null,
	)
	const [selectedRelativeMode, setSelectedRelativeMode] = useState<RelativeMode>(
		relativeMode.preset,
	)
	const [alignToUnit, setAlignToUnit] = useState(false)
	const [customValue, setCustomValue] = useState(defaultCustomValue)
	const [customUnit, setCustomUnit] = useState<RelativeUnit>(defaultCustomUnit)
	const [customUnitMenuOpen, setCustomUnitMenuOpen] = useState(false)
	const [absoluteStartDate, setAbsoluteStartDate] = useState<Date | null>(null)
	const [absoluteEndDate, setAbsoluteEndDate] = useState<Date | null>(null)
	const maxDateTime = maxDate?.getTime()
	const calendarReferenceDate = useMemo(
		() => (maxDateTime === undefined ? new Date() : new Date(maxDateTime)),
		[maxDateTime],
	)
	const configuredMaxDate = useMemo(
		() => (maxDateTime === undefined ? undefined : new Date(maxDateTime)),
		[maxDateTime],
	)
	const [visibleMonth, setVisibleMonth] = useState(() => startOf(calendarReferenceDate, "month"))
	const [history, setHistory] = useState<TimeFilterHistoryItem[]>([])

	const monthKeys = useMemo(
		() => getRecentMonthKeys(calendarReferenceDate, 12),
		[calendarReferenceDate],
	)
	const currentRangeText = timeRangeValue
		? formatTimeRangeByPrecision(
				timeRangeValue.startDate,
				timeRangeValue.endDate,
				timeRangeValue.tab === timeFilterTab.absolute
					? timePrecision
					: isRelativeDayOnly
						? "day"
						: "second",
			)
		: t("timeFilter.placeholder")
	const triggerLabel = timeRangeValue
		? getTimeRangeDisplayLabel(timeRangeValue, t, timePrecision)
		: t("timeFilter.placeholder")
	const absoluteRangeText =
		absoluteStartDate && absoluteEndDate
			? formatTimeRangeByPrecision(
					formatDateTime(
						normalizeAbsoluteDate(absoluteStartDate, timePrecision, "start"),
					),
					formatDateTime(normalizeAbsoluteDate(absoluteEndDate, timePrecision, "end")),
					timePrecision,
				)
			: t("timeFilter.placeholder")
	const absoluteRangeInvalid =
		Boolean(absoluteStartDate && absoluteEndDate) &&
		absoluteStartDate!.getTime() > absoluteEndDate!.getTime()
	const quickPresetGroups = useMemo(
		() => getQuickPresetGroups(normalizedSupportedUnits),
		[normalizedSupportedUnits],
	)
	const availableStandardPresetOptions = useMemo(() => {
		if (!maxDate) return standardPresetOptions

		return standardPresetOptions.filter(({ key }) => {
			const [start] = getRangeByPreset(key, new Date(), false, isRelativeDayOnly)
			return compareDateOnly(start, maxDate) <= 0
		})
	}, [isRelativeDayOnly, maxDate])

	const setTimeRangeValue = useCallback(
		(nextValue: TimeRangeValue | null) => {
			if (!isControlled) setInternalValue(nextValue)
			onChange?.(nextValue)
		},
		[isControlled, onChange],
	)

	const resetPanelState = useCallback(() => {
		setOpen(false)
		setActiveTab(timeFilterTab.relative)
		setSelectedPresetKey(defaultPresetKey ?? null)
		setSelectedRelativeMode(relativeMode.preset)
		setAlignToUnit(false)
		setCustomValue(defaultCustomValue)
		setCustomUnit(defaultCustomUnit)
		setCustomUnitMenuOpen(false)
		setAbsoluteStartDate(null)
		setAbsoluteEndDate(null)
		setVisibleMonth(startOf(calendarReferenceDate, "month"))
	}, [calendarReferenceDate, defaultCustomUnit, defaultPresetKey])

	const applyRange = useCallback(
		({
			closePanel = true,
			end,
			label,
			mode,
			persist = true,
			presetKey,
			start,
			tab,
			unit,
		}: {
			closePanel?: boolean
			end: Date
			label: string
			mode: HistoryMode
			persist?: boolean
			presetKey?: TimePresetKey
			start: Date
			tab: TimeFilterTab
			unit?: RelativeUnit
		}) => {
			const maxRangeEnd = maxDate ? endOf(maxDate, "day") : null
			if (maxRangeEnd && start.getTime() > maxRangeEnd.getTime()) return
			const boundedEnd =
				maxRangeEnd && end.getTime() > maxRangeEnd.getTime() ? maxRangeEnd : end

			const nextValue: TimeRangeValue = {
				endDate: formatDateTime(boundedEnd),
				label,
				mode,
				...(presetKey ? { presetKey } : {}),
				...(unit ? { relativeUnit: unit } : {}),
				startDate: formatDateTime(start),
				tab,
			}
			setTimeRangeValue(nextValue)
			if (persist) setHistory(upsertHistory(createHistoryEntry(nextValue)))
			if (closePanel) setOpen(false)
		},
		[maxDate, setTimeRangeValue],
	)

	useEffect(() => setHistory(loadHistory()), [])

	useEffect(() => {
		if (normalizedSupportedUnits.includes(customUnit)) return
		setCustomUnit(defaultCustomUnit)
		setCustomUnitMenuOpen(false)
	}, [customUnit, defaultCustomUnit, normalizedSupportedUnits])

	useEffect(() => {
		if (!isControlled || !timeRangeValue) return
		setActiveTab(timeRangeValue.tab)

		if (timeRangeValue.mode === historyMode.relative && timeRangeValue.presetKey) {
			setSelectedRelativeMode(relativeMode.preset)
			setSelectedPresetKey(timeRangeValue.presetKey)
			return
		}

		if (timeRangeValue.mode === historyMode.custom) {
			setSelectedRelativeMode(relativeMode.custom)
			setSelectedPresetKey(null)
			if (
				timeRangeValue.relativeUnit &&
				normalizedSupportedUnits.includes(timeRangeValue.relativeUnit)
			) {
				setCustomUnit(timeRangeValue.relativeUnit)
			}
			return
		}

		if (timeRangeValue.mode === historyMode.monthly) {
			setSelectedRelativeMode(relativeMode.monthly)
			setSelectedPresetKey(null)
			return
		}

		if (timeRangeValue.mode === historyMode.absolute) {
			const start = parseDateTime(timeRangeValue.startDate)
			const end = parseDateTime(timeRangeValue.endDate)
			setSelectedPresetKey(null)
			setAbsoluteStartDate(start)
			setAbsoluteEndDate(end)
			if (start) setVisibleMonth(startOf(start, "month"))
		}
	}, [isControlled, normalizedSupportedUnits, timeRangeValue])

	useEffect(() => {
		if (
			activeTab !== timeFilterTab.absolute ||
			!timeRangeValue?.startDate ||
			!timeRangeValue.endDate
		) {
			return
		}
		const start = parseDateTime(timeRangeValue.startDate)
		const end = parseDateTime(timeRangeValue.endDate)
		if (!start || !end) return
		setAbsoluteStartDate(start)
		setAbsoluteEndDate(end)
		setVisibleMonth(startOf(start, "month"))
	}, [activeTab, timeRangeValue])

	useEffect(() => {
		if (!isControlled) return
		if (timeRangeValue?.startDate && timeRangeValue.endDate) return
		resetPanelState()
	}, [isControlled, resetPanelState, timeRangeValue])

	useEffect(() => {
		if (hasInitializedRef.current || !defaultPresetKey || isControlled) return
		hasInitializedRef.current = true
		const relativePreset = getRelativePresetOption(defaultPresetKey)
		const presetReferenceDate =
			configuredMaxDate && isRelativeDayOnly && relativePreset?.unit === relativeUnit.day
				? configuredMaxDate
				: new Date()
		const [start, end] = getRangeByPreset(
			defaultPresetKey,
			presetReferenceDate,
			false,
			isRelativeDayOnly,
		)
		const option = [...quickPresetOptions, ...standardPresetOptions].find(
			(item) => item.key === defaultPresetKey,
		)
		applyRange({
			closePanel: false,
			end,
			label: option ? getPresetLabel(option.labelKey, t) : t("timeFilter.preset.last24Hours"),
			mode: historyMode.relative,
			persist: false,
			presetKey: defaultPresetKey,
			start,
			tab: timeFilterTab.relative,
			unit: relativePreset?.unit,
		})
		setSelectedPresetKey(defaultPresetKey)
	}, [applyRange, defaultPresetKey, isControlled, isRelativeDayOnly, configuredMaxDate, t])

	function handlePresetApply(presetKey: TimePresetKey) {
		setSelectedRelativeMode(relativeMode.preset)
		setSelectedPresetKey(presetKey)
		const option = [...quickPresetOptions, ...standardPresetOptions].find(
			(item) => item.key === presetKey,
		)
		const relativePreset = getRelativePresetOption(presetKey)
		const presetReferenceDate =
			configuredMaxDate && isRelativeDayOnly && relativePreset?.unit === relativeUnit.day
				? configuredMaxDate
				: new Date()
		const [start, end] = getRangeByPreset(
			presetKey,
			presetReferenceDate,
			alignToUnit,
			isRelativeDayOnly,
		)
		applyRange({
			end,
			label: option ? getPresetLabel(option.labelKey, t) : t("timeFilter.preset.last24Hours"),
			mode: historyMode.relative,
			presetKey,
			start,
			tab: timeFilterTab.relative,
			unit: relativePreset?.unit,
		})
	}

	function handleCustomRelativeApply() {
		const [start, end] = buildCustomRelativeRange({
			alignToUnit,
			dayOnly: isRelativeDayOnly,
			now: configuredMaxDate ?? new Date(),
			unit: customUnit,
			value: customValue,
		})
		setSelectedRelativeMode(relativeMode.custom)
		setSelectedPresetKey(null)
		setCustomUnitMenuOpen(false)
		applyRange({
			end,
			label: formatTemplate(t("timeFilter.customRelativeLabel"), {
				unit: getUnitLabel(customUnit, t),
				value: String(customValue),
			}),
			mode: historyMode.custom,
			start,
			tab: timeFilterTab.relative,
			unit: customUnit,
		})
	}

	function handleMonthApply(monthKey: string) {
		const [start, end] = getMonthRange(monthKey, configuredMaxDate ?? new Date())
		setSelectedRelativeMode(relativeMode.monthly)
		setSelectedPresetKey(null)
		applyRange({
			end,
			label: formatTemplate(t("timeFilter.monthLabel"), {
				month: formatMonthLabel(monthKey, t),
			}),
			mode: historyMode.monthly,
			start,
			tab: timeFilterTab.relative,
		})
	}

	function handleAbsoluteApply() {
		if (!absoluteStartDate || !absoluteEndDate || absoluteRangeInvalid) return
		const start = normalizeAbsoluteDate(absoluteStartDate, timePrecision, "start")
		const end = normalizeAbsoluteDate(absoluteEndDate, timePrecision, "end")
		applyRange({
			end,
			label: formatTimeRangeByPrecision(
				formatDateTime(start),
				formatDateTime(end),
				timePrecision,
			),
			mode: historyMode.absolute,
			start,
			tab: timeFilterTab.absolute,
		})
	}

	function handleAbsoluteTimeChange(boundary: "start" | "end", nextValue: string) {
		const current = boundary === "start" ? absoluteStartDate : absoluteEndDate
		if (!current || timePrecision === "day") return
		const [hours = 0, minutes = 0, seconds = 0] = nextValue.split(":").map(Number)
		const next = new Date(current)
		next.setHours(
			hours,
			minutes,
			timePrecision === "second" ? seconds : boundary === "end" ? 59 : 0,
			0,
		)
		if (boundary === "start") setAbsoluteStartDate(next)
		else setAbsoluteEndDate(next)
	}

	function handleAlignToUnitChange(nextAlignToUnit: boolean) {
		setAlignToUnit(nextAlignToUnit)
		if (!timeRangeValue || timeRangeValue.tab !== timeFilterTab.relative) return

		if (timeRangeValue.mode === historyMode.custom) {
			const [start, end] = buildCustomRelativeRange({
				alignToUnit: nextAlignToUnit,
				dayOnly: isRelativeDayOnly,
				now: configuredMaxDate ?? new Date(),
				unit: customUnit,
				value: customValue,
			})
			applyRange({
				closePanel: false,
				end,
				label: formatTemplate(t("timeFilter.customRelativeLabel"), {
					unit: getUnitLabel(customUnit, t),
					value: String(customValue),
				}),
				mode: historyMode.custom,
				persist: false,
				start,
				tab: timeFilterTab.relative,
				unit: customUnit,
			})
			return
		}

		if (!timeRangeValue.presetKey) return
		const option = [...quickPresetOptions, ...standardPresetOptions].find(
			(item) => item.key === timeRangeValue.presetKey,
		)
		const relativePreset = getRelativePresetOption(timeRangeValue.presetKey)
		const presetReferenceDate =
			configuredMaxDate && isRelativeDayOnly && relativePreset?.unit === relativeUnit.day
				? configuredMaxDate
				: new Date()
		const [start, end] = getRangeByPreset(
			timeRangeValue.presetKey,
			presetReferenceDate,
			nextAlignToUnit,
			isRelativeDayOnly,
		)
		applyRange({
			closePanel: false,
			end,
			label: option ? getPresetLabel(option.labelKey, t) : timeRangeValue.label,
			mode: historyMode.relative,
			persist: false,
			presetKey: timeRangeValue.presetKey,
			start,
			tab: timeFilterTab.relative,
			unit: relativePreset?.unit,
		})
	}

	function handleAbsoluteDateSelect(date: Date) {
		if (!absoluteStartDate || absoluteEndDate) {
			setAbsoluteStartDate(normalizeAbsoluteDate(date, timePrecision, "start"))
			setAbsoluteEndDate(null)
			return
		}
		if (compareDateOnly(date, absoluteStartDate) < 0) {
			setAbsoluteEndDate(endOf(absoluteStartDate, "day"))
			setAbsoluteStartDate(normalizeAbsoluteDate(date, timePrecision, "start"))
			return
		}
		setAbsoluteEndDate(endOf(date, "day"))
	}

	function handleAbsolutePresetSelect(start: Date, end: Date) {
		setAbsoluteStartDate(normalizeAbsoluteDate(start, timePrecision, "start"))
		setAbsoluteEndDate(normalizeAbsoluteDate(end, timePrecision, "end"))
		setVisibleMonth(startOf(start, "month"))
	}

	function handleHistorySelect(item: TimeFilterHistoryItem) {
		setActiveTab(item.tab)
		applyRange({
			end: parseDateTime(item.endDate) ?? new Date(),
			label: item.label,
			mode: item.mode,
			presetKey: item.presetKey,
			start: parseDateTime(item.startDate) ?? new Date(),
			tab: item.tab,
			unit: item.relativeUnit,
		})
	}

	function handleClear(event: MouseEvent<HTMLSpanElement>) {
		event.preventDefault()
		event.stopPropagation()
		resetPanelState()
		setTimeRangeValue(null)
	}

	const panelContent = (
		<Tabs
			className="min-w-0"
			value={activeTab}
			onValueChange={(tab) => setActiveTab(tab as TimeFilterTab)}
		>
			<div className="border-b px-4">
				<TabsList className={cn(isInline && "grid w-full grid-cols-3")}>
					<TabsTrigger
						data-testid={testId("relative-tab-trigger")}
						value={timeFilterTab.relative}
					>
						{t("timeFilter.relative")}
					</TabsTrigger>
					<TabsTrigger
						data-testid={testId("absolute-tab-trigger")}
						value={timeFilterTab.absolute}
					>
						{t("timeFilter.absolute")}
					</TabsTrigger>
					<TabsTrigger
						data-testid={testId("history-tab-trigger")}
						value={timeFilterTab.history}
					>
						{t("timeFilter.history")}
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent className="m-0 p-4" value={timeFilterTab.relative}>
				<RelativeTimeTab
					alignToUnit={alignToUnit}
					currentRangeText={currentRangeText}
					customUnit={customUnit}
					customUnitMenuOpen={customUnitMenuOpen}
					customValue={customValue}
					isInline={isInline}
					isRelativeDayOnly={isRelativeDayOnly}
					monthKeys={monthKeys}
					quickPresetGroups={quickPresetGroups}
					selectedPresetKey={selectedPresetKey}
					selectedRelativeMode={selectedRelativeMode}
					standardPresetOptions={availableStandardPresetOptions}
					supportedUnits={normalizedSupportedUnits}
					timeRangeValue={timeRangeValue}
					onAlignToUnitChange={handleAlignToUnitChange}
					onCancel={() => setOpen(false)}
					onCustomRelativeApply={handleCustomRelativeApply}
					onCustomUnitChange={setCustomUnit}
					onCustomUnitMenuOpenChange={setCustomUnitMenuOpen}
					onCustomValueChange={setCustomValue}
					onMonthApply={handleMonthApply}
					onPresetApply={handlePresetApply}
					testIdPrefix={panelTestIdPrefix}
				/>
			</TabsContent>

			<TabsContent className="m-0 p-4" value={timeFilterTab.absolute}>
				<AbsoluteTimeTab
					absoluteEndDate={absoluteEndDate}
					absoluteRangeInvalid={absoluteRangeInvalid}
					absoluteRangeText={absoluteRangeText}
					absoluteStartDate={absoluteStartDate}
					intlLocale={intlLocale}
					isAbsoluteDateOnly={isAbsoluteDateOnly}
					isInline={isInline}
					timePrecision={timePrecision}
					maxDate={maxDate}
					visibleMonth={visibleMonth}
					onAbsoluteApply={handleAbsoluteApply}
					onCancel={() => setOpen(false)}
					onAbsoluteDateSelect={handleAbsoluteDateSelect}
					onAbsolutePresetSelect={handleAbsolutePresetSelect}
					onAbsoluteTimeChange={handleAbsoluteTimeChange}
					onMonthChange={(offset) => setVisibleMonth(addMonths(visibleMonth, offset))}
					testIdPrefix={panelTestIdPrefix}
				/>
			</TabsContent>

			<TabsContent className="m-0 p-4" value={timeFilterTab.history}>
				<HistoryTimeTab
					history={history}
					isInline={isInline}
					isRelativeDayOnly={isRelativeDayOnly}
					timePrecision={timePrecision}
					onRemove={(id) => setHistory(removeHistory(id))}
					onSelect={handleHistorySelect}
				/>
			</TabsContent>
		</Tabs>
	)

	const trigger = (
		<>
			<span className="flex min-w-0 items-center gap-2">
				{prefix ? <span className="shrink-0 text-muted-foreground">{prefix}</span> : null}
				<span className="truncate">{triggerLabel}</span>
			</span>
			<span className="flex shrink-0 items-center gap-1.5">
				{timeRangeValue?.label && clearable ? (
					<span
						aria-label={t("timeFilter.clear")}
						className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
						data-testid={resolvedClearButtonTestId}
						onClick={handleClear}
						role="button"
					>
						<X className="size-3.5" aria-hidden="true" />
					</span>
				) : null}
				<CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
				<ChevronDown
					className={cn(
						"size-4 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</span>
		</>
	)

	if (isInline) {
		return (
			<div className={cn("min-w-0 max-w-full", className)}>
				<button
					aria-expanded={open}
					className={cn(
						"flex h-9 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						!timeRangeValue && "text-muted-foreground",
					)}
					data-testid={resolvedTriggerTestId}
					onClick={() => setOpen((nextOpen) => !nextOpen)}
					type="button"
				>
					{trigger}
				</button>
				{open ? (
					<div
						className="mt-2 min-w-0 overflow-hidden rounded-lg border bg-card"
						data-testid={resolvedContentTestId}
					>
						{panelContent}
					</div>
				) : null}
			</div>
		)
	}

	return (
		<Popover className={cn("w-fit", className)} open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className={cn(
					"flex h-9 w-full min-w-0 max-w-full items-center justify-between gap-3 rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-64",
					!timeRangeValue && "text-muted-foreground",
				)}
				data-testid={resolvedTriggerTestId}
			>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(700px,calc(100vw-1rem))] p-0 sm:w-[min(700px,calc(100vw-2rem))]"
				data-testid={resolvedContentTestId}
			>
				{panelContent}
			</PopoverContent>
		</Popover>
	)
}
