export const MY_CREW_TAB_VALUES = {
	created: "created",
	teamShared: "team-shared",
	hired: "hired",
} as const

export type MyCrewCrewTypeTab = (typeof MY_CREW_TAB_VALUES)[keyof typeof MY_CREW_TAB_VALUES]

const MY_CREW_DEFAULT_TAB = MY_CREW_TAB_VALUES.created
const MY_CREW_BASE_TAB_VALUES: MyCrewCrewTypeTab[] = [
	MY_CREW_TAB_VALUES.created,
	MY_CREW_TAB_VALUES.hired,
]
const MY_CREW_TEAM_TAB_VALUES: MyCrewCrewTypeTab[] = [
	MY_CREW_TAB_VALUES.created,
	MY_CREW_TAB_VALUES.teamShared,
	MY_CREW_TAB_VALUES.hired,
]

interface GetMyCrewAvailableTabsParams {
	includeTeamShared: boolean
	isPersonalOrganization: boolean
}

export function getMyCrewAvailableTabs({
	includeTeamShared,
	isPersonalOrganization,
}: GetMyCrewAvailableTabsParams): MyCrewCrewTypeTab[] {
	if (!includeTeamShared || isPersonalOrganization) return MY_CREW_BASE_TAB_VALUES
	return MY_CREW_TEAM_TAB_VALUES
}

export function normalizeMyCrewTabValue(
	tab: MyCrewCrewTypeTab | null | undefined,
	params: GetMyCrewAvailableTabsParams,
): MyCrewCrewTypeTab {
	const availableTabs = getMyCrewAvailableTabs(params)
	if (tab && availableTabs.includes(tab)) return tab
	return MY_CREW_DEFAULT_TAB
}
