import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, DatePicker, Empty, Popover, Select, Space, Typography } from "antd"
import dayjs, { type Dayjs } from "dayjs"
import { IconCalendarClock, IconTrash } from "@tabler/icons-react"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicButton from "../MagicButton"
import MagicInputNumber from "../MagicInputNumber"
import MagicSwitch from "../MagicSwitch"
import MagicTabs from "../MagicTabs"
import { useStyles } from "./style"
import {
	CommonAbsolutePresetKey,
	HistoryMode,
	RelativeMode,
	RelativeUnit,
	TimeFilterHistoryItem,
	TimeFilterLocale,
	TimeFilterTab,
	TimePresetKey,
	TimeRangeValue,
} from "./types"
import {
	buildCustomRelativeRange,
	createHistoryEntry,
	DATE_TIME_FORMAT,
	formatMonthLabel,
	getCommonAbsolutePresetRanges,
	getMonthRange,
	getRangeByPreset,
	getRecentMonthKeys,
	loadHistory,
	QUICK_PRESET_OPTIONS,
	removeHistory,
	STANDARD_PRESET_OPTIONS,
	upsertHistory,
} from "./utils"

const { RangePicker } = DatePicker
const DEFAULT_CUSTOM_VALUE = 15
const DEFAULT_CUSTOM_UNIT = RelativeUnit.minute

export interface TimeFilterPanelProps {
	defaultPresetKey?: TimePresetKey
	onChange?: (value: TimeRangeValue) => void
}

function TimeFilterPanel({ defaultPresetKey, onChange }: TimeFilterPanelProps) {
	const { styles, cx } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("TimeFilterPanel")
	const hasInitializedRef = useRef(false)
	const [open, setOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<TimeFilterTab>(TimeFilterTab.relative)
	const [selectedPresetKey, setSelectedPresetKey] = useState<TimePresetKey | null>(
		defaultPresetKey ?? null,
	)
	const [relativeMode, setRelativeMode] = useState<RelativeMode>(RelativeMode.preset)
	const [alignToUnit, setAlignToUnit] = useState(false)
	const [customValue, setCustomValue] = useState(DEFAULT_CUSTOM_VALUE)
	const [customUnit, setCustomUnit] = useState<RelativeUnit>(DEFAULT_CUSTOM_UNIT)
	const [absoluteRange, setAbsoluteRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
	const [currentValue, setCurrentValue] = useState<TimeRangeValue | null>(null)
	const [history, setHistory] = useState<TimeFilterHistoryItem[]>([])

	const monthKeys = useMemo(() => getRecentMonthKeys(dayjs(), 12), [])
	const unitOptions = useMemo(
		() => [
			{ label: locale.unit.minute, value: RelativeUnit.minute },
			{ label: locale.unit.hour, value: RelativeUnit.hour },
			{ label: locale.unit.day, value: RelativeUnit.day },
		],
		[locale],
	)
	const absolutePresets = useMemo(
		() =>
			getCommonAbsolutePresetRanges(dayjs()).map((item) => ({
				label: getAbsolutePresetLabel(locale, item.key),
				value: item.value,
			})),
		[locale],
	)
	const quickPresetGroups = useMemo(
		() => [
			{
				key: "minute",
				options: QUICK_PRESET_OPTIONS.filter((option) =>
					[
						TimePresetKey.last_1_minute,
						TimePresetKey.last_5_minutes,
						TimePresetKey.last_10_minutes,
						TimePresetKey.last_15_minutes,
						TimePresetKey.last_30_minutes,
					].includes(option.key),
				),
			},
			{
				key: "hour",
				options: QUICK_PRESET_OPTIONS.filter((option) =>
					[
						TimePresetKey.last_1_hour,
						TimePresetKey.last_3_hours,
						TimePresetKey.last_6_hours,
						TimePresetKey.last_12_hours,
					].includes(option.key),
				),
			},
			{
				key: "day",
				options: QUICK_PRESET_OPTIONS.filter((option) =>
					[
						TimePresetKey.last_1_day,
						TimePresetKey.last_3_days,
						TimePresetKey.last_7_days,
						TimePresetKey.last_30_days,
						TimePresetKey.last_90_days,
					].includes(option.key),
				),
			},
		],
		[],
	)
	const currentRangeText = currentValue
		? `${currentValue.startDate} ~ ${currentValue.endDate}`
		: locale.placeholder

	const applyRange = useCallback(
		({
			start,
			end,
			label,
			tab,
			mode,
			persist = true,
			closePanel = true,
		}: {
			start: Dayjs
			end: Dayjs
			label: string
			tab: TimeFilterTab
			mode: HistoryMode
			persist?: boolean
			closePanel?: boolean
		}) => {
			const nextValue: TimeRangeValue = {
				startDate: start.format(DATE_TIME_FORMAT),
				endDate: end.format(DATE_TIME_FORMAT),
				label,
				tab,
				mode,
			}

			setCurrentValue(nextValue)
			onChange?.(nextValue)

			if (persist) {
				setHistory(upsertHistory(createHistoryEntry(nextValue)))
			}

			if (closePanel) {
				setOpen(false)
			}
		},
		[onChange],
	)

	const reapplyRelativeRangeForAlign = useCallback(
		(nextAlignToUnit: boolean) => {
			if (!currentValue || currentValue.tab !== TimeFilterTab.relative) return

			const now = dayjs()
			let start: Dayjs
			let end: Dayjs
			let label = currentValue.label
			const mode = currentValue.mode

			if (currentValue.mode === HistoryMode.relative && selectedPresetKey) {
				;[start, end] = getRangeByPreset(selectedPresetKey, now, nextAlignToUnit)
				const option = [...QUICK_PRESET_OPTIONS, ...STANDARD_PRESET_OPTIONS].find(
					(item) => item.key === selectedPresetKey,
				)
				if (option) {
					label = getPresetLabel(locale, option.labelKey)
				}
			} else if (currentValue.mode === HistoryMode.custom) {
				;[start, end] = buildCustomRelativeRange({
					now,
					value: customValue,
					unit: customUnit,
					alignToUnit: nextAlignToUnit,
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
		[applyRange, currentValue, customUnit, customValue, locale, selectedPresetKey],
	)

	const handleAlignToUnitChange = useCallback(
		(checked: boolean) => {
			setAlignToUnit(checked)
			reapplyRelativeRangeForAlign(checked)
		},
		[reapplyRelativeRangeForAlign],
	)

	useEffect(() => {
		setHistory(loadHistory())
	}, [])

	useEffect(() => {
		if (hasInitializedRef.current || !defaultPresetKey) return
		hasInitializedRef.current = true

		const matchedPreset = [...QUICK_PRESET_OPTIONS, ...STANDARD_PRESET_OPTIONS].find(
			(item) => item.key === defaultPresetKey,
		)

		const [start, end] = getRangeByPreset(defaultPresetKey, dayjs(), false)
		setAbsoluteRange([start, end])
		applyRange({
			start,
			end,
			label: matchedPreset
				? getPresetLabel(locale, matchedPreset.labelKey)
				: locale.preset.last24Hours,
			tab: TimeFilterTab.relative,
			mode: HistoryMode.relative,
			persist: false,
		})
		setSelectedPresetKey(defaultPresetKey)
	}, [applyRange, defaultPresetKey, locale])

	const handlePresetApply = (presetKey: TimePresetKey) => {
		setRelativeMode(RelativeMode.preset)
		setSelectedPresetKey(presetKey)
		const option = [...QUICK_PRESET_OPTIONS, ...STANDARD_PRESET_OPTIONS].find(
			(item) => item.key === presetKey,
		)
		const [start, end] = getRangeByPreset(presetKey, dayjs(), alignToUnit)

		applyRange({
			start,
			end,
			label: option ? getPresetLabel(locale, option.labelKey) : locale.preset.last24Hours,
			tab: TimeFilterTab.relative,
			mode: HistoryMode.relative,
		})
	}

	const handleCustomToggle = () => {
		if (relativeMode === RelativeMode.custom) {
			setRelativeMode(RelativeMode.preset)
			return
		}

		setCustomValue(DEFAULT_CUSTOM_VALUE)
		setCustomUnit(DEFAULT_CUSTOM_UNIT)
		setRelativeMode(RelativeMode.custom)
	}

	const handleCustomRelativeApply = () => {
		const [start, end] = buildCustomRelativeRange({
			now: dayjs(),
			value: customValue,
			unit: customUnit,
			alignToUnit,
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
		const [start, end] = getMonthRange(monthKey)
		setRelativeMode(RelativeMode.monthly)
		applyRange({
			start,
			end,
			label: formatTemplate(locale.monthLabel, { month: formatMonthLabel(monthKey) }),
			tab: TimeFilterTab.relative,
			mode: HistoryMode.monthly,
		})
	}

	const handleAbsoluteApply = () => {
		if (!absoluteRange[0] || !absoluteRange[1]) return

		applyRange({
			start: absoluteRange[0],
			end: absoluteRange[1],
			label: `${absoluteRange[0].format(DATE_TIME_FORMAT)} ~ ${absoluteRange[1].format(
				DATE_TIME_FORMAT,
			)}`,
			tab: TimeFilterTab.absolute,
			mode: HistoryMode.absolute,
		})
	}

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
									<div className={styles.switchCard}>
										<div className={styles.switchLabel}>
											{locale.alignToUnit}
										</div>
										<MagicSwitch
											checked={alignToUnit}
											onChange={handleAlignToUnitChange}
										/>
									</div>
								</div>

								<div className={styles.relativeLayout}>
									<div className={styles.relativeMain}>
										<div className={styles.section}>
											<div className={styles.sectionLabel}>
												{locale.quickPreset}
											</div>
											<div className={styles.quickPresetColumns}>
												{quickPresetGroups.map((group) => (
													<div
														key={group.key}
														className={styles.quickPresetColumn}
													>
														{group.options.map((option) => (
															<Button
																key={option.key}
																type="text"
																className={cx(styles.optionButton, {
																	[styles.optionButtonActive]:
																		relativeMode ===
																			RelativeMode.preset &&
																		selectedPresetKey ===
																			option.key,
																})}
																onClick={() =>
																	handlePresetApply(option.key)
																}
															>
																{getPresetLabel(
																	locale,
																	option.labelKey,
																)}
															</Button>
														))}
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
												{STANDARD_PRESET_OPTIONS.map((option) => (
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
														{getPresetLabel(locale, option.labelKey)}
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
																currentValue?.label ===
																	formatTemplate(
																		locale.monthLabel,
																		{
																			month: formatMonthLabel(
																				monthKey,
																			),
																		},
																	),
														})}
														onClick={() => handleMonthApply(monthKey)}
													>
														{formatMonthLabel(monthKey)}
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
								<div className={styles.absoluteCard}>
									<RangePicker
										className={styles.absoluteRangePicker}
										allowClear={false}
										showTime
										value={absoluteRange}
										format={DATE_TIME_FORMAT}
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
											})
										}}
									>
										<div className={styles.historyItemMain}>
											<div className={styles.historyTitle}>{item.label}</div>
											<div className={styles.historyRange}>
												{item.startDate} ~ {item.endDate}
											</div>
										</div>
										<Button
											type="text"
											icon={<IconTrash size={16} />}
											onClick={(event) => {
												event.stopPropagation()
												setHistory(removeHistory(item.id))
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
				{currentValue?.label ? (
					<Typography.Text className={styles.triggerLabel}>
						{currentValue.label}
					</Typography.Text>
				) : (
					locale.placeholder
				)}
				<Space size={6}>
					<IconCalendarClock size={16} />
				</Space>
			</MagicButton>
		</Popover>
	)
}

export default TimeFilterPanel

function getPresetLabel(locale: { preset: Record<string, string> }, key: string) {
	return locale.preset[key as keyof typeof locale.preset] || locale.preset.last24Hours
}

function getAbsolutePresetLabel(locale: TimeFilterLocale, key: CommonAbsolutePresetKey) {
	if (key === CommonAbsolutePresetKey.last_3_days) return locale.preset.last3Days
	if (key === CommonAbsolutePresetKey.last_7_days) return locale.preset.last7Days
	if (key === CommonAbsolutePresetKey.last_14_days)
		return formatTemplate(locale.customRelativeLabel, {
			value: "14",
			unit: locale.unit.day,
		})
	if (key === CommonAbsolutePresetKey.last_21_days)
		return formatTemplate(locale.customRelativeLabel, {
			value: "21",
			unit: locale.unit.day,
		})
	if (key === CommonAbsolutePresetKey.last_30_days) return locale.preset.last30Days
	return locale.preset.last90Days
}

function formatTemplate(template: string, values: Record<string, string>) {
	return Object.entries(values).reduce(
		(result, [key, value]) => result.split(`{${key}}`).join(value),
		template,
	)
}

function getUnitLabel(locale: TimeFilterLocale, unit: RelativeUnit) {
	if (unit === RelativeUnit.day) return locale.unit.day
	if (unit === RelativeUnit.hour) return locale.unit.hour
	return locale.unit.minute
}
