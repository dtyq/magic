import { useQuery } from "@tanstack/react-query"
import type {
	SlidesTemplateCategoryQueryParams,
	SlidesTemplateQueryParams,
	SlidesTemplateTagQueryParams,
} from "@magic-admin-v2/features/platform-slides-template/types"
import { useApis } from "@magic-admin-v2/runtime/context"

export const platformSlidesTemplateKeys = {
	all: ["platform-slides-template"] as const,
	categories: (params?: SlidesTemplateCategoryQueryParams) =>
		[...platformSlidesTemplateKeys.all, "categories", params] as const,
	categoryDetail: (id: string) =>
		[...platformSlidesTemplateKeys.all, "category-detail", id] as const,
	detail: (id: string) => [...platformSlidesTemplateKeys.all, "detail", id] as const,
	list: (params: SlidesTemplateQueryParams) =>
		[...platformSlidesTemplateKeys.all, "list", params] as const,
	tags: (params?: SlidesTemplateTagQueryParams) =>
		[...platformSlidesTemplateKeys.all, "tags", params] as const,
	tagDetail: (id: string) => [...platformSlidesTemplateKeys.all, "tag-detail", id] as const,
	tagTree: () => [...platformSlidesTemplateKeys.all, "tag-tree"] as const,
}

export function useSlidesTemplateListQuery(params: SlidesTemplateQueryParams) {
	const { slidesTemplate } = useApis()
	return useQuery({
		queryFn: ({ signal }) => slidesTemplate.query(params, { signal }),
		queryKey: platformSlidesTemplateKeys.list(params),
	})
}

export function useSlidesTemplateDetailQuery(id: string | null) {
	const { slidesTemplate } = useApis()
	return useQuery({
		enabled: Boolean(id),
		queryFn: ({ signal }) => slidesTemplate.detail(id!, { signal }),
		queryKey: platformSlidesTemplateKeys.detail(id ?? ""),
	})
}

export function useSlidesTemplateCategoriesQuery(
	params: SlidesTemplateCategoryQueryParams,
	enabled = true,
) {
	const { slidesTemplate } = useApis()
	return useQuery({
		enabled,
		queryFn: ({ signal }) => slidesTemplate.category.query(params, { signal }),
		queryKey: platformSlidesTemplateKeys.categories(params),
	})
}

export function useSlidesTemplateTagTreeQuery(enabled = true) {
	const { slidesTemplate } = useApis()
	return useQuery({
		enabled,
		queryFn: ({ signal }) => slidesTemplate.tag.tree({ signal }),
		queryKey: platformSlidesTemplateKeys.tagTree(),
	})
}

export function useSlidesTemplateTagsQuery(params: SlidesTemplateTagQueryParams, enabled = true) {
	const { slidesTemplate } = useApis()
	return useQuery({
		enabled,
		queryFn: ({ signal }) => slidesTemplate.tag.query(params, { signal }),
		queryKey: platformSlidesTemplateKeys.tags(params),
	})
}
