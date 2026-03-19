import type { NativeLanguagePack } from "./types"

export interface LocalePort {
	getLanguages(): Promise<NativeLanguagePack>
	changeLanguage(languageKey: string): Promise<unknown>
}
