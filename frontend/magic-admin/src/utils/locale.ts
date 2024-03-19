import antdZhCN from "antd/es/locale/zh_CN"
import antdEnUS from "antd/es/locale/en_US"
import antdRuRU from "antd/es/locale/ru_RU"
import antdKkKZ from "antd/es/locale/kk_KZ"
import antdIdID from "antd/es/locale/id_ID"
import antdJaJP from "antd/es/locale/ja_JP"
import antdMsMY from "antd/es/locale/ms_MY"
import antdThTH from "antd/es/locale/th_TH"
import antdViVN from "antd/es/locale/vi_VN"
import antdFrFR from "antd/es/locale/fr_FR"
import type { Locale } from "antd/es/locale"
import { LanguageType } from "components"

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
			case LanguageType.ru_RU:
				return antdRuRU
			case LanguageType.kk_KZ:
				return antdKkKZ
			case LanguageType.id_ID:
				return antdIdID
			case LanguageType.ja_JP:
				return antdJaJP
			case LanguageType.ms_MY:
				return antdMsMY
			case LanguageType.th_TH:
				return antdThTH
			case LanguageType.vi_VN:
				return antdViVN
			case LanguageType.fr_FR:
				return antdFrFR
			default:
				return antdEnUS
		}
	}
}

// 导出单例
export const languageManager = new LanguageManager()
