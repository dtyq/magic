export const Language = {
  ZhCN: "zh_CN",
  EnUS: "en_US",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const IntlLocale = {
  ZhCN: "zh-CN",
  EnUS: "en-US",
} as const;

export const supportedLanguages = [Language.ZhCN, Language.EnUS] as const;
export const defaultLanguage: Language = Language.ZhCN;
export const languageStorageKey = "magic_admin_language";

export const languageOptions: Array<{
  value: Language;
  labelKey: string;
}> = [
  { value: Language.ZhCN, labelKey: "language.zhCN" },
  { value: Language.EnUS, labelKey: "language.enUS" },
];

export function isSupportedLanguage(value: string | null): value is Language {
  return supportedLanguages.some((language) => language === value);
}

export function normalizeLanguage(language: string): Language {
  // Accept browser-style locale values from old standalone storage while
  // keeping the host-compatible underscore values as the canonical format.
  if (language === IntlLocale.ZhCN) return Language.ZhCN;
  if (language === IntlLocale.EnUS) return Language.EnUS;
  return isSupportedLanguage(language) ? language : defaultLanguage;
}

export function toIntlLocale(language: Language) {
  return language === Language.EnUS ? IntlLocale.EnUS : IntlLocale.ZhCN;
}
