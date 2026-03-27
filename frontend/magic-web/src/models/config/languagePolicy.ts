export interface LanguagePolicy {
	forcedLanguage: string | null
	isSwitchEnabled: boolean
}

const DEFAULT_LANGUAGE_POLICY: LanguagePolicy = {
	forcedLanguage: null,
	isSwitchEnabled: true,
}

export function getLanguagePolicy(): LanguagePolicy {
	return DEFAULT_LANGUAGE_POLICY
}

export function getForcedLanguage(): string | null {
	return getLanguagePolicy().forcedLanguage
}

export function isLanguageSwitchEnabled(): boolean {
	return getLanguagePolicy().isSwitchEnabled
}

export function resolveLanguageSelection(language: string): string {
	return getForcedLanguage() || language
}
