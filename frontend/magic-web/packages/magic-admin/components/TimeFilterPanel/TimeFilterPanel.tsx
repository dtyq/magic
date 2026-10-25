import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useControllableValue } from "ahooks"
import { Button, DatePicker, Empty, Popover, Segmented, Select, Space, Typography } from "antd"
import dayjs, { type Dayjs } from "@admin/infrastructure/vendors/dayjs"
import { IconCalendarClock, IconTrash, IconX } from "@tabler/icons-react"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicButton from "../MagicButton"
import MagicInputNumber from "../MagicInputNumber"
import MagicSwitch from "../MagicSwitch"
import MagicTabs from "../MagicTabs"
import { useStyles } from "./style"
import {
	HistoryMode,
	RelativeMode,
	RelativeUnit,
	TimeFilterPrecision,
	TimeFilterPrecisionValue,
	TimeFilterHistoryItem,
	TimeFilterTab,
	TimePresetKey,
	TimeRangeValue,
} from "./types"
import {
	buildCustomRelativeRange,
	createHistoryEntry,
	DATE_FORMAT,
	DEFAULT_RELATIVE_UNITS,
	formatMonthLabel,
	formatTimeRangeDisplay,
	getCommonAbsolutePresetRanges,
	getRangeValueFormat,
	getMonthRange,
	getPresetUnit,
	getRangeByPreset,
	getRecentMonthKeys,
	getHistoryStorageKey,
	getPresetOptionLabel,
	isDayOnlyPrecision,
	loadHistory,
	normalizeRangeForApply,
	normalizeRelativeUnits,
	QUICK_PRESET_OPTIONS_BY_UNIT,
	removeHistory,
	STANDARD_PRESET_OPTIONS,
	upsertHistory,
	getAbsolutePresetLabel,
	formatTemplate,
	getUnitLabel,
} from "./utils"

const { RangePicker } = DatePicker
const DEFAULT_CUSTOM_VALUE = 15

function getDefaultRelativeUnit(units: readonly RelativeUnit[]) {
	return units[0] ?? DEFAULT_RELATIVE_UNITS[0]
}

export interface TimeFilterPanelProps {
	/* 默认预设时间 */
	defaultPresetKey?: TimePresetKey
	/* 相对时间支持的粒度；兼容旧版 dateTime/day 配置 */
	precision?: TimeFilterPrecisionValue
	/* 前缀 */
	prefix?: React.ReactNode
	/* 受控值，传 null 表示清空 */
	value?: TimeRangeValue | null
	/* 是否可清除 */
	clearable?: boolean
	/* 可选择的最大自然日 */
	maxDate?: Dayjs
	/* 变化回调 */
	onChange?: (value: TimeRangeValue | null) => void
}

function TimeFilterPanel({
	defaultPresetKey,
	precision = TimeFilterPrecision.dateTime,
	prefix,
	value,
	clearable = true,
	maxDate,
	onChange,
}: TimeFilterPanelProps) {
	const { styles, cx } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("TimeFilterPanel")
	const relativeUnits = useMemo(() => normalizeRelativeUnits(precision), [precision])
	const isDayOnly = isDayOnlyPrecision(relativeUnits)
	const defaultRelativeUnit = getDefaultRelativeUnit(relativeUnits)
	const defaultPresetUnit = defaultPresetKey ? getPresetUnit(defaultPresetKey) : null
	const defaultActiveRelativeUnit =
		defaultPresetUnit && relativeUnits.includes(defaultPresetUnit)
			? defaultPresetUnit
			: defaultRelativeUnit
	const historyStorageKey = useMemo(() => getHistoryStorageKey(precision), [precision])
	const hasInitializedRef = useRef(false)
	const isControlled = value !== undefined
	const [timeRangeValue, setTimeRangeValue] = useControllableValue<TimeRangeValue | null>(
		{ value, onChange },
		{ defaultValue: null },
	)
	const [open, setOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<TimeFilterTab>(TimeFilterTab.relative)
	const [selectedPresetKey, setSelectedPresetKey] = useState<TimePresetKey | null>(
		defaultPresetKey ?? null,
	)
	const [relativeMode, setRelativeMode] = useState<RelativeMode>(RelativeMode.preset)
	const [alignToUnit, setAlignToUnit] = useState(false)
	const [customValue, setCustomValue] = useState(DEFAULT_CUSTOM_VALUE)
	const [activeRelativeUnit, setActiveRelativeUnit] =
		useState<RelativeUnit>(defaultActiveRelativeUnit)
	const [customUnit, setCustomUnit] = useState<RelativeUnit>(defaultRelativeUnit)
	const [absoluteRange, setAbsoluteRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
	const [history, setHistory] = useState<TimeFilterHistoryItem[]>([])
	const maxDateValue = maxDate?.valueOf()
	const maxDateEnd = useMemo(
		() => (maxDateValue === undefined ? undefined : dayjs(maxDateValue).endOf("day")),
		[maxDateValue],
	)
	const monthReferenceDate = useMemo(
		() => (maxDateValue === undefined ? dayjs() : dayjs(maxDateValue)),
		[maxDateValue],
	)

	const monthKeys = useMemo(
		() => getRecentMonthKeys(monthReferenceDate, 12),
		[monthReferenceDate],
	)
	const unitOptions = useMemo(
		() =>
			relativeUnits.map((unit) => ({
				label: getUnitLabel(locale, unit),
				value: unit,
			})),
		[locale, relativeUnits],
	)
	const absolutePresets = useMemo(
		() =>
			getCommonAbsolutePresetRanges(monthReferenceDate).map((item) => ({
				label: getAbsolutePresetLabel(locale, item.key),
				value: item.value,
			})),
		[locale, monthReferenceDate],
	)
	const availableStandardPresetOptions = useMemo(() => {
		if (!maxDate) return STANDARD_PRESET_OPTIONS

		return STANDARD_PRESET_OPTIONS.filter((option) => {
			const [start] = getRangeByPreset(option.key, dayjs(), false, precision)
			return !maxDateEnd || !start.isAfter(maxDateEnd, "day")
		})
	}, [maxDate, maxDateEnd, precision])
	const displayedRelativeUnit = relativeUnits.includes(activeRelativeUnit)
		? activeRelativeUnit
		: defaultActiveRelativeUnit
	const activeQuickPresetOptions = QUICK_PRESET_OPTIONS_BY_UNIT[displayedRelativeUnit]
	const allQuickPresetOptions = useMemo(
		() => relativeUnits.flatMap((unit) => QUICK_PRESET_OPTIONS_BY_UNIT[unit]),
		[relativeUnits],
	)
	const currentRangeText = timeRangeValue
		? formatTimeRangeDisplay(timeRangeValue, precision)
		: locale.placeholder
	const triggerLabel =
		timeRangeValue?.tab === TimeFilterTab.absolute ||
		timeRangeValue?.mode === HistoryMode.absolute
			? formatTimeRangeDisplay(timeRangeValue, precision)
			: timeRangeValue?.label

	const applyRange = useCallback(
		({
			start,
			end,
			label,
			tab,
			mode,
			presetKey,
			persist = true,
			closePanel = true,
		}: {
			start: Dayjs
			end: Dayjs
			label: string
			tab: TimeFilterTab
			mode: HistoryMode
			presetKey?: TimePresetKey
			persist?: boolean
			closePanel?: boolean
		}) => {
			const [normalizedStart, normalizedEnd] = normalizeRangeForApply(
				start,
				end,
				tab,
				precision,
			)
			if (maxDateEnd && normalizedStart.isAfter(maxDateEnd)) return
			const boundedEnd =
				maxDateEnd && normalizedEnd.isAfter(maxDateEnd) ? maxDateEnd : normalizedEnd
			const format = getRangeValueFormat(tab, precision)
			const nextValue: TimeRangeValue = {
				startDate: normalizedStart.format(format),
				endDate: boundedEnd.format(format),
				label,
				tab,
				mode,
				...(presetKey ? { presetKey } : {}),
			}

			setTimeRangeValue(nextValue)

			if (persist) {
				setHistory(upsertHistory(createHistoryEntry(nextValue), historyStorageKey))
			}

			if (closePanel) {
				setOpen(false)
			}
		},
		[historyStorageKey, maxDateEnd, precision, setTimeRangeValue],
	)

	const reapplyRelativeRangeForAlign = useCallback(
		(nextAlignToUnit: boolean) => {
			if (!timeRangeValue || timeRangeValue.tab !== TimeFilterTab.relative) return

			const now = maxDate ?? dayjs()
			let start: Dayjs
			let end: Dayjs
			let label = timeRangeValue.label
			const mode = timeRangeValue.mode

			if (timeRangeValue.mode === HistoryMode.relative && selectedPresetKey) {
				;[start, end] = getRangeByPreset(selectedPresetKey, now, nextAlignToUnit, precision)
				const option = [...allQuickPresetOptions, ...STANDARD_PRESET_OPTIONS].find(
					(item) => item.key === selectedPresetKey,
				)
				if (option) {
					label = getPresetOptionLabel(locale, option)
				}
			} else if (timeRangeValue.mode === HistoryMode.custom) {
				;[start, end] = buildCustomRelativeRange({
					now,
					value: customValue,
					unit: customUnit,
					alignToUnit: nextAlignToUnit,
					precision,
				})
				label = formatTemplate(locale.customRelativeLabel, {
					value: String(customValue),
					unit: getUnitLabel(locale, customUnit),
				})
			} else {
				return
			}

			applyRange({
				start,
				end,
				label,
				tab: TimeFilterTab.relative,
				mode,
				persist: false,
				closePanel: false,
			})
		},
		[
			allQuickPresetOptions,
			applyRange,
			customUnit,
			customValue,
			locale,
			precision,
			selectedPresetKey,
			timeRangeValue,
			maxDate,
		],
	)

	const handleAlignToUnitChange = useCallback(
		(checked: boolean) => {
			setAlignToUnit(checked)
			reapplyRelativeRangeForAlign(checked)
		},
		[reapplyRelativeRangeForAlign],
	)

	useEffect(() => {
		setHistory(loadHistory(historyStorageKey))
	}, [historyStorageKey])

	useEffect(() => {
		setActiveRelativeUnit((currentUnit) =>
			relativeUnits.includes(currentUnit) ? currentUnit : defaultActiveRelativeUnit,
		)
		setCustomUnit((currentUnit) =>
			relativeUnits.includes(currentUnit) ? currentUnit : defaultRelativeUnit,
		)
	}, [defaultActiveRelativeUnit, defaultRelativeUnit, relativeUnits])

	const resetPanelState = useCallback(() => {
		setOpen(false)
		setActiveTab(TimeFilterTab.relative)
		setSelectedPresetKey(defaultPresetKey ?? null)
		setRelativeMode(RelativeMode.preset)
		setAlignToUnit(false)
		setCustomValue(DEFAULT_CUSTOM_VALUE)
		setActiveRelativeUnit(defaultActiveRelativeUnit)
		setCustomUnit(defaultRelativeUnit)
		setAbsoluteRange([null, null])
	}, [defaultActiveRelativeUnit, defaultPresetKey, defaultRelativeUnit])

	useEffect(() => {
		if (!isControlled || !timeRangeValue) return

		setActiveTab(timeRangeValue.tab)

		if (timeRangeValue.mode === HistoryMode.relative && timeRangeValue.presetKey) {
			setRelativeMode(RelativeMode.preset)
			setSelectedPresetKey(timeRangeValue.presetKey)
			const presetUnit = getPresetUnit(timeRangeValue.presetKey)
			if (relativeUnits.includes(presetUnit)) setActiveRelativeUnit(presetUnit)
			return
		}

		if (timeRangeValue.mode === HistoryMode.custom) {
			setRelativeMode(RelativeMode.custom)
			setSelectedPresetKey(null)
			return
		}

		if (timeRangeValue.mode === HistoryMode.monthly) {
			setRelativeMode(RelativeMode.monthly)
			setSelectedPresetKey(null)
			return
		}

		if (timeRangeValue.mode === HistoryMode.absolute) {
			setSelectedPresetKey(null)
			setAbsoluteRange([dayjs(timeRangeValue.startDate), dayjs(timeRangeValue.endDate)])
		}
	}, [isControlled, relativeUnits, timeRangeValue])

	useEffect(() => {
		if (!isControlled) return
		if (timeRangeValue?.startDate && timeRangeValue?.endDate) return

		resetPanelState()
	}, [isControlled, resetPanelState, timeRangeValue])

	useEffect(() => {
		if (hasInitializedRef.current || !defaultPresetKey || isControlled) return
		hasInitializedRef.current = true

		const matchedPreset = [...allQuickPresetOptions, ...STANDARD_PRESET_OPTIONS].find(
			(item) => item.key === defaultPresetKey,
		)

		const presetReferenceDate = maxDate && isDayOnly ? maxDate : dayjs()
		const [start, end] = getRangeByPreset(
			defaultPresetKey,
			presetReferenceDate,
			false,
			precision,
		)
		setAbsoluteRange([start, end])
		applyRange({
			start,
			end,
			label: matchedPreset
				? getPresetOptionLabel(locale, matchedPreset)
				: locale.preset.last24Hours,
			tab: TimeFilterTab.relative,
			mode: HistoryMode.relative,
			presetKey: defaultPresetKey,
			persist: false,
		})
		setSelectedPresetKey(defaultPresetKey)
	}, [
		allQuickPresetOptions,
		applyRange,
		defaultPresetKey,
		isControlled,
		isDayOnly,
		locale,
		maxDate,
		precision,
	])

	const handlePresetApply = (presetKey: TimePresetKey) => {
		setRelativeMode(RelativeMode.preset)
		setSelectedPresetKey(presetKey)
		const option = [...allQuickPresetOptions, ...STANDARD_PRESET_OPTIONS].find(
			(item) => item.key === presetKey,
		)
		const presetReferenceDate = maxDate && isDayOnly ? maxDate : dayjs()
		const [nextStart, nextEnd] = getRangeByPreset(
			presetKey,
			presetReferenceDate,
			alignToUnit,
			precision,
		)

		applyRange({
			start: nextStart,
			end: nextEnd,
			label: option ? getPresetOptionLabel(locale, option) : locale.preset.last24Hours,
			tab: TimeFilterTab.relative,
			mode: HistoryMode.relative,
			presetKey,
		})
	}

	const handleCustomToggle = () => {
		if (relativeMode === RelativeMode.custom) {
			setRelativeMode(RelativeMode.preset)
			return
		}

		setCustomValue(DEFAULT_CUSTOM_VALUE)
		setCustomUnit(defaultRelativeUnit)
		setRelativeMode(RelativeMode.custom)
	}

	const handleCustomRelativeApply = () => {
		const [start, end] = buildCustomRelativeRange({
			now: maxDate ?? dayjs(),
			value: customValue,
			unit: customUnit,
			alignToUnit,
			precision,
		})

		setRelativeMode(RelativeMode.custom)
		applyRange({
			start,
			end,
			label: formatTemplate(locale.customRelativeLabel, {
				value: String(customValue),
				unit: getUnitLabel(locale, customUnit),
			}),
			tab: TimeFilterTab.relative,
			mode: HistoryMode.custom,
		})
	}

	const handleMonthApply = (monthKey: string) => {
		const [start, end] = getMonthRange(monthKey, monthReferenceDate)
		setRelativeMode(RelativeMode.monthly)
		applyRange({
			start,
			end,
			label: formatTemplate(locale.monthLabel, { month: formatMonthLabel(monthKey, locale) }),
			tab: TimeFilterTab.relative,
			mode: HistoryMode.monthly,
		})
	}

	const handleAbsoluteApply = () => {
		if (!absoluteRange[0] || !absoluteRange[1]) return

		applyRange({
			start: absoluteRange[0],
			end: absoluteRange[1],
			label: formatTimeRangeDisplay(
				{
					startDate: absoluteRange[0].format(DATE_FORMAT),
					endDate: absoluteRange[1].format(DATE_FORMAT),
					tab: TimeFilterTab.absolute,
				},
				precision,
			),
			tab: TimeFilterTab.absolute,
			mode: HistoryMode.absolute,
		})
	}

	const handleClear = useCallback(
		(event: React.MouseEvent<HTMLSpanElement>) => {
			event.preventDefault()
			event.stopPropagation()
			resetPanelState()
			setTimeRangeValue(null)
		},
		[resetPanelState, setTimeRangeValue],
	)

	const absolutePickerContainerRef = useRef<HTMLDivElement>(null)
	const panelContent = (
		<div className={styles.panel}>
			<MagicTabs
				className={styles.tabs}
				activeKey={activeTab}
				onChange={(key) => setActiveTab(key as TimeFilterTab)}
				items={[
					{
						key: TimeFilterTab.relative,
						label: locale.relative,
						children: (
							<div className={styles.tabPane}>
								<div className={styles.topBar}>
									<div className={styles.rangeInline}>
										<div className={styles.currentRangeValue}>
											{currentRangeText}
										</div>
									</div>
									{!isDayOnly ? (
										<div className={styles.switchCard}>
											<div className={styles.switchLabel}>
												{locale.alignToUnit}
											</div>
											<MagicSwitch
												checked={alignToUnit}
												onChange={handleAlignToUnitChange}
											/>
										</div>
									) : null}
								</div>

								<div className={styles.relativeLayout}>
									<div className={styles.relativeMain}>
										<div className={styles.section}>
											<div className={styles.quickPresetHeader}>
												<div className={styles.sectionLabel}>
													{locale.quickPreset}
												</div>
												{relativeUnits.length > 1 ? (
													<Segmented
														className={styles.unitSegmented}
														size="small"
														options={unitOptions}
														value={displayedRelativeUnit}
														onChange={(value) =>
															setActiveRelativeUnit(
																value as RelativeUnit,
															)
														}
													/>
												) : null}
											</div>
											<div className={styles.quickPresetList}>
												{[displayedRelativeUnit].map((unit) => (
													<div
														key={unit}
														className={styles.quickPresetRow}
													>
														<div className={styles.quickPresetUnit}>
															{getUnitLabel(locale, unit)}
														</div>
														<div className={styles.quickPresetOptions}>
															{activeQuickPresetOptions.map(
																(option) => {
																	const optionLabel =
																		getPresetOptionLabel(
																			locale,
																			option,
																		)

																	return (
																		<Button
																			key={option.key}
																			type="text"
																			title={optionLabel}
																			aria-label={optionLabel}
																			className={cx(
																				styles.optionButton,
																				styles.quickPresetButton,
																				{
																					[styles.optionButtonActive]:
																						relativeMode ===
																							RelativeMode.preset &&
																						selectedPresetKey ===
																							option.key,
																				},
																			)}
																			onClick={() =>
																				handlePresetApply(
																					option.key,
																				)
																			}
																		>
																			{optionLabel}
																		</Button>
																	)
																},
															)}
														</div>
													</div>
												))}
											</div>
										</div>

										<div className={styles.section}>
											<Button
												type="text"
												className={cx(styles.customButton, {
													[styles.customButtonActive]:
														relativeMode === RelativeMode.custom,
												})}
												onClick={handleCustomToggle}
											>
												{locale.custom}
											</Button>
											{relativeMode === RelativeMode.custom ? (
												<div
													className={cx(styles.customTray, {
														[styles.customTrayActive]:
															relativeMode === RelativeMode.custom,
													})}
												>
													<div className={styles.customPrefix}>
														{locale.closest}
													</div>
													<MagicInputNumber
														className={styles.customInput}
														min={1}
														value={customValue}
														onChange={(value) =>
															setCustomValue(Number(value) || 1)
														}
													/>
													<Select
														className={styles.customSelect}
														options={unitOptions}
														value={customUnit}
														onChange={(value) => setCustomUnit(value)}
													/>
													<MagicButton
														className={styles.confirmButton}
														type="primary"
														onClick={handleCustomRelativeApply}
													>
														{locale.confirm}
													</MagicButton>
												</div>
											) : null}
										</div>
									</div>

									<div className={styles.relativeSide}>
										<div className={styles.section}>
											<div className={styles.sectionLabel}>
												{locale.standardPreset}
											</div>
											<div className={styles.standardPresetGrid}>
												{availableStandardPresetOptions.map((option) => (
													<Button
														key={option.key}
														type="text"
														className={cx(styles.optionButton, {
															[styles.optionButtonActive]:
																relativeMode ===
																	RelativeMode.preset &&
																selectedPresetKey === option.key,
														})}
														onClick={() =>
															handlePresetApply(option.key)
														}
													>
														{getPresetOptionLabel(locale, option)}
													</Button>
												))}
											</div>
										</div>

										<div className={styles.section}>
											<div className={styles.sectionLabel}>
												{locale.monthly}
											</div>
											<div className={styles.monthlyGrid}>
												{monthKeys.slice(0, 6).map((monthKey) => (
													<Button
														key={monthKey}
														type="text"
														className={cx(styles.optionButton, {
															[styles.optionButtonActive]:
																relativeMode ===
																	RelativeMode.monthly &&
																timeRangeValue?.label ===
																	formatTemplate(
																		locale.monthLabel,
																		{
																			month: formatMonthLabel(
																				monthKey,
																				locale,
																			),
																		},
																	),
														})}
														onClick={() => handleMonthApply(monthKey)}
													>
														{formatMonthLabel(monthKey, locale)}
													</Button>
												))}
											</div>
										</div>
									</div>
								</div>
							</div>
						),
					},
					{
						key: TimeFilterTab.absolute,
						label: locale.absolute,
						children: (
							<div className={styles.tabPane}>
								<div
									ref={absolutePickerContainerRef}
									className={styles.absolutePickerEmbed}
								>
									<RangePicker
										className={styles.absoluteRangePicker}
										allowClear={false}
										open={activeTab === TimeFilterTab.absolute}
										getPopupContainer={() =>
											absolutePickerContainerRef.current || document.body
										}
										needConfirm={false}
										popupClassName={styles.absolutePickerDropdown}
										value={absoluteRange}
										disabledDate={(current) =>
											Boolean(maxDate && current.isAfter(maxDate, "day"))
										}
										format={DATE_FORMAT}
										presets={absolutePresets}
										onChange={(value) =>
											setAbsoluteRange(
												((value as [Dayjs | null, Dayjs | null] | null) ?? [
													null,
													null,
												]) as [Dayjs | null, Dayjs | null],
											)
										}
									/>
								</div>

								<div className={styles.footer}>
									<MagicButton
										className={styles.confirmButton}
										type="primary"
										disabled={!absoluteRange[0] || !absoluteRange[1]}
										onClick={handleAbsoluteApply}
									>
										{locale.confirm}
									</MagicButton>
								</div>
							</div>
						),
					},
					{
						key: TimeFilterTab.history,
						label: locale.history,
						children: history.length ? (
							<div className={styles.historyList}>
								{history.map((item) => (
									<button
										key={item.id}
										type="button"
										className={styles.historyItem}
										onClick={() => {
											setActiveTab(item.tab)
											applyRange({
												start: dayjs(item.startDate),
												end: dayjs(item.endDate),
												label: item.label,
												tab: item.tab,
												mode: item.mode,
												presetKey: item.presetKey,
											})
										}}
									>
										<div className={styles.historyItemMain}>
											<div className={styles.historyTitle}>
												{item.tab === TimeFilterTab.absolute ||
												item.mode === HistoryMode.absolute
													? formatTimeRangeDisplay(item, precision)
													: item.label}
											</div>
											<div className={styles.historyRange}>
												{formatTimeRangeDisplay(item, precision)}
											</div>
										</div>
										<Button
											type="text"
											icon={<IconTrash size={16} />}
											onClick={(event) => {
												event.stopPropagation()
												setHistory(
													removeHistory(item.id, historyStorageKey),
												)
											}}
										/>
									</button>
								))}
							</div>
						) : (
							<div className={styles.empty}>
								<Empty
									image={Empty.PRESENTED_IMAGE_SIMPLE}
									description={locale.emptyHistory}
								/>
							</div>
						),
					},
				]}
			/>
		</div>
	)

	return (
		<Popover
			trigger="click"
			open={open}
			onOpenChange={setOpen}
			content={panelContent}
			overlayClassName={styles.popover}
			placement="bottomLeft"
		>
			<MagicButton className={styles.triggerButton}>
				<div className={styles.triggerContent}>
					{prefix ? <span className={styles.triggerPrefix}>{prefix}</span> : null}
					{triggerLabel ? (
						<Typography.Text className={styles.triggerLabel}>
							{triggerLabel}
						</Typography.Text>
					) : (
						<span className={styles.triggerPlaceholder}>{locale.placeholder}</span>
					)}
				</div>
				<Space size={6} className={styles.triggerIconWrap}>
					{triggerLabel && clearable ? (
						<>
							<span
								data-role="time-filter-clear"
								className={styles.triggerClearIconWrap}
								onClick={handleClear}
							>
								<IconX size={14} className={styles.triggerClearButton} />
							</span>
							<IconCalendarClock
								size={16}
								data-role="time-filter-icon"
								className={styles.triggerCalendarIcon}
							/>
						</>
					) : (
						<IconCalendarClock size={16} />
					)}
				</Space>
			</MagicButton>
		</Popover>
	)
}

export default TimeFilterPanel
