import type { ApiError } from "@magic-admin-v2/api/types"
import {
	slidesTemplateSourceType,
	slidesTemplateStatus,
	type SlidesTemplate,
	type SlidesTemplateCategory,
	type SlidesTemplateCategoryFormValues,
	type SlidesTemplateCategoryQueryParams,
	type SlidesTemplateCategorySaveParams,
	type SlidesTemplateFormValues,
	type SlidesTemplateSaveParams,
	type SlidesTemplateTag,
	type SlidesTemplateTagFormValues,
	type SlidesTemplateTagQueryParams,
	type SlidesTemplateTagSaveParams,
} from "@magic-admin-v2/features/platform-slides-template/types"

export const FEATURED_SLIDES_TEMPLATE_TAG_CODE = "featured"
export const SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE = "operational_group"
export const SLIDES_TEMPLATE_TAG_CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const SLIDES_TEMPLATE_TAG_GROUP_CODE_PATTERN = /^[a-z0-9]+([_-][a-z0-9]+)*_group$/
export const SLIDES_TEMPLATE_FIELD_LIMITS = {
	code: 64,
	description: 1000,
	name: 100,
	previewUrl: 1024,
} as const
export const ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY = {
	page: 1,
	page_size: 200,
	status: slidesTemplateStatus.enabled,
} satisfies SlidesTemplateCategoryQueryParams
export const ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY = {
	node_type: "tag",
	page: 1,
	page_size: 200,
	status: slidesTemplateStatus.enabled,
} satisfies SlidesTemplateTagQueryParams
const codeAlphabet = [
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	"abcdefghijklmnopqrstuvwxyz",
	"0123456789",
].join("")

export function generateSlidesTemplateCode() {
	const segment = Array.from({ length: 12 }, () =>
		codeAlphabet.charAt(Math.floor(Math.random() * codeAlphabet.length)),
	).join("")
	return `PPT-${segment}`
}

export function resolveSlidesTemplateTitle(record: SlidesTemplate) {
	return record.label?.zh_CN || record.label?.en_US || record.code
}

export function resolveSlidesTemplateCategoryName(record?: SlidesTemplateCategory | null) {
	return record?.name_i18n?.zh_CN || record?.name_i18n?.en_US || record?.code || "-"
}

export function resolveSlidesTemplateTagName(record: SlidesTemplateTag) {
	return record.name_i18n?.zh_CN || record.name_i18n?.en_US || record.code
}

export function flattenSlidesTemplateTags(nodes: SlidesTemplateTag[]): SlidesTemplateTag[] {
	return nodes.flatMap((node) => [node, ...flattenSlidesTemplateTags(node.children ?? [])])
}

export function isSystemSlidesTemplate(record: Pick<SlidesTemplate, "source_type">) {
	return record.source_type === slidesTemplateSourceType.system
}

export function isSystemSlidesTemplateTagGroup(
	record: Pick<SlidesTemplateTag, "code" | "node_type">,
) {
	return record.node_type === "group" && record.code === SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE
}

export function toStatus(checked: boolean) {
	return checked ? slidesTemplateStatus.enabled : slidesTemplateStatus.disabled
}

export function buildSlidesTemplateSaveParams(
	values: SlidesTemplateFormValues,
	includeCode: boolean,
): SlidesTemplateSaveParams {
	return {
		...(includeCode ? { code: values.code } : {}),
		category_code: values.category_code || null,
		collage_file_key: values.collage_file_key || null,
		description: { en_US: values.description_en.trim(), zh_CN: values.description_zh.trim() },
		label: { en_US: values.label_en.trim(), zh_CN: values.label_zh.trim() },
		preview_image_file_keys: values.preview_image_file_keys,
		preview_url: values.preview_url.trim() || null,
		sort: values.sort,
		status: toStatus(values.status),
		tag_codes: values.tag_codes,
		template_file_key: values.template_file_key,
		thumbnail_file_key: values.thumbnail_file_key,
	}
}

export function buildCategorySaveParams(
	values: SlidesTemplateCategoryFormValues,
): SlidesTemplateCategorySaveParams {
	return {
		name_i18n: { en_US: values.name_en.trim(), zh_CN: values.name_zh.trim() },
		sort: values.sort,
		status: toStatus(values.status),
	}
}

export function buildTagSaveParams(
	values: SlidesTemplateTagFormValues,
): SlidesTemplateTagSaveParams {
	return {
		code: values.code.trim(),
		description_i18n: {
			en_US: values.description_en.trim(),
			zh_CN: values.description_zh.trim(),
		},
		name_i18n: { en_US: values.name_en.trim(), zh_CN: values.name_zh.trim() },
		node_type: values.node_type,
		parent_id: values.node_type === "group" ? 0 : values.parent_id,
		sort: values.sort,
		status: toStatus(values.status),
	}
}

export function setTagEnabled(codes: string[], code: string, enabled: boolean) {
	const values = new Set(codes)
	if (enabled) values.add(code)
	else values.delete(code)
	return [...values]
}

export function formatDateTime(value: string | undefined, locale: string) {
	if (!value) return "-"
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date)
}

export function joinUploadDirectory(code: string, previews = false) {
	return `slide-templates/${code}/${previews ? "previews/" : ""}`
}

export function isCodeConflictError(error: unknown) {
	const candidate = error as ApiError | undefined
	const value = `${candidate?.code ?? ""} ${candidate?.message ?? ""}`.toLowerCase()
	return value.includes("code") && (value.includes("exist") || value.includes("duplicate"))
}
