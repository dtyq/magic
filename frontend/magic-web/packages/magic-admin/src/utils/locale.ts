import antdZhCN from "antd/es/locale/zh_CN"
import antdEnUS from "antd/es/locale/en_US"
import type { Locale } from "antd/es/locale"
import { LanguageType } from "@admin-components"

/**
 * 全局语言管理器
 */
class LanguageManager {
	private currentLanguage: LanguageType = LanguageType.zh_CN

	setLanguage(language: LanguageType) {
		this.currentLanguage = language
	}

	getLanguage(): LanguageType {
		return this.currentLanguage
	}

	getAntdLocale(): Locale {
		switch (this.currentLanguage) {
			case LanguageType.zh_CN:
				return antdZhCN
			case LanguageType.en_US:
				return antdEnUS
			default:
				return antdEnUS
		}
	}
}

// 导出单例
export const languageManager = new LanguageManager()
