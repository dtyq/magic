import { useCallback, useRef } from "react"
import type { OptionItem } from "../../panels/types"
import { mySlidesTemplateAdapter } from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import { toTemplateOption } from "./slidesTemplateState"
import {
	MY_SLIDES_TEMPLATES_GROUP_KEY,
	useMySlidesTemplates,
} from "@/pages/superMagic/pages/SlidesTemplates/useMySlidesTemplates"
import { useSlidesTemplateCatalogState } from "./useSlidesTemplateCatalogState"
import { useSlidesTemplateFavorite } from "./useSlidesTemplateFavorite"

export function useSlidesTemplatePanelState() {
	const catalogState = useSlidesTemplateCatalogState()
	const mySlidesTemplates = useMySlidesTemplates({ groups: catalogState.groups })
	const {
		activeSection: myTemplatesActiveSection,
		emptyStatus: myTemplatesEmptyStatus,
		groups,
		hasMore: myTemplatesHasMore,
		isSelected: isMyTemplatesSelected,
		isLoadingMore: isMyTemplatesLoadingMore,
		isLoadMoreFailed: isMyTemplatesLoadMoreFailed,
		leave,
		loadMore: loadMoreMyTemplates,
		loadMoreSignal,
		retry: retryMyTemplates,
		retryLoadMore: retryLoadMoreMyTemplates,
		searchValue,
		select,
		setActiveSection: setMyTemplatesActiveSection,
		removeTemplate: removeMyTemplate,
		setSearchValue,
		setTemplateFavorite: setMyTemplateFavorite,
		templates: myTemplates,
	} = mySlidesTemplates
	const {
		loadTemplateDetail: loadCatalogTemplateDetail,
		setKeyword: setCatalogKeyword,
		setSelectedChildTagCodes: setCatalogSelectedChildTagCodes,
		setSelectedGroupKey: setCatalogSelectedGroupKey,
		setTemplateFavorite: setCatalogTemplateFavorite,
	} = catalogState
	const { pendingCodes: favoritePendingCodes, toggleFavorite } =
		useSlidesTemplateFavorite(mySlidesTemplateAdapter)
	const isMyTemplatesSelectedRef = useRef(isMyTemplatesSelected)
	isMyTemplatesSelectedRef.current = isMyTemplatesSelected

	const setSelectedGroupKey = useCallback(
		(groupKey: string) => {
			if (groupKey === MY_SLIDES_TEMPLATES_GROUP_KEY) {
				select()
				return
			}

			leave()
			setCatalogSelectedGroupKey(groupKey)
		},
		[leave, select, setCatalogSelectedGroupKey],
	)

	const setKeyword = useCallback(
		(keyword: string) => {
			if (isMyTemplatesSelectedRef.current) {
				setSearchValue(keyword)
				return
			}

			setCatalogKeyword(keyword)
		},
		[setCatalogKeyword, setSearchValue],
	)

	const setSelectedChildTagCodes = useCallback(
		(tagCodes: string[]) => {
			if (isMyTemplatesSelectedRef.current) leave()
			setCatalogSelectedChildTagCodes(tagCodes)
		},
		[leave, setCatalogSelectedChildTagCodes],
	)

	const loadTemplateDetail = useCallback(
		(code: string) => {
			if (isMyTemplatesSelected) {
				return mySlidesTemplateAdapter.loadDetail(code).then(toTemplateOption)
			}

			return loadCatalogTemplateDetail(code)
		},
		[isMyTemplatesSelected, loadCatalogTemplateDetail],
	)

	const toggleTemplateFavorite = useCallback(
		(template: OptionItem) => {
			const section = myTemplatesActiveSection
			return toggleFavorite(template, (code, isFavorite, fallbackTemplate) => {
				setCatalogTemplateFavorite(code, isFavorite)
				setMyTemplateFavorite(section, code, isFavorite, fallbackTemplate)
			})
		},
		[
			myTemplatesActiveSection,
			setCatalogTemplateFavorite,
			setMyTemplateFavorite,
			toggleFavorite,
		],
	)

	return {
		...catalogState,
		groups,
		selectedGroupKey: isMyTemplatesSelected
			? MY_SLIDES_TEMPLATES_GROUP_KEY
			: catalogState.selectedGroupKey,
		keyword: isMyTemplatesSelected ? searchValue : catalogState.keyword,
		setKeyword,
		setSelectedGroupKey,
		setSelectedChildTagCodes,
		selectedChildTagCodes: catalogState.selectedChildTagCodes,
		tagGroups: catalogState.tagGroups,
		isTagFilterLoading: catalogState.isTagFilterLoading,
		templateOptions: isMyTemplatesSelected ? myTemplates : catalogState.templateOptions,
		total: isMyTemplatesSelected ? myTemplates.length : catalogState.total,
		hasMore: isMyTemplatesSelected ? myTemplatesHasMore : catalogState.hasMore,
		isLoading: isMyTemplatesSelected
			? myTemplatesEmptyStatus === "loading"
			: catalogState.isLoading,
		isRefreshing: isMyTemplatesSelected ? false : catalogState.isRefreshing,
		isLoadingMore: isMyTemplatesSelected
			? isMyTemplatesLoadingMore
			: catalogState.isLoadingMore,
		isLoadMoreFailed: isMyTemplatesSelected
			? isMyTemplatesLoadMoreFailed
			: catalogState.isLoadMoreFailed,
		isRefreshFailed: isMyTemplatesSelected ? false : catalogState.isRefreshFailed,
		loadMore: isMyTemplatesSelected ? loadMoreMyTemplates : catalogState.loadMore,
		retryLoadMore: isMyTemplatesSelected
			? retryLoadMoreMyTemplates
			: catalogState.retryLoadMore,
		loadTemplateDetail,
		loadedTemplateCount: isMyTemplatesSelected
			? myTemplates.length
			: catalogState.loadedTemplateCount,
		templateViewRevision: isMyTemplatesSelected
			? loadMoreSignal
			: catalogState.templateViewRevision,
		selectedCategoryCode: isMyTemplatesSelected ? undefined : catalogState.selectedCategoryCode,
		myTemplatesEmptyStatus,
		myTemplatesActiveSection,
		setMyTemplatesActiveSection,
		retryMyTemplates,
		favoritePendingCodes,
		removeTemplate: removeMyTemplate,
		toggleTemplateFavorite,
	}
}

export type SlidesTemplatePanelState = ReturnType<typeof useSlidesTemplatePanelState>
