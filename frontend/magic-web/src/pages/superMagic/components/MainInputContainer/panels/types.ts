/**
 * Fallback key for locale text maps.
 */
export const DEFAULT_LOCALE_KEY = "default"

/**
 * Locale map for multi-language text.
 * `default` is the fallback when locale-specific text is missing.
 */
export interface LocaleTextMap extends Record<string, string> {
	default: string
}

/**
 * Text value can be a plain string or a locale map.
 * e.g. { "default": "Style", "zh_CN": "风格", "en_US": "Style" }
 */
export type LocaleText = string | LocaleTextMap

/**
 * Slide filter configuration
 */
export interface FieldItem {
	data_key: string
	label: LocaleText
	/** Runtime-only: managed by TemplatePanelStore, not set in static config */
	current_value?: string
	options: (OptionGroup | OptionItem)[]
	has_leading_icon?: boolean
	leading_icon?: string
	// default selected group key
	default_group_key?: string
	// default selected value
	default_value?: LocaleText
	// option view mode
	option_view_type?: OptionViewType
	// whether this preset is enabled in the UI
	enabled?: boolean
	// ISO date string for last updated time
	updated_at?: string
	// instruction template appended to user messages via preset value
	preset_content?: LocaleText
}

/**
 * Slide template card configuration
 */
export interface OptionItem {
	value: LocaleText
	label?: LocaleText
	thumbnail_url?: string
	description?: LocaleText
	icon_url?: string
	sub_text?: LocaleText
	width?: number
	height?: number
	aspect_ratio?: number
}

/**
 * Template group configuration
 */
export interface OptionGroup {
	group_key: string
	group_name: LocaleText
	group_icon?: string
	group_description?: LocaleText
	children?: OptionItem[]
}

/**
 * 面板类型
 */
export const enum SkillPanelType {
	GUIDE = "guide",
	FIELD = "field",
	DEMO = "demo",
}

/**
 * 模板视图模式
 */
export const enum OptionViewType {
	// 网格视图
	GRID = "grid",
	// 瀑布流视图
	WATERFALL = "waterfall",
	// 文本列表视图
	TEXT_LIST = "text_list",
	// 胶囊视图
	CAPSULE = "capsule",
	// 下拉框
	DROPDOWN = "dropdown",
}

/**
 * Base panel configuration
 */
export interface BasePanelConfig {
	title?: LocaleText
	// 是否可展开
	expandable?: boolean
	// 默认展开
	default_expanded?: boolean
}

/**
 * 模板面板配置
 */
export interface FieldPanelConfig extends BasePanelConfig {
	type: SkillPanelType.FIELD
	field?: {
		items: FieldItem[]
		// panel-level display type, e.g. "dropdown" | OptionViewType
		view_type?: OptionViewType
	}
}

/** Click action type for a guide item */
export type ClickActionType =
	| "no_action"
	| "focus_input"
	| "ai_enhancement"
	| "fill_content"
	| "open_url"
	| "upload_file"

/** Execution method when click action fills/sends content */
export type ExecutionMethodType = "send_immediately" | "insert_to_input"

/**
 * 指南项配置
 */
export interface GuideItem {
	key: string
	title: LocaleText
	description: LocaleText
	icon: string
	/** Whether this guide item is enabled */
	enabled?: boolean
	/** ISO date string or display string for last updated time */
	updated_at?: string
	/** Click action type */
	click_action?: ClickActionType
	/** Preset content for fill_content / ai_enhancement actions */
	preset_content?: LocaleText
	/** URL for open_url action */
	url?: string
	/** Execution method for fill_content / ai_enhancement actions */
	execution_method?: ExecutionMethodType
}

/**
 * 指南面板配置
 */
export interface GuidePanelConfig extends BasePanelConfig {
	type: SkillPanelType.GUIDE
	guide: {
		items: GuideItem[]
	}
}

/**
 * 演示面板配置
 */
export interface DemoPanelConfig extends BasePanelConfig {
	type: SkillPanelType.DEMO
	demo: {
		groups: OptionGroup[]
		// 默认选中的模板组
		default_selected_group_key?: string
		// 默认选中的模板
		default_selected_template_key?: string
		// 模板视图模式
		view_type?: OptionViewType
	}
}

/**
 * Skill config configuration
 */
export type SkillPanelConfig = FieldPanelConfig | GuidePanelConfig | DemoPanelConfig

export type SkillPanelConfigArray = SkillPanelConfig[]

/**
 * Skill configuration
 */
export interface SkillConfig {
	// Panel configurations
	panels: SkillPanelConfigArray
	// Input placeholder text
	placeholder?: LocaleText
}
