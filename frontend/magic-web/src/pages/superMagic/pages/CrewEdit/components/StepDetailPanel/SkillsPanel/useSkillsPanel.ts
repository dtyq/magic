import { useState, useCallback, useEffect, useMemo } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { SkillsApi } from "@/apis"
import type { ImportSkillResponse, StoreSkillItem } from "@/apis/modules/skills"
import type { CrewI18nText } from "@/apis/modules/crew"
import { buildCrewI18nText } from "@/apis/modules/crew"
import { useInstallImportedSkill } from "../../../hooks/useInstallImportedSkill"
import { CREW_SKILLS_TAB, type CrewSkillsTab } from "../../../store"

export type SkillInstallStatus = "not-installed" | "installed"

export interface SkillPanelItem {
	/** store_skill_id (library) or user skill id (my-skills) */
	id: string
	/** Store skill code — used for status comparison against agent skill codes */
	skillCode: string
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
	/** Derived in the observer component — not stored here */
	status: SkillInstallStatus
}

function resolveLocalizedText(
	textObj: Record<string, string> | undefined,
	language: string,
): string {
	if (!textObj) return ""
	if (language.startsWith("zh")) return textObj.zh_CN || textObj.en_US || ""
	return textObj.en_US || textObj.zh_CN || ""
}

function mapStoreSkill(item: StoreSkillItem, language: string): SkillPanelItem {
	return {
		id: item.id,
		skillCode: item.skill_code,
		userSkillCode: item.user_skill_code ?? undefined,
		isInUserLibrary: item.is_added,
		name: resolveLocalizedText(item.name_i18n, language),
		description: resolveLocalizedText(item.description_i18n, language),
		logo: item.logo,
		status: "not-installed",
	}
}

interface UseSkillsPanelOptions {
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
	language: string
}

export function useSkillsPanel({
	activeTab,
	onTabChange,
	agentSkillCodes,
	onAddSkill,
	onRemoveSkill,
	onAddSkillToAgent,
	onRemoveSkillFromAgent,
	language,
}: UseSkillsPanelOptions) {
	const installImportedSkill = useInstallImportedSkill()
	const [searchQuery, setSearchQuery] = useState("")

	const [rawLibrary, setRawLibrary] = useState<SkillPanelItem[]>([])
	const [rawMySkills, setRawMySkills] = useState<SkillPanelItem[]>([])
	const [loading, setLoading] = useState(false)

	/** Per-skill busy flag (during install / uninstall network requests) */
	const [busySkills, setBusySkills] = useState<Set<string>>(new Set())

	// ─── Fetch helpers ───────────────────────────────────────────────────────

	const fetchLibrary = useCallback(
		async (keyword?: string) => {
			setLoading(true)
			try {
				const res = await SkillsApi.getStoreSkills({ keyword, page_size: 50 })
				setRawLibrary(res.list.map((item) => mapStoreSkill(item, language)))
			} catch {
				// Non-critical; list stays empty
			} finally {
				setLoading(false)
			}
		},
		[language],
	)

	const fetchMySkills = useCallback(async () => {
		setLoading(true)
		try {
			const res = await SkillsApi.getSkills({ page_size: 100 })
			setRawMySkills(
				res.list.map((item) => ({
					id: item.id,
					skillCode: item.code,
					userSkillCode: item.code,
					isInUserLibrary: true,
					name: resolveLocalizedText(item.name_i18n, language),
					description: resolveLocalizedText(item.description_i18n, language),
					logo: item.logo,
					status: "not-installed",
				})),
			)
		} catch {
			// Non-critical; list stays empty
		} finally {
			setLoading(false)
		}
	}, [language])

	// Re-fetch when the active tab changes
	useEffect(() => {
		if (activeTab === "library") {
			void fetchLibrary()
		} else {
			void fetchMySkills()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab])

	// ─── Derived display data ────────────────────────────────────────────────

	/** Overlay live agent-assignment status onto raw fetched items */
	const displayItems = useMemo<SkillPanelItem[]>(() => {
		const raw = activeTab === "library" ? rawLibrary : rawMySkills
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

	const filteredItems = useMemo(() => {
		if (activeTab !== "library" || !searchQuery.trim()) return displayItems
		const lower = searchQuery.toLowerCase()
		return displayItems.filter(
			(s) =>
				s.name.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower),
		)
	}, [displayItems, activeTab, searchQuery])

	// ─── Actions ─────────────────────────────────────────────────────────────

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
			const skill = displayItems.find((s) => s.skillCode === skillCode)
			if (!skill || busySkills.has(skillCode)) return

			setBusy(skillCode, true)
			// Track the resolved agent skill ID outside try for rollback access
			let agentSkillId: string | undefined
			try {
				if (activeTab === "library") {
					// Step 1: Add the skill to the user's own skill library (if not yet added)
					if (!skill.isInUserLibrary) {
						await SkillsApi.addSkillFromStore({ store_skill_id: skill.id })
					}

					// Step 2: Re-fetch the store skill list to obtain the user's skill code
					// (user_skill_code may differ from the store's skill_code and is the
					// correct ID for addAgentSkills / deleteAgentSkills)
					const refreshed = await SkillsApi.getStoreSkills({ page_size: 50 })
					const updatedItems = refreshed.list.map((item) => mapStoreSkill(item, language))
					setRawLibrary(updatedItems)

					const updatedSkill = refreshed.list.find((s) => s.skill_code === skillCode)
					agentSkillId = updatedSkill?.user_skill_code ?? skillCode
				} else {
					// "My Skills" tab: skillCode is already the user's skill code
					agentSkillId = skillCode
				}

				// Step 3: Optimistic local update
				onAddSkill({
					skill_code: agentSkillId,
					name_i18n: buildCrewI18nText(skill.name),
					description_i18n: buildCrewI18nText(skill.description),
					logo: skill.logo,
				})

				// Step 4: Persist via incremental add API (API 6.1)
				await onAddSkillToAgent(agentSkillId)
			} catch (err) {
				// Rollback: remove the skill from local state if it was already added
				if (agentSkillId) onRemoveSkill(agentSkillId)
				const msg = err instanceof Error ? err.message : undefined
				if (msg) magicToast.error(msg)
			} finally {
				setBusy(skillCode, false)
			}
		},
		[
			activeTab,
			displayItems,
			busySkills,
			language,
			onAddSkill,
			onRemoveSkill,
			onAddSkillToAgent,
			setBusy,
		],
	)

	const handleUninstall = useCallback(
		async (skillCode: string) => {
			if (busySkills.has(skillCode)) return

			const skill = displayItems.find((s) => s.skillCode === skillCode)
			// Agent skills are keyed by userSkillCode; fall back to skillCode only when
			// userSkillCode is absent (e.g. a "my-skills" item where they are the same).
			const agentSkillId = skill?.userSkillCode ?? skillCode

			setBusy(skillCode, true)
			// Optimistic local remove before API call
			onRemoveSkill(agentSkillId)
			try {
				// Persist via incremental remove API (API 6.2)
				await onRemoveSkillFromAgent(agentSkillId)
			} catch (err) {
				// Rollback: re-add the skill with its original info
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
		[displayItems, busySkills, onRemoveSkill, onAddSkill, onRemoveSkillFromAgent, setBusy],
	)

	function handleSearch() {
		if (activeTab === "library") {
			void fetchLibrary(searchQuery.trim() || undefined)
		}
	}

	/**
	 * Called after a skill is imported via the import dialog.
	 * Auto-installs the newly imported skill to the current agent,
	 * then switches to "My Skills" tab and refreshes the list.
	 */
	const handleImportSuccess = useCallback(
		async (result: ImportSkillResponse) => {
			await installImportedSkill(result, {
				onInstalled: async () => {
					onTabChange(CREW_SKILLS_TAB.MySkills)
					await fetchMySkills()
				},
			})
		},
		[fetchMySkills, installImportedSkill, onTabChange],
	)

	return {
		activeTab,
		setActiveTab: onTabChange,
		searchQuery,
		setSearchQuery,
		filteredItems,
		loading,
		busySkills,
		handleInstall,
		handleUninstall,
		handleSearch,
		handleImportSuccess,
	}
}
