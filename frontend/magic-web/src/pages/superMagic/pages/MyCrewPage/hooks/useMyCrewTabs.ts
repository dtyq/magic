import { useCallback, useEffect, useMemo, useState } from "react"
import { userStore } from "@/models/user"
import {
	getMyCrewAvailableTabs,
	MY_CREW_TAB_VALUES,
	normalizeMyCrewTabValue,
	type MyCrewCrewTypeTab,
} from "../tab-state"

interface UseMyCrewTabsParams {
	includeTeamShared?: boolean
}

export function useMyCrewTabs({ includeTeamShared = false }: UseMyCrewTabsParams = {}) {
	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const [activeTabState, setActiveTabState] = useState<MyCrewCrewTypeTab>(
		MY_CREW_TAB_VALUES.created,
	)
	const availableTabs = useMemo(
		() =>
			getMyCrewAvailableTabs({
				includeTeamShared,
				isPersonalOrganization,
			}),
		[includeTeamShared, isPersonalOrganization],
	)
	const crewTypeTab = normalizeMyCrewTabValue(activeTabState, {
		includeTeamShared,
		isPersonalOrganization,
	})

	useEffect(() => {
		if (crewTypeTab === activeTabState) return
		setActiveTabState(crewTypeTab)
	}, [activeTabState, crewTypeTab])

	const setCrewTypeTab = useCallback(
		(nextTab: MyCrewCrewTypeTab) => {
			setActiveTabState(
				normalizeMyCrewTabValue(nextTab, {
					includeTeamShared,
					isPersonalOrganization,
				}),
			)
		},
		[includeTeamShared, isPersonalOrganization],
	)

	return {
		crewTypeTab,
		setCrewTypeTab,
		availableTabs,
		includeTeamShared: availableTabs.includes(MY_CREW_TAB_VALUES.teamShared),
		isCreatedTab: crewTypeTab === MY_CREW_TAB_VALUES.created,
		isTeamSharedTab: crewTypeTab === MY_CREW_TAB_VALUES.teamShared,
		isHiredTab: crewTypeTab === MY_CREW_TAB_VALUES.hired,
	}
}
