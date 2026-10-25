import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useDebounce, useThrottle } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import { SkillsApi } from "@/apis"
import type {
	SkillLastVersionItem,
	SkillPublisherType,
	StoreSkillItem,
} from "@/apis/modules/skills"
import type { CrewI18nText } from "@/apis/modules/crew"
import { buildCrewI18nText } from "@/apis/modules/crew"
import { CREW_SKILLS_TAB, type CrewSkillsTab } from "../../../store"
import { skillsService } from "@/services/skills/SkillsService"

const SKILLS_PANEL_PAGE_SIZE = 20
/** Debounce after pause; throttle caps request rate for auto-search. */
const SKILLS_SEARCH_DEBOUNCE_MS = 300
const SKILLS_SEARCH_THROTTLE_MS = 400

export type SkillInstallStatus = "not-installed" | "installed"

export interface SkillPanelItem {
	/** store_skill_id (library) or user skill id (my-skills) */
	id: string
	/** Store skill code — used for status comparison against agent skill codes */
	skillCode: string
	/** Publisher type of the skill */
	publisher_type?: SkillPublisherType
	/**
	 * User's own skill code (populated when skill is in user's library).
	 * This is the ID that must be passed to updateAgentSkills.
	 * Equals skillCode for "my-skills" items; populated after addSkillFromStore
	 * for "library" items.
	 */
	userSkillCode: string | undefined
	/** Whether this skill is already in the user's library */
	isInUserLibrary: boolean
	name: string
	description: string
	logo: string
	sourceType?: SkillLastVersionItem["source_type"]
	/** Derived in the observer component — not stored here */
	status: SkillInstallStatus
}

interface PaginationStateItem {
	page: number
	total: number
	loading: boolean
	loadingMore: boolean
}

interface SkillsPanelPaginationState {
	library: PaginationStateItem
	mySkills: PaginationStateItem
}

interface UseSkillsPanelOptions {
	readOnly?: boolean
	activeTab: CrewSkillsTab
	onTabChange: (tab: CrewSkillsTab) => void
	/**
	 * Set of skill codes currently assigned to the agent.
	 * Must be computed inside the MobX observer component so reactivity
	 * produces a fresh Set reference on each relevant re-render.
	 */
	agentSkillCodes: Set<string>
	/** Optimistic local add — updates MobX state immediately. */
	onAddSkill: (skill: {
		skill_code: string
		name_i18n: CrewI18nText
		description_i18n: CrewI18nText
		logo: string | null
	}) => void
	/** Optimistic local remove — updates MobX state immediately. */
	onRemoveSkill: (skillCode: string) => void
	/** Persist add of a single skill code to the backend (API 6.1). */
	onAddSkillToAgent: (skillCode: string) => Promise<void>
	/** Persist removal of a single skill code to the backend (API 6.2). */
	onRemoveSkillFromAgent: (skillCode: string) => Promise<void>
	/** Refresh bound crew skills from backend after persistence succeeds. */
	onRefreshSkills?: () => Promise<void>
	/** Resolved list fields follow the request locale; changes must refresh the API data. */
	language: string
	/**
	 * Optional full replacement for install (after list item click).
	 * Use for non-crew agent targets; still runs onRefreshSkills on success.
	 */
	overrideInstall?: (skillCode: string) => Promise<void>
	/**
	 * Optional full replacement for uninstall.
	 * Use for non-crew agent targets; still runs onRefreshSkills on success.
	 */
	overrideUninstall?: (skillCode: string) => Promise<void>
}

function resolveStoreSkillCode(item: StoreSkillItem): string {
	return item.code || item.skill_code || item.package_name || String(item.id)
}

function mapStoreSkill(item: StoreSkillItem): SkillPanelItem {
	return {
		id: item.id,
		skillCode: resolveStoreSkillCode(item),
		userSkillCode: item.user_skill_code ?? undefined,
		isInUserLibrary: item.is_added,
		// Market responses are already localized by the API request language.
		name: item.name?.trim() || item.package_name || resolveStoreSkillCode(item),
		description: item.description?.trim() || "",
		logo: item.logo,
		sourceType: undefined,
		status: "not-installed",
		publisher_type: item.publisher_type,
	}
}

function mapLatestPublishedSkill(item: SkillLastVersionItem): SkillPanelItem {
	return {
		id: item.id,
		skillCode: item.code,
		userSkillCode: item.code,
		isInUserLibrary: true,
		// Latest-version responses expose the localized display fields directly.
		name: item.name?.trim() || item.package_name || item.code,
		description: item.description || "",
		logo: item.logo,
		sourceType: item.source_type,
		status: "not-installed",
		publisher_type: undefined,
	}
}

function replacePageItems(params: {
	items: SkillPanelItem[]
	pageItems: SkillPanelItem[]
	page: number
	pageSize: number
}): SkillPanelItem[] {
	const { items, pageItems, page, pageSize } = params
	const startIndex = (page - 1) * pageSize
	const nextItems = [...items]
	nextItems.splice(startIndex, pageItems.length, ...pageItems)
	return nextItems
}

function createInitialPaginationState(): SkillsPanelPaginationState {
	return {
		library: {
			page: 1,
			total: 0,
			loading: false,
			loadingMore: false,
		},
		mySkills: {
			page: 1,
			total: 0,
			loading: false,
			loadingMore: false,
		},
	}
}

export function useSkillsPanel({
	readOnly = false,
	activeTab,
	onTabChange,
	agentSkillCodes,
	onAddSkill,
	onRemoveSkill,
	onAddSkillToAgent,
	onRemoveSkillFromAgent,
	onRefreshSkills,
	language,
	overrideInstall,
	overrideUninstall,
}: UseSkillsPanelOptions) {
	const [searchQuery, setSearchQuery] = useState("")
	const [isSearchComposing, setIsSearchComposing] = useState(false)
	const debouncedSearchQuery = useDebounce(searchQuery, { wait: SKILLS_SEARCH_DEBOUNCE_MS })
	const throttledSearchQuery = useThrottle(debouncedSearchQuery, {
		wait: SKILLS_SEARCH_THROTTLE_MS,
	})
	/** Last applied keyword; keeps load-more aligned with list query. */
	const appliedKeywordRef = useRef("")
	const [rawLibrary, setRawLibrary] = useState<SkillPanelItem[]>([])
	const [rawMySkills, setRawMySkills] = useState<SkillPanelItem[]>([])
	const [paginationState, setPaginationState] = useState<SkillsPanelPaginationState>(
		createInitialPaginationState,
	)

	/** Per-skill busy flag (during install / uninstall network requests) */
	const [busySkills, setBusySkills] = useState<Set<string>>(new Set())

	const updatePaginationState = useCallback(
		(
			tab: keyof SkillsPanelPaginationState,
			updater: (state: PaginationStateItem) => PaginationStateItem,
		) => {
			setPaginationState((prev) => ({
				...prev,
				[tab]: updater(prev[tab]),
			}))
		},
		[],
	)

	const fetchLibrary = useCallback(
		async ({
			keyword,
			page = 1,
			append = false,
		}: {
			keyword?: string
			page?: number
			append?: boolean
		} = {}) => {
			updatePaginationState("library", (state) => ({
				...state,
				loading: append ? state.loading : true,
				loadingMore: append,
			}))

			try {
				const res = await SkillsApi.getStoreSkills({
					keyword,
					page,
					page_size: SKILLS_PANEL_PAGE_SIZE,
				})
				const nextItems = res.list.map((item) => mapStoreSkill(item))
				setRawLibrary((prev) => (append ? [...prev, ...nextItems] : nextItems))
				const legacyTotal =
					"total" in res && typeof res.total === "number" ? res.total : undefined
				const pageSize = res.page_size || SKILLS_PANEL_PAGE_SIZE
				const inferredTotal =
					legacyTotal ??
					(res.list.length < pageSize
						? (page - 1) * pageSize + res.list.length
						: page * pageSize + 1)
				updatePaginationState("library", (state) => ({
					...state,
					page: res.page,
					total: inferredTotal,
				}))
			} catch {
				// Non-critical; list stays empty
			} finally {
				updatePaginationState("library", (state) => ({
					...state,
					loading: false,
					loadingMore: false,
				}))
			}
		},
		[updatePaginationState],
	)

	const fetchMySkills = useCallback(
		async ({ page = 1, append = false }: { page?: number; append?: boolean } = {}) => {
			updatePaginationState("mySkills", (state) => ({
				...state,
				loading: append ? state.loading : true,
				loadingMore: append,
			}))

			try {
				const res = await SkillsApi.getSkillLastVersions({
					page,
					page_size: SKILLS_PANEL_PAGE_SIZE,
				})
				const nextItems = res.list.map((item) => mapLatestPublishedSkill(item))
				setRawMySkills((prev) => (append ? [...prev, ...nextItems] : nextItems))
				updatePaginationState("mySkills", (state) => ({
					...state,
					page: res.page,
					total: res.total,
				}))
			} catch {
				// Non-critical; list stays empty
			} finally {
				updatePaginationState("mySkills", (state) => ({
					...state,
					loading: false,
					loadingMore: false,
				}))
			}
		},
		[updatePaginationState],
	)

	useEffect(() => {
		appliedKeywordRef.current = ""
		setSearchQuery("")
		setIsSearchComposing(false)
		if (activeTab === CREW_SKILLS_TAB.Library) return
		void fetchMySkills({ page: 1 })
	}, [activeTab, fetchMySkills, language])

	// Library: debounce + throttle; skip while IME is composing (CJK input).
	useEffect(() => {
		if (activeTab !== CREW_SKILLS_TAB.Library) return
		if (isSearchComposing) return
		const kw = throttledSearchQuery.trim()
		appliedKeywordRef.current = kw
		void fetchLibrary({ keyword: kw || undefined, page: 1 })
	}, [activeTab, throttledSearchQuery, fetchLibrary, isSearchComposing, language])

	const onSearchCompositionStart = useCallback(() => setIsSearchComposing(true), [])
	const onSearchCompositionEnd = useCallback(() => setIsSearchComposing(false), [])

	/** Overlay live agent-assignment status onto raw fetched items */
	const displayItems = useMemo<SkillPanelItem[]>(() => {
		const raw = activeTab === CREW_SKILLS_TAB.Library ? rawLibrary : rawMySkills
		return raw.map((item) => {
			// Agent skills are stored with userSkillCode as the ID.
			// For library items we must check userSkillCode (not the store's skill_code).
			// For "my-skills" items skillCode === userSkillCode, so this is consistent.
			const agentId = item.userSkillCode ?? item.skillCode
			return {
				...item,
				status: agentSkillCodes.has(agentId)
					? ("installed" as const)
					: ("not-installed" as const),
			}
		})
	}, [activeTab, rawLibrary, rawMySkills, agentSkillCodes])

	const activePaginationState =
		activeTab === CREW_SKILLS_TAB.Library ? paginationState.library : paginationState.mySkills
	const loading = activePaginationState.loading
	const loadingMore = activePaginationState.loadingMore
	const hasMore =
		activeTab === CREW_SKILLS_TAB.Library
			? rawLibrary.length < paginationState.library.total
			: rawMySkills.length < paginationState.mySkills.total

	const setBusy = useCallback((skillCode: string, busy: boolean) => {
		setBusySkills((prev) => {
			const next = new Set(prev)
			if (busy) next.add(skillCode)
			else next.delete(skillCode)
			return next
		})
	}, [])

	const handleInstall = useCallback(
		async (skillCode: string) => {
			if (readOnly) return
			const skill = displayItems.find((item) => item.skillCode === skillCode)
			if (!skill || busySkills.has(skillCode)) return

			if (overrideInstall) {
				setBusy(skillCode, true)
				try {
					await overrideInstall(skillCode)
					try {
						await onRefreshSkills?.()
					} catch {
						// Keep UI when sync fails transiently.
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : undefined
					if (msg) magicToast.error(msg)
				} finally {
					setBusy(skillCode, false)
				}
				return
			}

			setBusy(skillCode, true)
			let agentSkillId: string | undefined

			try {
				if (activeTab === CREW_SKILLS_TAB.Library) {
					if (!skill.isInUserLibrary) {
						// The install API may return no identity, so preserve the code already shown in the row.
						await skillsService.addSkillFromStore(skill.id, skillCode)
					}

					const rawIndex = rawLibrary.findIndex((item) => item.skillCode === skillCode)
					const targetPage =
						rawIndex >= 0 ? Math.floor(rawIndex / SKILLS_PANEL_PAGE_SIZE) + 1 : 1
					const refreshed = await SkillsApi.getStoreSkills({
						page: targetPage,
						page_size: SKILLS_PANEL_PAGE_SIZE,
						keyword: appliedKeywordRef.current || undefined,
					})
					const refreshedPageItems = refreshed.list.map((item) => mapStoreSkill(item))

					setRawLibrary((prev) =>
						replacePageItems({
							items: prev,
							pageItems: refreshedPageItems,
							page: targetPage,
							pageSize: SKILLS_PANEL_PAGE_SIZE,
						}),
					)

					const updatedSkill = refreshed.list.find(
						(item) => resolveStoreSkillCode(item) === skillCode,
					)
					agentSkillId = updatedSkill?.user_skill_code ?? skillCode
				} else {
					agentSkillId = skillCode
				}

				onAddSkill({
					skill_code: agentSkillId,
					name_i18n: buildCrewI18nText(skill.name),
					description_i18n: buildCrewI18nText(skill.description),
					logo: skill.logo,
				})

				await onAddSkillToAgent(agentSkillId)
				try {
					await onRefreshSkills?.()
				} catch {
					// Keep optimistic state when sync fails transiently.
				}
			} catch (err) {
				if (agentSkillId) onRemoveSkill(agentSkillId)
				const msg = err instanceof Error ? err.message : undefined
				if (msg) magicToast.error(msg)
			} finally {
				setBusy(skillCode, false)
			}
		},
		[
			activeTab,
			busySkills,
			displayItems,
			onAddSkill,
			onAddSkillToAgent,
			onRefreshSkills,
			onRemoveSkill,
			overrideInstall,
			rawLibrary,
			setBusy,
			readOnly,
		],
	)

	const handleUninstall = useCallback(
		async (skillCode: string) => {
			if (readOnly) return
			if (busySkills.has(skillCode)) return

			const skill = displayItems.find((item) => item.skillCode === skillCode)
			const agentSkillId = skill?.userSkillCode ?? skillCode

			if (overrideUninstall) {
				setBusy(skillCode, true)
				try {
					await overrideUninstall(skillCode)
					try {
						await onRefreshSkills?.()
					} catch {
						// Keep UI when sync fails transiently.
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : undefined
					if (msg) magicToast.error(msg)
				} finally {
					setBusy(skillCode, false)
				}
				return
			}

			setBusy(skillCode, true)
			onRemoveSkill(agentSkillId)
			try {
				await onRemoveSkillFromAgent(agentSkillId)
				try {
					await onRefreshSkills?.()
				} catch {
					// Keep optimistic state when sync fails transiently.
				}
			} catch (err) {
				onAddSkill({
					skill_code: agentSkillId,
					name_i18n: buildCrewI18nText(skill?.name ?? ""),
					description_i18n: buildCrewI18nText(skill?.description ?? ""),
					logo: skill?.logo ?? null,
				})
				const msg = err instanceof Error ? err.message : undefined
				if (msg) magicToast.error(msg)
			} finally {
				setBusy(skillCode, false)
			}
		},
		[
			busySkills,
			displayItems,
			onAddSkill,
			onRefreshSkills,
			onRemoveSkill,
			onRemoveSkillFromAgent,
			overrideUninstall,
			readOnly,
			setBusy,
		],
	)

	const handleLoadMore = useCallback(() => {
		if (loading || loadingMore || !hasMore) return
		if (activeTab === CREW_SKILLS_TAB.Library && isSearchComposing) return

		const keyword = appliedKeywordRef.current || undefined
		if (activeTab === CREW_SKILLS_TAB.Library) {
			void fetchLibrary({
				page: paginationState.library.page + 1,
				append: true,
				keyword,
			})
			return
		}

		void fetchMySkills({
			page: paginationState.mySkills.page + 1,
			append: true,
		})
	}, [
		activeTab,
		fetchLibrary,
		fetchMySkills,
		hasMore,
		loading,
		loadingMore,
		paginationState.library.page,
		paginationState.mySkills.page,
		isSearchComposing,
	])

	/** Immediate search (Enter / button) before debounce catches up. */
	const handleSearch = useCallback(() => {
		if (activeTab !== CREW_SKILLS_TAB.Library) return
		if (isSearchComposing) return
		const keyword = searchQuery.trim()
		appliedKeywordRef.current = keyword
		void fetchLibrary({ keyword: keyword || undefined, page: 1 })
	}, [activeTab, fetchLibrary, searchQuery, isSearchComposing])

	/**
	 * After import: refresh "My Skills" list only. Install-to-agent is manual;
	 * publish prompt is handled by SkillActionDropdown (ImportSkillPublishPromptDialog).
	 */
	const handleImportSuccess = useCallback(async () => {
		if (readOnly) return
		onTabChange(CREW_SKILLS_TAB.MySkills)
		await fetchMySkills({ page: 1 })
	}, [fetchMySkills, onTabChange, readOnly])

	return {
		activeTab,
		setActiveTab: onTabChange,
		searchQuery,
		setSearchQuery,
		filteredItems: displayItems,
		loading,
		loadingMore,
		hasMore,
		busySkills,
		handleInstall,
		handleUninstall,
		handleLoadMore,
		handleSearch,
		handleImportSuccess,
		onSearchCompositionStart,
		onSearchCompositionEnd,
	}
}
