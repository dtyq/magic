import { useEffect, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/models/user"

/**
 * 获取当前用户信息
 */
export function useOrganization() {
	const [organizationMeta, setOrganizationMeta] = useState({
		organizations: userStore.user.organizations,
		organizationCode: userStore.user.organizationCode,
		magicOrganizationMap: userStore.user.magicOrganizationMap,
		teamshareOrganizationCode: userStore.user.teamshareOrganizationCode,
		organizationListReady: userStore.user.organizationListReady,
		isPersonalOrganization: userStore.user.isPersonalOrganization,
	})

	useEffect(() => {
		return reaction(
			() => ({
				organizationCode: userStore.user.organizationCode,
				organizations: userStore.user.organizations,
				magicOrganizationMap: userStore.user.magicOrganizationMap,
				teamshareOrganizationCode: userStore.user.teamshareOrganizationCode,
				organizationListReady: userStore.user.organizationListReady,
				// 与其余字段一同订阅：个人版 / 团队组织决定若干功能的可见性，读它的人不该
				// 只拿到挂载那一刻的值。
				isPersonalOrganization: userStore.user.isPersonalOrganization,
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
		organizationListReady: organizationMeta.organizationListReady,
		isPersonalOrganization: organizationMeta.isPersonalOrganization,
	}
}
