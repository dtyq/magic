import { BaseRequestUrl } from "@magic-admin-v2/api/constants/base"
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types"
import type {
	SlidesTemplate,
	SlidesTemplateCategory,
	SlidesTemplateCategoryQueryParams,
	SlidesTemplateCategorySaveParams,
	SlidesTemplateQueryParams,
	SlidesTemplateSaveParams,
	SlidesTemplateStatus,
	SlidesTemplateTag,
	SlidesTemplateTagQueryParams,
	SlidesTemplateTagSaveParams,
	WithPage,
} from "@magic-admin-v2/features/platform-slides-template/types"
import { buildApiUrl } from "@magic-admin-v2/api/api-url"

export function createPlatformSlidesTemplateApi(client: HttpClient) {
	return {
		query(params: SlidesTemplateQueryParams, options?: RequestOptions) {
			return client.post<WithPage<SlidesTemplate>>(
				BaseRequestUrl.slidesTemplateList,
				params,
				options,
			)
		},
		detail(id: string, options?: RequestOptions) {
			return client.get<SlidesTemplate>(
				buildApiUrl(BaseRequestUrl.slidesTemplateDetail, { id }),
				options,
			)
		},
		create(data: SlidesTemplateSaveParams, options?: RequestOptions) {
			return client.post<SlidesTemplate>(BaseRequestUrl.slidesTemplateCreate, data, options)
		},
		update(id: string, data: SlidesTemplateSaveParams, options?: RequestOptions) {
			return client.put<SlidesTemplate>(
				buildApiUrl(BaseRequestUrl.slidesTemplateDetail, { id }),
				data,
				options,
			)
		},
		updateStatus(id: string, status: SlidesTemplateStatus, options?: RequestOptions) {
			return client.put<null>(
				buildApiUrl(BaseRequestUrl.slidesTemplateStatus, { id }),
				{ status },
				options,
			)
		},
		updateSort(id: string, sort: number, options?: RequestOptions) {
			return client.put<null>(
				buildApiUrl(BaseRequestUrl.slidesTemplateSort, { id }),
				{ sort },
				options,
			)
		},
		updateTags(id: string, tagCodes: string[], options?: RequestOptions) {
			return client.put<SlidesTemplate>(
				buildApiUrl(BaseRequestUrl.slidesTemplateTags, { id }),
				{ tag_codes: tagCodes },
				options,
			)
		},
		delete(id: string, options?: RequestOptions) {
			return client.delete<null>(
				buildApiUrl(BaseRequestUrl.slidesTemplateDetail, { id }),
				undefined,
				options,
			)
		},
		category: {
			query(params: SlidesTemplateCategoryQueryParams, options?: RequestOptions) {
				return client.post<WithPage<SlidesTemplateCategory>>(
					BaseRequestUrl.slidesTemplateCategoryList,
					params,
					options,
				)
			},
			detail(id: string, options?: RequestOptions) {
				return client.get<SlidesTemplateCategory>(
					buildApiUrl(BaseRequestUrl.slidesTemplateCategoryDetail, { id }),
					options,
				)
			},
			create(data: SlidesTemplateCategorySaveParams, options?: RequestOptions) {
				return client.post<SlidesTemplateCategory>(
					BaseRequestUrl.slidesTemplateCategoryCreate,
					data,
					options,
				)
			},
			update(id: string, data: SlidesTemplateCategorySaveParams, options?: RequestOptions) {
				return client.put<SlidesTemplateCategory>(
					buildApiUrl(BaseRequestUrl.slidesTemplateCategoryDetail, { id }),
					data,
					options,
				)
			},
			updateStatus(id: string, status: SlidesTemplateStatus, options?: RequestOptions) {
				return client.put<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateCategoryStatus, { id }),
					{ status },
					options,
				)
			},
			updateSort(id: string, sort: number, options?: RequestOptions) {
				return client.put<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateCategorySort, { id }),
					{ sort },
					options,
				)
			},
			delete(id: string, options?: RequestOptions) {
				return client.delete<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateCategoryDetail, { id }),
					undefined,
					options,
				)
			},
		},
		tag: {
			tree(options?: RequestOptions) {
				return client.get<SlidesTemplateTag[]>(
					BaseRequestUrl.slidesTemplateTagTree,
					options,
				)
			},
			query(params: SlidesTemplateTagQueryParams, options?: RequestOptions) {
				return client.post<WithPage<SlidesTemplateTag>>(
					BaseRequestUrl.slidesTemplateTagList,
					params,
					options,
				)
			},
			detail(id: string, options?: RequestOptions) {
				return client.get<SlidesTemplateTag>(
					buildApiUrl(BaseRequestUrl.slidesTemplateTagDetail, { id }),
					options,
				)
			},
			create(data: SlidesTemplateTagSaveParams, options?: RequestOptions) {
				return client.post<SlidesTemplateTag>(
					BaseRequestUrl.slidesTemplateTagCreate,
					data,
					options,
				)
			},
			update(id: string, data: SlidesTemplateTagSaveParams, options?: RequestOptions) {
				return client.put<SlidesTemplateTag>(
					buildApiUrl(BaseRequestUrl.slidesTemplateTagDetail, { id }),
					data,
					options,
				)
			},
			updateStatus(id: string, status: SlidesTemplateStatus, options?: RequestOptions) {
				return client.put<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateTagStatus, { id }),
					{ status },
					options,
				)
			},
			updateSort(id: string, sort: number, options?: RequestOptions) {
				return client.put<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateTagSort, { id }),
					{ sort },
					options,
				)
			},
			delete(id: string, options?: RequestOptions) {
				return client.delete<null>(
					buildApiUrl(BaseRequestUrl.slidesTemplateTagDetail, { id }),
					undefined,
					options,
				)
			},
		},
	}
}
