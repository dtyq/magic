import type { OptionItem, OptionItemTag } from "../types"

export const FEATURED_SLIDES_TEMPLATE_TAG_CODE = "featured"

export function getFeaturedSlidesTemplateTag(
	template: Pick<OptionItem, "tags">,
): OptionItemTag | undefined {
	return template.tags?.find((tag) => tag.code === FEATURED_SLIDES_TEMPLATE_TAG_CODE)
}

export function hasSlidesTemplateUsageCount(template: Pick<OptionItem, "usage_count">) {
	return typeof template.usage_count === "number" && template.usage_count > 0
}

export function getSlidesTemplateTagDisplayName(
	tag: OptionItemTag | undefined,
	locale: string | undefined,
	fallback: { zh_CN: string; en_US: string },
) {
	const name = tag?.name_i18n
	const directName = tag?.name
	const isEnglish = locale?.toLowerCase().startsWith("en")

	if (isEnglish) {
		return (
			directName || name?.en_US || name?.zh_CN || name?.default || tag?.code || fallback.en_US
		)
	}

	return directName || name?.zh_CN || name?.en_US || name?.default || tag?.code || fallback.zh_CN
}
