export const timeFilterTab = {
	relative: "relative",
	absolute: "absolute",
	history: "history",
} as const

export const historyMode = {
	relative: "relative",
	absolute: "absolute",
	monthly: "monthly",
	custom: "custom",
} as const

export const relativeUnit = {
	second: "second",
	minute: "minute",
	hour: "hour",
	day: "day",
} as const

export const relativeMode = {
	preset: "preset",
	custom: "custom",
	monthly: "monthly",
} as const

export const timePresetKey = {
	last_1_second: "last_1_second",
	last_5_seconds: "last_5_seconds",
	last_10_seconds: "last_10_seconds",
	last_15_seconds: "last_15_seconds",
	last_30_seconds: "last_30_seconds",
	last_1_minute: "last_1_minute",
	last_5_minutes: "last_5_minutes",
	last_10_minutes: "last_10_minutes",
	last_15_minutes: "last_15_minutes",
	last_30_minutes: "last_30_minutes",
	last_1_hour: "last_1_hour",
	last_3_hours: "last_3_hours",
	last_6_hours: "last_6_hours",
	last_12_hours: "last_12_hours",
	last_24_hours: "last_24_hours",
	last_1_day: "last_1_day",
	today: "today",
	yesterday: "yesterday",
	day_before_yesterday: "day_before_yesterday",
	last_3_days: "last_3_days",
	last_7_days: "last_7_days",
	last_14_days: "last_14_days",
	last_21_days: "last_21_days",
	last_30_days: "last_30_days",
	last_60_days: "last_60_days",
	last_90_days: "last_90_days",
	last_120_days: "last_120_days",
	last_180_days: "last_180_days",
	last_365_days: "last_365_days",
	this_week: "this_week",
	last_week: "last_week",
	this_month: "this_month",
	last_month: "last_month",
	this_year: "this_year",
} as const

export const commonAbsolutePresetKey = {
	last_3_days: "last_3_days",
	last_7_days: "last_7_days",
	last_14_days: "last_14_days",
	last_21_days: "last_21_days",
	last_30_days: "last_30_days",
	last_90_days: "last_90_days",
} as const

/** 时间筛选面板的展示 Tab；history 仅表示进入历史记录视图，不代表一种时间范围。 */
export type TimeFilterTab = (typeof timeFilterTab)[keyof typeof timeFilterTab]

/** 面板的承载方式；inline 直接展开，popover 通过触发器打开浮层。 */
export type TimeFilterPresentation = "inline" | "popover"

/** 时间范围的精度；day 会隐藏时间选择器并按自然日处理。 */
export type TimePrecision = "day" | "hour" | "minute" | "second"

/** 持久化记录使用的范围模式，用于恢复相应的 Tab 和展示状态。 */
export type HistoryMode = (typeof historyMode)[keyof typeof historyMode]

/** 相对时间可用的单位；调用方可以通过 supportedRelativeUnits 限制可选项。 */
export type RelativeUnit = (typeof relativeUnit)[keyof typeof relativeUnit]

/** 相对时间 Tab 内部的选择模式。 */
export type RelativeMode = (typeof relativeMode)[keyof typeof relativeMode]

/** 预设选项的稳定标识，同时用于生成范围和匹配选中状态。 */
export type TimePresetKey = (typeof timePresetKey)[keyof typeof timePresetKey]

/** 绝对时间 Tab 支持的标准范围预设标识。 */
export type CommonAbsolutePresetKey =
	(typeof commonAbsolutePresetKey)[keyof typeof commonAbsolutePresetKey]

/**
 * TimeFilterPanel 对外传递的时间范围值。
 * 日期使用内部统一的格式化字符串，而不是 Date，便于 URL、历史记录和 API 参数复用。
 */
export type TimeRangeValue = {
	/** 范围结束时间；通常与 startDate 成对出现。 */
	endDate: string
	/** 当前范围用于触发器和历史记录展示的本地化文案。 */
	label: string
	/** 范围的业务来源；relative/custom/monthly/absolute 对应不同恢复逻辑。 */
	mode: HistoryMode
	/** 来源为预设时存在；自定义范围和按月范围不设置该字段。 */
	presetKey?: TimePresetKey
	/** 相对时间自定义范围或相对时间预设使用的单位。 */
	relativeUnit?: RelativeUnit
	/** 范围开始时间；通常与 endDate 成对出现。 */
	startDate: string
	/** 生成该范围时所在的 Tab。 */
	tab: TimeFilterTab
}

/** 写入 localStorage 的时间范围记录，额外包含稳定 ID 和创建时间。 */
export type TimeFilterHistoryItem = TimeRangeValue & {
	/** 记录创建时间，用于排序和展示之外的历史记录管理。 */
	createdAt: string
	/** 历史记录删除和 React 列表渲染使用的稳定标识。 */
	id: string
}

/** 相对时间或标准时间预设的展示配置。 */
export type TimePresetOption = {
	/** 预设的稳定业务标识。 */
	key: TimePresetKey
	/** i18n 文案 key，而不是已经翻译好的文本。 */
	labelKey: string
}

/** 带数量和单位的相对时间预设配置。 */
export type RelativeTimePresetOption = TimePresetOption & {
	/** 相对于当前时间计算范围时使用的数量。 */
	amount: number
	/** 相对于当前时间计算范围时使用的单位。 */
	unit: RelativeUnit
}

/** 绝对时间标准预设计算出的开始和结束时间。 */
export type CommonAbsolutePresetRange = {
	/** 预设的稳定业务标识。 */
	key: CommonAbsolutePresetKey
	/** 使用 Date 供日历和时间精度归一化逻辑继续处理。 */
	value: [Date, Date]
}
