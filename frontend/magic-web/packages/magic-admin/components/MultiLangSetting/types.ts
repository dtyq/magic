import type { LanguageType } from "../AdminComponentsProvider"

export interface Lang {
	[LanguageType.zh_CN]?: string
	[LanguageType.en_US]?: string
}
