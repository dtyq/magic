import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router"
import { userStore } from "@/models/user"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import {
	buildMySkillsQuery,
	getMySkillsAvailableTabs,
	getMySkillsPublishPromptSkillCode,
	getMySkillsRequestedTab,
	MY_SKILLS_TAB_SCOPE_MAP,
	MY_SKILLS_TAB_VALUES,
	normalizeMySkillsTabValue,
	type MySkillsTabValue,
} from "../route-state"

export interface MySkillsTabItem {
	value: MySkillsTabValue
	labelKey: string
	testId: string
}

interface UseMySkillsTabsParams {
	variant: "desktop" | "mobile"
}

function buildMySkillsTabItems(variant: UseMySkillsTabsParams["variant"]): MySkillsTabItem[] {
	if (variant === "mobile") {
		return [
			{
				value: MY_SKILLS_TAB_VALUES.createdByMe,
				labelKey: "mySkills.tabs.createdByMe",
				testId: "my-skills-mobile-tab-created-by-me",
			},
			{
				value: MY_SKILLS_TAB_VALUES.sharedByTeam,
				labelKey: "mySkills.tabs.sharedByTeam",
				testId: "my-skills-mobile-tab-shared-by-team",
			},
			{
				value: MY_SKILLS_TAB_VALUES.fromSkillsLibrary,
				labelKey: "mySkills.tabs.fromSkillsLibrary",
				testId: "my-skills-mobile-tab-from-skills-library",
			},
		]
	}

	return [
		{
			value: MY_SKILLS_TAB_VALUES.createdByMe,
			labelKey: "mySkills.tabs.createdByMe",
			testId: "my-skills-tab-created-by-me",
		},
		{
			value: MY_SKILLS_TAB_VALUES.sharedByTeam,
			labelKey: "mySkills.tabs.sharedByTeam",
			testId: "my-skills-tab-shared-by-team",
		},
		{
			value: MY_SKILLS_TAB_VALUES.fromSkillsLibrary,
			labelKey: "mySkills.tabs.fromSkillsLibrary",
			testId: "my-skills-tab-from-skills-library",
		},
	]
}

export function useMySkillsTabs({ variant }: UseMySkillsTabsParams) {
	const navigate = useNavigate()
	const location = useLocation()
	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const [activeTabState, setActiveTabState] = useState<MySkillsTabValue>(() =>
		normalizeMySkillsTabValue(getMySkillsRequestedTab(location.search), isPersonalOrganization),
	)
	const [publishPromptSkillCode, setPublishPromptSkillCode] = useState<string | null>(null)
	const activeTab = normalizeMySkillsTabValue(activeTabState, isPersonalOrganization)
	const currentScope = MY_SKILLS_TAB_SCOPE_MAP[activeTab]
	const availableTabs = useMemo(
		() => getMySkillsAvailableTabs(isPersonalOrganization),
		[isPersonalOrganization],
	)
	const availableTabSet = useMemo(() => new Set(availableTabs), [availableTabs])
	const tabItems = useMemo(
		() =>
			buildMySkillsTabItems(variant).filter((tabItem) => availableTabSet.has(tabItem.value)),
		[availableTabSet, variant],
	)

	useEffect(() => {
		const requestedTab = getMySkillsRequestedTab(location.search)
		const requestedPublishPromptSkillCode = getMySkillsPublishPromptSkillCode(location.search)
		if (!requestedTab && !requestedPublishPromptSkillCode) return

		if (requestedTab) {
			setActiveTabState(normalizeMySkillsTabValue(requestedTab, isPersonalOrganization))
		}
		if (requestedPublishPromptSkillCode) {
			setPublishPromptSkillCode(requestedPublishPromptSkillCode)
		}
		navigate({
			name: RouteName.MySkills,
			query: buildMySkillsQuery({
				search: location.search,
				tab: null,
				publishSkillCode: null,
			}),
			replace: true,
		})
	}, [isPersonalOrganization, location.search, navigate])

	useEffect(() => {
		if (activeTab === activeTabState) return
		setActiveTabState(activeTab)
	}, [activeTab, activeTabState])

	const setActiveTab = useCallback(
		(nextTab: MySkillsTabValue) => {
			setActiveTabState(normalizeMySkillsTabValue(nextTab, isPersonalOrganization))
		},
		[isPersonalOrganization],
	)

	const handleTabValueChange = useCallback(
		(nextTab: string) => {
			setActiveTab(nextTab as MySkillsTabValue)
		},
		[setActiveTab],
	)

	const setCreatedByMeTab = useCallback(() => {
		setActiveTab(MY_SKILLS_TAB_VALUES.createdByMe)
	}, [setActiveTab])

	return {
		activeTab,
		currentScope,
		publishPromptSkillCode,
		setPublishPromptSkillCode,
		tabItems,
		handleTabValueChange,
		setActiveTab,
		setCreatedByMeTab,
		tabCount: tabItems.length,
		isCreatedByMeTab: activeTab === MY_SKILLS_TAB_VALUES.createdByMe,
		isFromSkillsLibraryTab: activeTab === MY_SKILLS_TAB_VALUES.fromSkillsLibrary,
	}
}
