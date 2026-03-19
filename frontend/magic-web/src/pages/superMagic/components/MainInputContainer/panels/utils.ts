import i18n from "i18next"
import {
	DEFAULT_LOCALE_KEY,
	OptionViewType,
	type FieldItem,
	type LocaleText,
	type OptionGroup,
	type OptionItem,
} from "./types"

function isNonEmptyLocaleValue(value: string | undefined): value is string {
	return typeof value === "string" && value.length > 0
}

/**
 * Resolve LocaleText to a plain string for the current locale.
 * Falls back in order: exact locale -> base language -> default -> "en_US" -> first available
 */
export function resolveLocaleText(
	text: LocaleText | undefined,
	locale: string,
): string | undefined {
	if (text == null) return undefined
	if (typeof text === "string") return text

	// exact match: "zh_CN"
	if (isNonEmptyLocaleValue(text[locale])) return text[locale]

	// base language match: "zh_CN" -> "zh"
	const baseLang = locale.split(/[-_]/)[0]
	const baseMatch = Object.keys(text).find(
		(key) => key.startsWith(baseLang) && isNonEmptyLocaleValue(text[key]),
	)
	if (baseMatch) return text[baseMatch]

	// fallback to default, then "en_US", then first available
	if (isNonEmptyLocaleValue(text[DEFAULT_LOCALE_KEY])) return text[DEFAULT_LOCALE_KEY]
	if (isNonEmptyLocaleValue(text["en_US"])) return text["en_US"]
	return Object.values(text).find((value) => isNonEmptyLocaleValue(value))
}

/**
 * Check if option is OptionGroup
 */
export function isOptionGroup(option: OptionGroup | OptionItem): option is OptionGroup {
	return "group_key" in option && "children" in option
}

/**
 * Check if FieldItem is a complex field (has option_view_type)
 */
export function isComplexField(field: FieldItem): boolean {
	return field.option_view_type === OptionViewType.GRID
}

/**
 * Find the complex field in field_items array
 */
export function findComplexField(fields: FieldItem[]): FieldItem | undefined {
	return fields.find(isComplexField)
}

/**
 * Resolve LocaleText to display string. Handles string or locale map.
 */
export function localeTextToDisplayString(value: LocaleText | undefined): string {
	if (value == null) return ""
	if (typeof value === "string") return value
	return (
		value[DEFAULT_LOCALE_KEY] ??
		value["en_US"] ??
		Object.values(value).find((v) => typeof v === "string" && v.length > 0) ??
		""
	)
}

/** @internal used by buildConcatenatedPresetContent */
function valueToDisplayString(value: LocaleText | undefined): string {
	return localeTextToDisplayString(value)
}

function getOptionValue(option: OptionItem): string {
	return localeTextToDisplayString(option.value)
}

/** Flatten OptionGroup children and flat OptionItems into a single OptionItem array */
function flattenFieldOptions(field: FieldItem): OptionItem[] {
	const groups = field.options.filter(isOptionGroup) as OptionGroup[]
	return groups.length
		? groups.flatMap((g) => g.children ?? [])
		: (field.options.filter((o) => !isOptionGroup(o)) as OptionItem[])
}

function getSelectedOptionLabel(field: FieldItem, locale: string): string {
	const currentVal = field.current_value
	if (currentVal == null || currentVal === "") return ""

	const flat = flattenFieldOptions(field)
	const selected = flat.find((opt) => getOptionValue(opt) === currentVal)
	if (!selected) return ""

	const label = resolveLocaleText(field.label, locale)?.trim()
	const value = resolveLocaleText(selected.value, locale)?.trim() ?? ""

	if (!label) return value
	if (!value) return label

	return `${label}: ${value}`
}

/**
 * Build concatenated preset content from field items.
 * - Per field with preset_content: replaces {preset_value} with current_value.
 * - Per field without preset_content: uses selected option label.
 * - All picked field parts are joined with locale comma and closed with locale period.
 */
export function buildConcatenatedPresetContent(
	fields: FieldItem[],
	locale = i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE_KEY,
): string {
	const isZh = /^zh(-|_)?/i.test(locale)
	const comma = isZh ? "，" : ", "
	const period = isZh ? "。" : "."
	const parts: string[] = []

	for (const item of fields) {
		const template = resolveLocaleText(item.preset_content, locale) ?? ""
		if (template.trim()) {
			const currentVal = item.current_value
			if (currentVal == null || currentVal === "") continue

			const displayVal =
				typeof currentVal === "string"
					? currentVal
					: currentVal != null
						? valueToDisplayString(currentVal as LocaleText)
						: ""
			if (!displayVal.trim()) continue

			parts.push(template.replace(/\{preset_value\}/g, displayVal).trim())
			continue
		}

		const label = getSelectedOptionLabel(item, locale).trim()
		if (label) {
			parts.push(label)
		}
	}

	const result = parts.join(comma).trim()
	return result ? `${result}${period}` : ""
}
