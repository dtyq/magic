import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
	SlidesTemplateCategorySaveParams,
	SlidesTemplateSaveParams,
	SlidesTemplateStatus,
	SlidesTemplateTagSaveParams,
} from "@magic-admin-v2/features/platform-slides-template/types"
import { platformSlidesTemplateKeys } from "@magic-admin-v2/features/platform-slides-template/queries"
import { useApis } from "@magic-admin-v2/runtime/context"

export function useSlidesTemplateMutations() {
	const { slidesTemplate } = useApis()
	const queryClient = useQueryClient()
	const invalidateAll = () =>
		queryClient.invalidateQueries({ queryKey: platformSlidesTemplateKeys.all })
	return {
		create: useMutation({
			mutationFn: (data: SlidesTemplateSaveParams) => slidesTemplate.create(data),
			onSuccess: invalidateAll,
		}),
		delete: useMutation({
			mutationFn: (id: string) => slidesTemplate.delete(id),
			onSuccess: invalidateAll,
		}),
		update: useMutation({
			mutationFn: ({ data, id }: { data: SlidesTemplateSaveParams; id: string }) =>
				slidesTemplate.update(id, data),
			onSuccess: invalidateAll,
		}),
		updateSort: useMutation({
			mutationFn: ({ id, sort }: { id: string; sort: number }) =>
				slidesTemplate.updateSort(id, sort),
			onSuccess: invalidateAll,
		}),
		updateStatus: useMutation({
			mutationFn: ({ id, status }: { id: string; status: SlidesTemplateStatus }) =>
				slidesTemplate.updateStatus(id, status),
			onSuccess: invalidateAll,
		}),
	}
}

export function useSlidesTemplateCategoryMutations() {
	const { slidesTemplate } = useApis()
	const queryClient = useQueryClient()
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: platformSlidesTemplateKeys.all })
	return {
		create: useMutation({
			mutationFn: (data: SlidesTemplateCategorySaveParams) =>
				slidesTemplate.category.create(data),
			onSuccess: invalidate,
		}),
		delete: useMutation({
			mutationFn: (id: string) => slidesTemplate.category.delete(id),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ data, id }: { data: SlidesTemplateCategorySaveParams; id: string }) =>
				slidesTemplate.category.update(id, data),
			onSuccess: invalidate,
		}),
		updateSort: useMutation({
			mutationFn: ({ id, sort }: { id: string; sort: number }) =>
				slidesTemplate.category.updateSort(id, sort),
			onSuccess: invalidate,
		}),
		updateStatus: useMutation({
			mutationFn: ({ id, status }: { id: string; status: SlidesTemplateStatus }) =>
				slidesTemplate.category.updateStatus(id, status),
			onSuccess: invalidate,
		}),
	}
}

export function useSlidesTemplateTagMutations() {
	const { slidesTemplate } = useApis()
	const queryClient = useQueryClient()
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: platformSlidesTemplateKeys.all })
	return {
		create: useMutation({
			mutationFn: (data: SlidesTemplateTagSaveParams) => slidesTemplate.tag.create(data),
			onSuccess: invalidate,
		}),
		delete: useMutation({
			mutationFn: (id: string) => slidesTemplate.tag.delete(id),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ data, id }: { data: SlidesTemplateTagSaveParams; id: string }) =>
				slidesTemplate.tag.update(id, data),
			onSuccess: invalidate,
		}),
		updateSort: useMutation({
			mutationFn: ({ id, sort }: { id: string; sort: number }) =>
				slidesTemplate.tag.updateSort(id, sort),
			onSuccess: invalidate,
		}),
		updateStatus: useMutation({
			mutationFn: ({ id, status }: { id: string; status: SlidesTemplateStatus }) =>
				slidesTemplate.tag.updateStatus(id, status),
			onSuccess: invalidate,
		}),
	}
}
