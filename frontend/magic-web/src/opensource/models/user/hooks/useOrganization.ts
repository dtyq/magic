import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/opensource/models/user"

/**
 * 获取当前用户信息
 */
export function useOrganization() {
	const [organizationMeta, setOrganizationMeta] = useState({
		organizations: userStore.user.organizations,
		organizationCode: userStore.user.organizationCode,
		magicOrganizationMap: userStore.user.magicOrganizationMap,
		teamshareOrganizationCode: userStore.user.teamshareOrganizationCode,
	})

	useEffect(() => {
		return reaction(
			() => ({
				organizationCode: userStore.user.organizationCode,
				organizations: userStore.user.organizations,
				magicOrganizationMap: userStore.user.magicOrganizationMap,
				teamshareOrganizationCode: userStore.user.teamshareOrganizationCode,
			}),
			(org) => setOrganizationMeta(org),
			{
				fireImmediately: true,
			},
		)
	}, [])

	return {
		organizationCode: organizationMeta.organizationCode,
		organizations: organizationMeta.organizations,
		magicOrganizationMap: organizationMeta.magicOrganizationMap,
		teamshareOrganizationCode: organizationMeta.teamshareOrganizationCode,
	}
}
