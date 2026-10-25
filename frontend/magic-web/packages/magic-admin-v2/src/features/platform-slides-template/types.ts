/** PPT 模板、分类和标签共用的后端状态值：0 停用，1 启用。 */
export const slidesTemplateStatus = {
	disabled: 0,
	enabled: 1,
} as const

export const slidesTemplateSourceType = {
	official: "OFFICIAL",
	system: "SYSTEM",
} as const

export type SlidesTemplateStatus = (typeof slidesTemplateStatus)[keyof typeof slidesTemplateStatus]
export type SlidesTemplateSourceType =
	(typeof slidesTemplateSourceType)[keyof typeof slidesTemplateSourceType]
export type SlidesTemplateTagMatch = "all" | "any"
/** 标签组仅用于管理和展示；模板只能绑定子标签。 */
export type SlidesTemplateTagNodeType = "group" | "tag"

export type SlidesTemplateLangText = {
	en_US: string
	zh_CN: string
}

export type WithPage<T> = {
	list: T[]
	total: number
}

export type SlidesTemplateCategory = {
	code: string
	created_at?: string
	id: string
	is_official: boolean
	name_i18n: SlidesTemplateLangText
	organization_code: string
	sort: number
	status: SlidesTemplateStatus
	template_count: number
	updated_at?: string
}

export type SlidesTemplateTag = {
	children?: SlidesTemplateTag[]
	code: string
	created_at?: string
	description_i18n?: SlidesTemplateLangText
	id: string
	is_official: boolean
	name_i18n: SlidesTemplateLangText
	node_type: SlidesTemplateTagNodeType
	organization_code: string
	parent_id: string | number
	sort: number
	status: SlidesTemplateStatus
	template_count: number
	updated_at?: string
}

export type SlidesTemplate = {
	category?: SlidesTemplateCategory | null
	category_code?: string | null
	code: string
	collage_file_key?: string | null
	collage_url?: string | null
	created_at?: string
	description: SlidesTemplateLangText
	id: string
	label: SlidesTemplateLangText
	organization_code: string
	preview_image_file_keys?: string[]
	preview_image_urls?: string[]
	preview_url?: string | null
	sort: number
	source_type?: SlidesTemplateSourceType
	status: SlidesTemplateStatus
	tags?: SlidesTemplateTag[]
	template_file_key: string
	template_file_url?: string | null
	thumbnail_file_key: string
	thumbnail_url?: string | null
	updated_at?: string
	usage_count?: number
}

export type SlidesTemplateQueryParams = {
	category_code?: string
	code?: string
	keyword?: string
	page: number
	page_size: number
	status?: SlidesTemplateStatus | null
	tag_codes?: string[]
	tag_match?: SlidesTemplateTagMatch
}

export type SlidesTemplateSaveParams = {
	category_code?: string | null
	code?: string
	collage_file_key?: string | null
	description: SlidesTemplateLangText
	label: SlidesTemplateLangText
	preview_image_file_keys?: string[]
	preview_url?: string | null
	sort?: number
	status?: SlidesTemplateStatus
	tag_codes?: string[]
	template_file_key: string
	thumbnail_file_key: string
}

export type SlidesTemplateCategoryQueryParams = {
	code?: string
	keyword?: string
	page: number
	page_size: number
	status?: SlidesTemplateStatus | null
}

export type SlidesTemplateCategorySaveParams = {
	name_i18n: SlidesTemplateLangText
	sort?: number
	status?: SlidesTemplateStatus
}

export type SlidesTemplateTagQueryParams = {
	code?: string
	keyword?: string
	node_type?: SlidesTemplateTagNodeType
	page: number
	page_size: number
	parent_id?: string | number
	status?: SlidesTemplateStatus | null
}

export type SlidesTemplateTagSaveParams = {
	code: string
	description_i18n?: SlidesTemplateLangText
	name_i18n: SlidesTemplateLangText
	node_type: SlidesTemplateTagNodeType
	parent_id: string | number
	sort?: number
	status?: SlidesTemplateStatus
}

export type SlidesTemplateFormValues = {
	category_code: string
	code: string
	collage_file_key: string
	collage_url: string
	description_en: string
	description_zh: string
	label_en: string
	label_zh: string
	preview_image_file_keys: string[]
	preview_image_urls: string[]
	preview_url: string
	sort: number
	status: boolean
	tag_codes: string[]
	template_file_key: string
	thumbnail_file_key: string
	thumbnail_url: string
}

export type SlidesTemplateCategoryFormValues = {
	name_en: string
	name_zh: string
	sort: number
	status: boolean
}

export type SlidesTemplateTagFormValues = {
	code: string
	description_en: string
	description_zh: string
	name_en: string
	name_zh: string
	node_type: SlidesTemplateTagNodeType
	parent_id: string
	sort: number
	status: boolean
}
