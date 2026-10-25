import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type {
	OptionGroup,
	OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { FEATURED_SLIDES_TEMPLATE_TAG_CODE } from "@/pages/superMagic/components/MainInputContainer/panels/slides-preset/templateMeta"
import {
	createSlidesTemplateTagGroupKey,
	toTemplateOption,
	type SlidesTemplateItem,
} from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import {
	mySlidesTemplateAdapter,
	subscribeMySlidesTemplatesChanged,
	type MySlidesTemplateAdapter,
	type MySlidesTemplatePage,
	type MySlidesTemplateSection,
} from "@/pages/superMagic/services/mySlidesTemplateAdapter"

export const MY_SLIDES_TEMPLATES_GROUP_KEY = "__my_slides_templates__"
export const MY_SLIDES_TEMPLATE_PAGE_SIZE = 40

export type MySlidesTemplatesEmptyStatus = "empty" | "error" | "loading" | "unavailable"

interface MySlidesTemplatesState {
	status: "error" | "idle" | "loading" | "success" | "unavailable"
	templates: OptionItem[]
	page: number
	hasMore: boolean
	isLoadingMore: boolean
	isLoadMoreFailed: boolean
	viewRevision: number
}

interface UseMySlidesTemplatesOptions {
	adapter?: MySlidesTemplateAdapter
	groups: OptionGroup[]
}

const INITIAL_SEARCH_VALUES: Record<MySlidesTemplateSection, string> = {
	created: "",
	favorites: "",
	used: "",
}

function getSearchText(template: OptionItem): string {
	const values = [template.value, template.label, template.description]
	return values
		.flatMap((value) =>
			typeof value === "string" ? [value] : Object.values(value ?? {}).filter(Boolean),
		)
		.join(" ")
		.toLocaleLowerCase()
}

export function useMySlidesTemplates({
	adapter = mySlidesTemplateAdapter,
	groups,
}: UseMySlidesTemplatesOptions) {
	const { t } = useTranslation("super")
	const [isSelected, setIsSelected] = useState(false)
	const [activeSection, setActiveSection] = useState<MySlidesTemplateSection>("created")
	const [searchValues, setSearchValues] = useState(INITIAL_SEARCH_VALUES)
	const [state, setState] = useState<MySlidesTemplatesState>(() => ({
		status: adapter.enabled ? "idle" : "unavailable",
		templates: [],
		page: 0,
		hasMore: false,
		isLoadingMore: false,
		isLoadMoreFailed: false,
		viewRevision: 0,
	}))
	const requestSeqRef = useRef(0)
	const appendRequestInFlightRef = useRef(false)
	const pageRef = useRef(0)
	const activeSectionRef = useRef(activeSection)
	activeSectionRef.current = activeSection
	const searchValue = searchValues[activeSection]

	const load = useCallback(
		async (options: { mode?: "append" | "replace"; keyword?: string } = {}) => {
			if (!adapter.enabled) {
				setState((current) => ({ ...current, status: "unavailable" }))
				return
			}

			const mode = options.mode ?? "replace"
			if (mode === "append" && appendRequestInFlightRef.current) return
			const keyword = (options.keyword ?? searchValue).trim()
			if (mode === "replace") pageRef.current = 0
			const nextPage = mode === "append" ? pageRef.current + 1 : 1
			const requestSeq = requestSeqRef.current + 1
			requestSeqRef.current = requestSeq
			appendRequestInFlightRef.current = mode === "append"
			setState((current) => ({
				...current,
				status: mode === "append" ? current.status : "loading",
				isLoadingMore: mode === "append",
				isLoadMoreFailed: false,
			}))

			try {
				const params = {
					page: nextPage,
					pageSize: MY_SLIDES_TEMPLATE_PAGE_SIZE,
					keyword: keyword || undefined,
				}
				let result: MySlidesTemplatePage
				if (activeSection === "used" && keyword) {
					const items: SlidesTemplateItem[] = []
					const seenCodes = new Set<string>()
					let usedPage = 1
					let shouldLoadNextPage = true
					while (shouldLoadNextPage) {
						const usedResult = await adapter.listUsed({ page: usedPage, pageSize: 200 })
						if (requestSeq !== requestSeqRef.current) return
						let appendedCount = 0
						usedResult.items.forEach((template) => {
							if (seenCodes.has(template.code)) return
							seenCodes.add(template.code)
							items.push(template)
							appendedCount += 1
						})
						shouldLoadNextPage = usedResult.hasMore && appendedCount > 0
						if (shouldLoadNextPage) usedPage = usedResult.page + 1
					}
					const normalizedKeyword = keyword.toLocaleLowerCase()
					result = {
						items: items.filter((template) =>
							getSearchText(toTemplateOption(template)).includes(normalizedKeyword),
						),
						page: 1,
						pageSize: items.length,
						hasMore: false,
					}
				} else {
					result = await (activeSection === "created"
						? adapter.listMine(params)
						: activeSection === "favorites"
							? adapter.listFavorites(params)
							: adapter.listUsed(params))
				}
				if (requestSeq !== requestSeqRef.current) return

				const nextTemplates = result.items.map(toTemplateOption)

				setState((current) => {
					const existingCodes = new Set(
						current.templates.map((template) => template.value),
					)
					return {
						status: "success",
						templates:
							mode === "append"
								? [
										...current.templates,
										...nextTemplates.filter(
											(template) => !existingCodes.has(template.value),
										),
									]
								: nextTemplates,
						page: result.page,
						hasMore: result.hasMore,
						isLoadingMore: false,
						isLoadMoreFailed: false,
						viewRevision:
							mode === "replace" ? current.viewRevision + 1 : current.viewRevision,
					}
				})
				pageRef.current = result.page
			} catch {
				if (requestSeq !== requestSeqRef.current) return
				setState((current) => ({
					...current,
					status: mode === "append" ? current.status : "error",
					isLoadingMore: false,
					isLoadMoreFailed: mode === "append",
				}))
			} finally {
				if (requestSeq === requestSeqRef.current) {
					appendRequestInFlightRef.current = false
				}
			}
		},
		[activeSection, adapter, searchValue],
	)

	useEffect(() => {
		if (!isSelected) return
		const delay = requestSeqRef.current === 0 ? 0 : 300
		const timer = window.setTimeout(() => {
			void load({ keyword: searchValue })
		}, delay)
		return () => window.clearTimeout(timer)
	}, [activeSection, isSelected, load, searchValue])

	useEffect(
		() =>
			subscribeMySlidesTemplatesChanged(() => {
				if (isSelected && activeSection === "created") {
					void load({ keyword: searchValue })
				}
			}),
		[activeSection, isSelected, load, searchValue],
	)

	const templateGroups = useMemo(() => {
		const nextGroups = [...groups]
		const featuredGroupIndex = nextGroups.findIndex(
			(group) =>
				group.group_key ===
				createSlidesTemplateTagGroupKey(FEATURED_SLIDES_TEMPLATE_TAG_CODE),
		)
		nextGroups.splice(featuredGroupIndex >= 0 ? featuredGroupIndex : 1, 0, {
			group_key: MY_SLIDES_TEMPLATES_GROUP_KEY,
			group_name: t("mySlidesTemplates.entry"),
			children: state.templates,
		})
		return nextGroups
	}, [groups, state.templates, t])

	const leave = useCallback(() => setIsSelected(false), [])
	const select = useCallback(() => setIsSelected(true), [])
	const retry = useCallback(() => load({ keyword: searchValue }), [load, searchValue])
	const loadMore = useCallback(() => load({ mode: "append" }), [load])
	const selectSection = useCallback(
		(section: MySlidesTemplateSection) => {
			setIsSelected(true)
			if (section === activeSection) return
			requestSeqRef.current += 1
			appendRequestInFlightRef.current = false
			pageRef.current = 0
			setActiveSection(section)
			setState((current) => ({
				...current,
				status: "idle",
				templates: [],
				page: 0,
				hasMore: false,
				isLoadingMore: false,
				isLoadMoreFailed: false,
			}))
		},
		[activeSection],
	)
	const setSearchValue = useCallback((value: string) => {
		requestSeqRef.current += 1
		appendRequestInFlightRef.current = false
		pageRef.current = 0
		setSearchValues((current) => ({
			...current,
			[activeSectionRef.current]: value,
		}))
	}, [])
	const setTemplateFavorite = useCallback(
		(
			section: MySlidesTemplateSection,
			code: string,
			isFavorite: boolean,
			fallbackTemplate?: OptionItem,
		) => {
			if (activeSectionRef.current !== section) return
			setState((current) => {
				const hasTemplate = current.templates.some((template) => template.value === code)
				const nextTemplates = current.templates.map((template) =>
					template.value === code ? { ...template, is_favorite: isFavorite } : template,
				)
				if (section === "favorites" && !isFavorite) {
					return {
						...current,
						templates: nextTemplates.filter((template) => template.value !== code),
					}
				}
				if (section === "favorites" && isFavorite && !hasTemplate && fallbackTemplate) {
					return {
						...current,
						templates: [{ ...fallbackTemplate, is_favorite: true }, ...nextTemplates],
					}
				}
				return { ...current, templates: nextTemplates }
			})
		},
		[],
	)
	const removeTemplate = useCallback(
		async (code: string) => {
			await adapter.remove(code)
			if (activeSectionRef.current !== "created") return
			setState((current) => ({
				...current,
				templates: current.templates.filter((template) => template.value !== code),
			}))
		},
		[adapter],
	)

	const emptyStatus: MySlidesTemplatesEmptyStatus | null = (() => {
		if (!isSelected) return null
		if (state.status === "idle" || (state.status === "loading" && !state.templates.length)) {
			return "loading"
		}
		if (state.status === "error") return "error"
		if (state.status === "unavailable") return "unavailable"
		return state.templates.length === 0 ? "empty" : null
	})()

	return {
		activeSection,
		emptyStatus,
		groups: templateGroups,
		hasMore: state.hasMore,
		isLoadingMore: state.isLoadingMore,
		isLoadMoreFailed: state.isLoadMoreFailed,
		isSelected,
		leave,
		loadMore,
		loadMoreSignal: state.templates.length,
		resetKey: `my:${activeSection}:${state.viewRevision}`,
		retry,
		retryLoadMore: loadMore,
		searchValue,
		select,
		setActiveSection: selectSection,
		setSearchValue,
		setTemplateFavorite,
		removeTemplate,
		templates: state.templates,
	}
}
