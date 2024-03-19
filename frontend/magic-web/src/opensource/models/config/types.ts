import type { ThemeMode } from "antd-style"

/**
 * @description 应用配置（国际化语言、主题、国际冠号）
 */
export namespace Config {
	export type LanguageValue = "en_US" | "zh_CN" | "auto"

	/** 全局国际化语言选项 */
	export interface LanguageOption {
		/** 当前语言标识 */
		locale: string
		/** 当前语言名称 */
		name: string
		/** 用于当前语言的枚举各语言的表达 */
		translations: Record<string, string>
	}

	/** 全局国际冠号选项 */
	export interface AreaCodeOption {
		/** 当前语言标识 */
		locale: string
		/** 当前冠号识别号 */
		code: string
		/** 当前语言名称 */
		name: string
		/** 用于当前语言的枚举各语言的表达 */
		translations: Record<string, string>
	}

	/** 全局语言模块 */
	export interface Language {
		/** 当前语言 */
		language: string
		/** 本地语言列表 */
		languages: Array<LanguageOption>
		/** 设置当前语言 */
		setLanguage: (language: string) => void
		/** 设置语言列表 */
		setLanguages: (languages: Array<LanguageOption>) => void
		/** 国际冠号(电话号码地区识别号) */
		areaCodes: Array<AreaCodeOption>
		setAreaCodes: (areaCodes: Array<AreaCodeOption>) => void
		/** 获取全局国际化配置 */
		// useFetchOptions: () => void
		/** 国际化语言实例 */
		// instance: i18n
	}

	/** 初始化全局配置 */
	export interface InitializeGlobalConfig {
		/** 初始化主题 */
		initializeTheme?: ThemeMode
		/** 初始化国际化语言 */
		initializeI18n?: LanguageValue
	}
}
