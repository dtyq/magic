import type { UserSkillsListScope } from "@/services/skills/SkillsService"
import { convertSearchParams } from "@/routes/history/helpers"

export const MY_SKILLS_INITIAL_TAB_QUERY_KEY = "tab"
export const MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY = "publishSkillCode"

export const MY_SKILLS_TAB_VALUES = {
	createdByMe: "created-by-me",
	sharedByTeam: "shared-by-team",
	fromSkillsLibrary: "from-skills-library",
} as const

export type MySkillsTabValue = (typeof MY_SKILLS_TAB_VALUES)[keyof typeof MY_SKILLS_TAB_VALUES]

export const MY_SKILLS_TAB_SCOPE_MAP: Record<MySkillsTabValue, UserSkillsListScope> = {
	[MY_SKILLS_TAB_VALUES.createdByMe]: "created",
	[MY_SKILLS_TAB_VALUES.sharedByTeam]: "team-shared",
	[MY_SKILLS_TAB_VALUES.fromSkillsLibrary]: "market-installed",
}

export function getMySkillsRequestedTab(search: string): MySkillsTabValue | null {
	const tab = new URLSearchParams(search).get(MY_SKILLS_INITIAL_TAB_QUERY_KEY)

	if (!tab) return null
	if (Object.values(MY_SKILLS_TAB_VALUES).includes(tab as MySkillsTabValue)) {
		return tab as MySkillsTabValue
	}

	return null
}

export function getMySkillsPublishPromptSkillCode(search: string): string | null {
	const skillCode = new URLSearchParams(search).get(MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY)
	return skillCode?.trim() || null
}

export function buildMySkillsQuery({
	search,
	tab,
	publishSkillCode,
}: {
	search: string
	tab: MySkillsTabValue | null
	publishSkillCode?: string | null
}) {
	const searchParams = new URLSearchParams(search)
	if (tab) searchParams.set(MY_SKILLS_INITIAL_TAB_QUERY_KEY, tab)
	else searchParams.delete(MY_SKILLS_INITIAL_TAB_QUERY_KEY)

	if (publishSkillCode) {
		searchParams.set(MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY, publishSkillCode)
	} else {
		searchParams.delete(MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY)
	}

	const query = convertSearchParams(searchParams)
	return Object.keys(query).length > 0 ? query : undefined
}
