import type { LanguageType } from "../AdminComponentsProvider"

export interface Lang {
	[LanguageType.zh_CN]?: string
	[LanguageType.en_US]?: string
	[LanguageType.vi_VN]?: string
	[LanguageType.th_TH]?: string
	[LanguageType.ms_MY]?: string
}
