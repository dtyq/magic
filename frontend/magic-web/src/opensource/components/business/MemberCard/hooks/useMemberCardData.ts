import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useOrganization } from "@/opensource/models/user/hooks"
import MemberCardStore from "@/opensource/stores/display/MemberCardStore"
import { isAiUser, isNormalUser, generateDescriptionItems } from "../utils/memberCardUtils"
import { getMemberCardTabOptions } from "../config/memberCardConfig"
import { computed } from "mobx"

/**
 * Custom hook for MemberCard data logic
 */
export function useMemberCardData() {
	const { t } = useTranslation("interface")
	const { userInfo } = MemberCardStore
	const { magicOrganizationMap } = useOrganization()

	// Find organization by organization_code
	const organization = useMemo(() => {
		if (!userInfo?.organization_code) return undefined
		return magicOrganizationMap[userInfo.organization_code]
	}, [magicOrganizationMap, userInfo?.organization_code])

	// User type checks
	const userType = userInfo?.user_type
	const isAi = isAiUser(userType)
	const isNormalPerson = isNormalUser(userType)

	// Generate description items based on user type
	const items = useMemo(() => {
		return generateDescriptionItems(userInfo ?? null, organization, t)
	}, [organization, t, userInfo])

	// Tab options for segmented control
	const tabOptions = useMemo(() => {
		return getMemberCardTabOptions(t)
	}, [t])

	// Store state
	const storeState = useMemo(
		() =>
			computed(() => ({
				open: MemberCardStore.open,
				animationDuration: MemberCardStore.animationDuration,
				position: MemberCardStore.position,
				isHover: MemberCardStore.isHover,
			})),
		[],
	).get()

	return {
		// User data
		userInfo,
		organization,
		userType,

		// User type flags
		isAi,
		isNormalPerson,

		// Generated data
		items,
		tabOptions,

		// Store state
		storeState,

		// Store actions
		setIsHover: MemberCardStore.setIsHover,
		closeCard: MemberCardStore.closeCard,
	}
}
