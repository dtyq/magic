import type {
	SlidesTemplateCategoryQueryParams,
	SlidesTemplateQueryParams,
	SlidesTemplateTagQueryParams,
	SlidesTemplateStatus,
} from "@magic-admin-v2/features/platform-slides-template/types"

export const emptySlidesTemplateStatus = "all"

export type TemplateLibraryFilterDraft = {
	category: string
	code: string
	keyword: string
	status: string
	tagCodes: string[]
	tagMatch: "any" | "all"
}

export function createDefaultTemplateLibraryDraft(): TemplateLibraryFilterDraft {
	return {
		category: "",
		code: "",
		keyword: "",
		status: emptySlidesTemplateStatus,
		tagCodes: [],
		tagMatch: "any",
	}
}

export function toTemplateLibraryParams(
	draft: TemplateLibraryFilterDraft,
	page: number,
	pageSize: number,
): SlidesTemplateQueryParams {
	return {
		page,
		page_size: pageSize,
		keyword: draft.keyword || undefined,
		code: draft.code || undefined,
		category_code: draft.category || undefined,
		tag_codes: draft.tagCodes.length ? draft.tagCodes : undefined,
		tag_match: draft.tagCodes.length ? draft.tagMatch : undefined,
		status:
			draft.status === emptySlidesTemplateStatus
				? null
				: (Number(draft.status) as SlidesTemplateStatus),
	}
}

export type CategoryFilterDraft = {
	code: string
	keyword: string
	status: string
}

export function createDefaultCategoryFilterDraft(): CategoryFilterDraft {
	return { code: "", keyword: "", status: emptySlidesTemplateStatus }
}

export function toCategoryListParams(
	draft: CategoryFilterDraft,
	page: number,
	pageSize: number,
): SlidesTemplateCategoryQueryParams {
	return {
		page,
		page_size: pageSize,
		code: draft.code || undefined,
		keyword: draft.keyword || undefined,
		status:
			draft.status === emptySlidesTemplateStatus
				? null
				: (Number(draft.status) as SlidesTemplateStatus),
	}
}

export type TagFilterDraft = {
	code: string
	keyword: string
	status: string
}

export function createDefaultTagFilterDraft(): TagFilterDraft {
	return { code: "", keyword: "", status: emptySlidesTemplateStatus }
}

export function toTagListParams(
	draft: TagFilterDraft,
	page: number,
	pageSize: number,
	selectedGroupId: string | null,
): SlidesTemplateTagQueryParams {
	return {
		page,
		page_size: pageSize,
		node_type: "tag",
		...(selectedGroupId ? { parent_id: selectedGroupId } : {}),
		code: draft.code || undefined,
		keyword: draft.keyword || undefined,
		status:
			draft.status === emptySlidesTemplateStatus
				? null
				: (Number(draft.status) as SlidesTemplateStatus),
	}
}

export function countActiveTemplateLibraryFilters(filters: TemplateLibraryFilterDraft) {
	return [
		filters.category,
		filters.code,
		filters.keyword,
		filters.status !== emptySlidesTemplateStatus ? filters.status : "",
		filters.tagCodes.length > 0 ? "tags" : "",
	].filter((value) => value.trim().length > 0).length
}

export function countActiveCategoryFilters(filters: CategoryFilterDraft) {
	return [
		filters.code,
		filters.keyword,
		filters.status !== emptySlidesTemplateStatus ? filters.status : "",
	].filter((value) => value.trim().length > 0).length
}

export function countActiveTagFilters(filters: TagFilterDraft) {
	return [
		filters.code,
		filters.keyword,
		filters.status !== emptySlidesTemplateStatus ? filters.status : "",
	].filter((value) => value.trim().length > 0).length
}
