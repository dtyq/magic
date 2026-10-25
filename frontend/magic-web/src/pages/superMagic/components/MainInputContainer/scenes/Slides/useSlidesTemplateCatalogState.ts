import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SuperMagicApi } from "@/apis"
import {
	ALL_SLIDES_TEMPLATE_GROUP_KEY,
	SLIDES_TEMPLATE_CATEGORY_GROUP_KEY_PREFIX,
	SLIDES_TEMPLATE_CATEGORY_PAGE_SIZE,
	SLIDES_TEMPLATE_IMAGE_PROCESS,
	SLIDES_TEMPLATE_PAGE_SIZE,
	SLIDES_TEMPLATE_TAG_GROUP_KEY_PREFIX,
	SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE,
	getSlidesTemplateCategoryCodeFromGroupKey,
	getSlidesTemplateTagCodeFromGroupKey,
	groupSlidesTemplates,
	toTemplateOption,
	type SlidesTemplateCategoryItem,
	type SlidesTemplateDetail,
	type SlidesTemplateItem,
	type SlidesTemplateTagGroupItem,
	type SlidesTemplateTagItem,
} from "./slidesTemplateState"
import { FEATURED_SLIDES_TEMPLATE_TAG_CODE } from "../../panels/slides-preset/templateMeta"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { getShareAccessToken } from "@/pages/superMagic/fileAccess/fileAccessContext"

const SEARCH_DEBOUNCE_MS = 300

interface UseSlidesTemplateCatalogStateOptions {
	pageSize?: number
}

function mergeTemplates(
	currentTemplates: SlidesTemplateItem[],
	nextTemplates: SlidesTemplateItem[],
) {
	const templateMap = new Map(currentTemplates.map((template) => [template.code, template]))
	nextTemplates.forEach((template) => {
		templateMap.set(template.code, template)
	})
	return Array.from(templateMap.values())
}

function getAppendedTemplateCount(
	currentTemplates: SlidesTemplateItem[],
	nextTemplates: SlidesTemplateItem[],
) {
	const currentTemplateCodes = new Set(currentTemplates.map((template) => template.code))
	let appendedTemplateCount = 0

	for (const template of nextTemplates) {
		if (currentTemplateCodes.has(template.code)) continue
		currentTemplateCodes.add(template.code)
		appendedTemplateCount += 1
	}

	return appendedTemplateCount
}

function isServerBackedGroupKey(groupKey: string) {
	return (
		groupKey === ALL_SLIDES_TEMPLATE_GROUP_KEY ||
		groupKey.startsWith(SLIDES_TEMPLATE_CATEGORY_GROUP_KEY_PREFIX) ||
		groupKey.startsWith(SLIDES_TEMPLATE_TAG_GROUP_KEY_PREFIX)
	)
}

export function useSlidesTemplateCatalogState({
	pageSize = SLIDES_TEMPLATE_PAGE_SIZE,
}: UseSlidesTemplateCatalogStateOptions = {}) {
	// Share previews inject their rotating temporary token through FileAccessProvider.
	const fileAccess = useFileAccess()
	const temporaryToken = getShareAccessToken(fileAccess)
	const [templates, setTemplates] = useState<SlidesTemplateItem[]>([])
	const [categories, setCategories] = useState<SlidesTemplateCategoryItem[]>([])
	const [operationalTags, setOperationalTags] = useState<SlidesTemplateTagItem[]>([])
	const [allTagGroups, setAllTagGroups] = useState<SlidesTemplateTagGroupItem[]>([])
	const [categoryTagGroups, setCategoryTagGroups] = useState<SlidesTemplateTagGroupItem[]>([])
	const [categoryTagGroupsCode, setCategoryTagGroupsCode] = useState<string | null>(null)
	const [categoryLoadFailed, setCategoryLoadFailed] = useState(false)
	const [isCategoryLoading, setIsCategoryLoading] = useState(true)
	const [isAllTagGroupsLoading, setIsAllTagGroupsLoading] = useState(true)
	const [isCategoryTagGroupsLoading, setIsCategoryTagGroupsLoading] = useState(false)
	const [selectedGroupKey, setSelectedPrimaryGroupKey] = useState(ALL_SLIDES_TEMPLATE_GROUP_KEY)
	const [selectedChildTagCodes, setSelectedChildTagCodes] = useState<string[]>([])
	const [keyword, setKeyword] = useState("")
	const [debouncedKeyword, setDebouncedKeyword] = useState("")
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(false)
	const [total, setTotal] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [isLoadMoreFailed, setIsLoadMoreFailed] = useState(false)
	const [isRefreshFailed, setIsRefreshFailed] = useState(false)
	const [templateViewRevision, setTemplateViewRevision] = useState(0)
	const [hasCheckedAnyTemplate, setHasCheckedAnyTemplate] = useState(false)
	const [hasAnyTemplate, setHasAnyTemplate] = useState(true)
	const requestSeqRef = useRef(0)
	const mountedRef = useRef(true)
	const templatesRef = useRef<SlidesTemplateItem[]>([])
	const hasLoadedTemplatesRef = useRef(false)
	const appendRequestInFlightRef = useRef(false)
	const totalRef = useRef(0)
	const templateRequestKeyRef = useRef<string | null>(null)
	const templateOptionCacheRef = useRef(
		new Map<
			string,
			{ source: SlidesTemplateItem; option: ReturnType<typeof toTemplateOption> }
		>(),
	)
	const templateDetailCacheRef = useRef(new Map<string, ReturnType<typeof toTemplateOption>>())
	const templateDetailRequestCacheRef = useRef(
		new Map<string, Promise<ReturnType<typeof toTemplateOption> | null>>(),
	)

	useEffect(() => {
		mountedRef.current = true

		return () => {
			mountedRef.current = false
		}
	}, [])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedKeyword(keyword.trim())
		}, SEARCH_DEBOUNCE_MS)

		return () => window.clearTimeout(timer)
	}, [keyword])

	useEffect(() => {
		let cancelled = false

		const categoryParams = {
			page: 1,
			page_size: SLIDES_TEMPLATE_CATEGORY_PAGE_SIZE,
		}
		const categoriesRequest = temporaryToken
			? SuperMagicApi.getSlidesTemplateCategories(categoryParams, { temporaryToken })
			: SuperMagicApi.getSlidesTemplateCategories(categoryParams)
		categoriesRequest
			.then((response) => {
				if (cancelled) return
				setCategories(response.list ?? [])
				setCategoryLoadFailed(false)
			})
			.catch((error) => {
				if (cancelled) return
				console.error("Failed to fetch slides template categories", error)
				setCategories([])
				setCategoryLoadFailed(true)
			})
			.finally(() => {
				if (cancelled) return
				setIsCategoryLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [temporaryToken])

	const categoryCodeSet = useMemo(
		() => new Set(categories.map((category) => category.code)),
		[categories],
	)
	const selectedCategoryGroupCode = getSlidesTemplateCategoryCodeFromGroupKey(selectedGroupKey)
	const selectedCategoryCode =
		selectedCategoryGroupCode && categoryCodeSet.has(selectedCategoryGroupCode)
			? selectedCategoryGroupCode
			: undefined

	useEffect(() => {
		let cancelled = false

		// 顶部一级筛选项只读取系统内置的运营标签组。
		const tagGroupsRequest = temporaryToken
			? SuperMagicApi.getSlidesTemplateTagGroups({}, { temporaryToken })
			: SuperMagicApi.getSlidesTemplateTagGroups({})
		tagGroupsRequest
			.then((response) => {
				if (cancelled) return
				setAllTagGroups(response ?? [])
				setOperationalTags(
					response?.find((group) => group.code === SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE)
						?.tags ?? [],
				)
			})
			.catch((error) => {
				if (cancelled) return
				console.error("Failed to fetch operational slides template tags", error)
				setOperationalTags([])
			})
			.finally(() => {
				if (cancelled) return
				setIsAllTagGroupsLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [temporaryToken])

	useEffect(() => {
		if (!selectedCategoryCode) {
			setCategoryTagGroups([])
			setCategoryTagGroupsCode(null)
			setIsCategoryTagGroupsLoading(false)
			return
		}

		let cancelled = false
		setIsCategoryTagGroupsLoading(true)

		const tagGroupsRequest = temporaryToken
			? SuperMagicApi.getSlidesTemplateTagGroups(
					{ category_code: selectedCategoryCode },
					{ temporaryToken },
				)
			: SuperMagicApi.getSlidesTemplateTagGroups({ category_code: selectedCategoryCode })
		tagGroupsRequest
			.then((response) => {
				if (cancelled) return
				setCategoryTagGroups(response ?? [])
			})
			.catch((error) => {
				if (cancelled) return
				console.error("Failed to fetch category slides template tags", error)
				setCategoryTagGroups([])
			})
			.finally(() => {
				if (cancelled) return
				setCategoryTagGroupsCode(selectedCategoryCode)
				setIsCategoryTagGroupsLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [selectedCategoryCode, temporaryToken])

	const tagGroups = selectedCategoryCode ? categoryTagGroups : allTagGroups

	const filterTags = useMemo<SlidesTemplateTagItem[]>(
		() => tagGroups.flatMap((group) => group.tags),
		[tagGroups],
	)
	const filterTagCodeSet = useMemo(() => new Set(filterTags.map((tag) => tag.code)), [filterTags])
	const operationalTagCodeSet = useMemo(
		() => new Set(operationalTags.map((tag) => tag.code)),
		[operationalTags],
	)
	const selectedTagGroupCode = getSlidesTemplateTagCodeFromGroupKey(selectedGroupKey)
	const selectedOperationalTagCode =
		selectedTagGroupCode && operationalTagCodeSet.has(selectedTagGroupCode)
			? selectedTagGroupCode
			: undefined
	const selectedTagCodes = useMemo(() => {
		const canUseChildTagFilters =
			Boolean(selectedCategoryCode) ||
			selectedGroupKey === ALL_SLIDES_TEMPLATE_GROUP_KEY ||
			Boolean(selectedOperationalTagCode)
		if (!canUseChildTagFilters) return []

		return Array.from(
			new Set([
				...(selectedOperationalTagCode ? [selectedOperationalTagCode] : []),
				...selectedChildTagCodes,
			]),
		)
	}, [selectedCategoryCode, selectedChildTagCodes, selectedGroupKey, selectedOperationalTagCode])
	useEffect(() => {
		setSelectedChildTagCodes((currentTagCodes) => {
			const validTagCodes = currentTagCodes.filter((tagCode) => filterTagCodeSet.has(tagCode))
			return validTagCodes.length === currentTagCodes.length ? currentTagCodes : validTagCodes
		})
	}, [filterTagCodeSet])

	const setSelectedGroupKey = useCallback((groupKey: string) => {
		setSelectedPrimaryGroupKey(groupKey)
		setSelectedChildTagCodes([])
		if (!isServerBackedGroupKey(groupKey)) {
			setTemplateViewRevision((revision) => revision + 1)
		}
	}, [])

	const fetchTemplates = useCallback(
		async (nextPage: number, mode: "replace" | "append") => {
			if (mode === "append" && appendRequestInFlightRef.current) return

			const isAllTemplatesQuery =
				!debouncedKeyword && !selectedCategoryCode && selectedTagCodes.length === 0
			const requestKey = JSON.stringify([
				mode,
				nextPage,
				pageSize,
				debouncedKeyword,
				selectedCategoryCode ?? "",
				selectedTagCodes,
			])
			// StrictMode 会重新执行首屏 effect。相同查询仍在进行时复用它，避免重复请求。
			if (templateRequestKeyRef.current === requestKey) return
			templateRequestKeyRef.current = requestKey
			const requestSeq = ++requestSeqRef.current
			if (mode === "replace") {
				appendRequestInFlightRef.current = false
				setIsRefreshFailed(false)
				setPage(1)
				setIsLoadingMore(false)
				setIsLoadMoreFailed(false)
				if (hasLoadedTemplatesRef.current) {
					setIsRefreshing(true)
				} else {
					setIsLoading(true)
				}
			} else {
				appendRequestInFlightRef.current = true
				setIsLoadingMore(true)
				setIsLoadMoreFailed(false)
			}

			const queryParams = {
				scope: "official" as const,
				page: nextPage,
				page_size: pageSize,
				...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
				...(selectedCategoryCode ? { category_code: selectedCategoryCode } : {}),
				...(selectedTagCodes.length > 0
					? {
							tag_codes: selectedTagCodes,
							tag_match: "any" as const,
						}
					: {}),
			}

			try {
				const templatesRequest = SuperMagicApi.getSlidesTemplates(queryParams, {
					xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS,
					...(temporaryToken ? { temporaryToken } : {}),
				})
				const countRequest =
					mode === "replace"
						? Promise.resolve(
								temporaryToken
									? SuperMagicApi.getSlidesTemplateCount(queryParams, {
											temporaryToken,
										})
									: SuperMagicApi.getSlidesTemplateCount(queryParams),
							).catch((error) => {
								console.error("Failed to fetch slides template count", error)
								return null
							})
						: null
				const response = await templatesRequest
				if (!mountedRef.current || requestSeq !== requestSeqRef.current) return

				const nextTemplates = response.list ?? []
				// 仅用于灰度期间保留旧响应的分页行为；正式接口不再返回 total。
				const legacyTotal = (response as { total?: number }).total
				if (mode === "replace") {
					const fallbackTotal = legacyTotal ?? totalRef.current
					totalRef.current = fallbackTotal
					setTotal(fallbackTotal)
					setTemplateViewRevision((revision) => revision + 1)
					if (countRequest) {
						void countRequest.then((countResponse) => {
							if (
								!mountedRef.current ||
								requestSeq !== requestSeqRef.current ||
								!countResponse
							) {
								return
							}

							totalRef.current = countResponse.total
							setTotal(countResponse.total)
						})
					}
				}
				const currentTemplates = templatesRef.current
				const appendedTemplateCount =
					mode === "append"
						? getAppendedTemplateCount(currentTemplates, nextTemplates)
						: 0
				const updatedTemplates =
					mode === "replace"
						? nextTemplates
						: mergeTemplates(currentTemplates, nextTemplates)
				templatesRef.current = updatedTemplates
				setTemplates(updatedTemplates)
				setPage(response.page ?? nextPage)
				// 分页只依赖列表接口的当页数据。当页返回满 pageSize 时允许多请求一页，
				// 下一页为空、不满 pageSize 或没有新模板时停止，避免受不准确的 count 结果影响。
				setHasMore(
					mode === "replace"
						? nextTemplates.length >= pageSize
						: appendedTemplateCount > 0 && nextTemplates.length >= pageSize,
				)
				if (mode === "replace" && isAllTemplatesQuery) {
					setHasCheckedAnyTemplate(true)
					setHasAnyTemplate(nextTemplates.length > 0)
				}
				hasLoadedTemplatesRef.current = true
			} catch (error) {
				if (!mountedRef.current || requestSeq !== requestSeqRef.current) return
				console.error("Failed to fetch slides templates", error)
				if (mode === "replace" && !hasLoadedTemplatesRef.current) {
					templatesRef.current = []
					setTemplates([])
				}
				if (mode === "replace") setIsRefreshFailed(true)
				if (mode === "append") setIsLoadMoreFailed(true)
			} finally {
				if (templateRequestKeyRef.current === requestKey) {
					templateRequestKeyRef.current = null
				}
				if (mountedRef.current && requestSeq === requestSeqRef.current) {
					if (mode === "append") appendRequestInFlightRef.current = false
					setIsLoading(false)
					setIsRefreshing(false)
					setIsLoadingMore(false)
				}
			}
		},
		[debouncedKeyword, pageSize, selectedCategoryCode, selectedTagCodes, temporaryToken],
	)

	useEffect(() => {
		fetchTemplates(1, "replace")
	}, [fetchTemplates])

	const loadTemplateDetail = useCallback((code: string) => {
		const cachedDetail = templateDetailCacheRef.current.get(code)
		if (cachedDetail) return Promise.resolve(cachedDetail)

		const pendingRequest = templateDetailRequestCacheRef.current.get(code)
		if (pendingRequest) return pendingRequest

		const request = Promise.resolve(
			SuperMagicApi.getSlidesTemplateDetail(code, {
				xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS,
			}),
		)
			.then((detail) => {
				if (!detail) return null

				const nextDetail: SlidesTemplateDetail = detail
				const detailOption = toTemplateOption(nextDetail)
				templateDetailCacheRef.current.set(code, detailOption)
				return detailOption
			})
			.finally(() => {
				templateDetailRequestCacheRef.current.delete(code)
			})

		templateDetailRequestCacheRef.current.set(code, request)
		return request
	}, [])

	const groups = useMemo(() => {
		return groupSlidesTemplates(
			templates,
			categoryLoadFailed ? [] : categories,
			operationalTags,
		)
	}, [categories, categoryLoadFailed, operationalTags, templates])

	useEffect(() => {
		if (groups.some((group) => group.group_key === selectedGroupKey)) return
		setSelectedPrimaryGroupKey(ALL_SLIDES_TEMPLATE_GROUP_KEY)
		setSelectedChildTagCodes([])
	}, [groups, selectedGroupKey])

	const selectedGroup = groups.find((group) => group.group_key === selectedGroupKey)
	const isServerBackedGroup =
		selectedGroupKey === ALL_SLIDES_TEMPLATE_GROUP_KEY ||
		Boolean(selectedCategoryCode) ||
		selectedTagCodes.length > 0
	const serverBackedTemplateOptions = useMemo(() => {
		const cache = templateOptionCacheRef.current
		const activeCodes = new Set<string>()
		const isFeaturedQuery = selectedTagCodes.includes(FEATURED_SLIDES_TEMPLATE_TAG_CODE)

		const options = templates.map((template) => {
			activeCodes.add(template.code)
			const cached = cache.get(template.code)
			if (cached?.source === template && !isFeaturedQuery) return cached.option

			const option = toTemplateOption(template, { isFeatured: isFeaturedQuery })
			cache.set(template.code, { source: template, option })
			return option
		})

		for (const code of cache.keys()) {
			if (!activeCodes.has(code)) cache.delete(code)
		}

		return options
	}, [selectedTagCodes, templates])
	const templateOptions = isServerBackedGroup
		? serverBackedTemplateOptions
		: (selectedGroup?.children ?? [])
	const loadMore = useCallback(() => {
		if (
			isLoading ||
			isRefreshing ||
			isLoadingMore ||
			isLoadMoreFailed ||
			appendRequestInFlightRef.current ||
			!hasMore
		) {
			return
		}
		fetchTemplates(page + 1, "append")
	}, [fetchTemplates, hasMore, isLoading, isLoadingMore, isLoadMoreFailed, isRefreshing, page])

	const retryLoadMore = useCallback(() => {
		if (
			isLoading ||
			isRefreshing ||
			isLoadingMore ||
			appendRequestInFlightRef.current ||
			!hasMore
		) {
			return
		}
		fetchTemplates(page + 1, "append")
	}, [fetchTemplates, hasMore, isLoading, isLoadingMore, isRefreshing, page])

	const retryRefresh = useCallback(() => {
		if (isLoading || isRefreshing || isLoadingMore) return
		fetchTemplates(1, "replace")
	}, [fetchTemplates, isLoading, isLoadingMore, isRefreshing])

	const setTemplateFavorite = useCallback((code: string, isFavorite: boolean) => {
		setTemplates((currentTemplates) => {
			const nextTemplates = currentTemplates.map((template) =>
				template.code === code ? { ...template, is_favorite: isFavorite } : template,
			)
			templatesRef.current = nextTemplates
			return nextTemplates
		})
		const cachedDetail = templateDetailCacheRef.current.get(code)
		if (cachedDetail) {
			templateDetailCacheRef.current.set(code, {
				...cachedDetail,
				is_favorite: isFavorite,
			})
		}
	}, [])

	return {
		groups,
		hasAnyTemplate,
		hasCheckedAnyTemplate,
		hasMore,
		isPrimaryFilterLoading: isCategoryLoading || isAllTagGroupsLoading,
		isTagFilterLoading: selectedCategoryCode
			? isCategoryTagGroupsLoading || categoryTagGroupsCode !== selectedCategoryCode
			: isAllTagGroupsLoading,
		isLoading,
		isRefreshing,
		isLoadingMore,
		isLoadMoreFailed,
		isRefreshFailed,
		keyword,
		// 这里防抖后的关键词与 templates 的实际请求/替换时机对齐。外部依赖这个值来同步 UI（例如画布 resetKey）时，
		// 才不会和仍在防抖窗口内的原始 keyword 错开一帧，避免模板未变就先复位画布导致的错位。
		debouncedKeyword,
		loadMore,
		retryLoadMore,
		loadedTemplateCount: templates.length,
		total,
		templateViewRevision,
		loadTemplateDetail,
		retryRefresh,
		tagGroups,
		selectedCategoryCode,
		selectedChildTagCodes,
		selectedGroupKey,
		setKeyword,
		setSelectedGroupKey,
		setSelectedChildTagCodes,
		setTemplateFavorite,
		templateOptions,
	}
}

export type SlidesTemplateCatalogState = ReturnType<typeof useSlidesTemplateCatalogState>
