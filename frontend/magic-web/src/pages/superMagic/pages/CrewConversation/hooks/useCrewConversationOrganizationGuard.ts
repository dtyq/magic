import { useEffect, useMemo, useState } from "react"
import { useAccount } from "@/models/user/hooks/useAccount"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { useAuthorization } from "@/models/user/hooks/useAuthorization"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import { useSwitchOrganization } from "@/hooks/account/useSwitchOrganization"
import { awaitAppInitPromise } from "@/app/services/httpService/interceptors/request/waitForAppInit"
import type { User } from "@/types/user"
import { defaultClusterCode } from "@/routes/helpers"
import { useClusterCode } from "@/providers/ClusterProvider"

export type CrewConversationOrganizationGuardStatus = "loading" | "ready" | "switching" | "error"

interface CrewConversationOrganizationTarget {
	account: User.UserAccount
	organization: User.MagicOrganization
}

/** Normalizes public and private deployment codes for stable account matching. */
function normalizeDeploymentCode(deploymentCode: string | null | undefined) {
	const normalizedCode = deploymentCode?.trim().toLowerCase() ?? ""
	return normalizedCode === defaultClusterCode.toLowerCase() ? "" : normalizedCode
}

/** Preserves private deployment casing while mapping the public route to SaaS storage. */
function resolveAccountDeploymentCode(deploymentCode: string) {
	return normalizeDeploymentCode(deploymentCode) ? deploymentCode.trim() : ""
}

/** Finds an organization only from accounts that belong to the requested deployment. */
function findOrganizationTarget(
	accounts: User.UserAccount[],
	magicOrganizationCode: string | null,
	targetDeploymentCode: string,
): CrewConversationOrganizationTarget | null {
	if (!magicOrganizationCode) return null
	const normalizedTargetDeploymentCode = normalizeDeploymentCode(targetDeploymentCode)

	for (const account of accounts) {
		if (normalizeDeploymentCode(account.deployCode) !== normalizedTargetDeploymentCode) {
			continue
		}

		const organization = account.organizations?.find(
			(item) => item.magic_organization_code === magicOrganizationCode,
		)

		if (organization) {
			return { account, organization }
		}
	}

	return null
}

function createCurrentSessionOrganizationTarget(params: {
	magicOrganizationCode: string | null
	organizationCode: string
	magicOrganizationMap: Record<string, User.MagicOrganization>
	teamshareOrganizations: User.UserOrganization[]
	userInfo: User.UserInfo | null
	authorization: string | null
	targetDeploymentCode: string
	currentDeploymentCode: string
}): CrewConversationOrganizationTarget | null {
	const {
		magicOrganizationCode,
		organizationCode,
		magicOrganizationMap,
		teamshareOrganizations,
		userInfo,
		authorization,
		targetDeploymentCode,
		currentDeploymentCode,
	} = params

	if (!magicOrganizationCode || !userInfo) return null
	if (
		normalizeDeploymentCode(currentDeploymentCode) !==
		normalizeDeploymentCode(targetDeploymentCode)
	) {
		return null
	}

	const organization = magicOrganizationMap[magicOrganizationCode]
	if (!organization) return null

	return {
		account: {
			deployCode: resolveAccountDeploymentCode(targetDeploymentCode),
			magic_id: organization.magic_id || userInfo.magic_id,
			magic_user_id: organization.magic_user_id || userInfo.user_id,
			nickname: userInfo.nickname,
			organizationCode: organizationCode || userInfo.organization_code,
			avatar: userInfo.avatar,
			access_token: authorization ?? "",
			organizations: Object.values(magicOrganizationMap),
			teamshareOrganizations,
		},
		organization,
	}
}

/** Ensures the Crew page enters the requested organization without leaving its route deployment. */
export function useCrewConversationOrganizationGuard(
	magicOrganizationCode: string | null,
	targetDeploymentCode: string,
) {
	const { accounts } = useAccount()
	const { clusterCode: currentDeploymentCode } = useClusterCode()
	const { authorization } = useAuthorization()
	const { userInfo } = useUserInfo()
	const { organizationCode, organizations, magicOrganizationMap, organizationListReady } =
		useOrganization()
	const [status, setStatus] = useState<CrewConversationOrganizationGuardStatus>("loading")
	const [appInitReady, setAppInitReady] = useState(false)
	const [error, setError] = useState<unknown>(null)
	const switchOrganization = useSwitchOrganization({
		disabled: false,
	})

	// Wait for app init (login flow) to complete before executing guard logic
	useEffect(() => {
		let isActive = true

		void awaitAppInitPromise().then(() => {
			if (isActive) setAppInitReady(true)
		})

		return () => {
			isActive = false
		}
	}, [])

	const hasRouteOrganization = Boolean(magicOrganizationCode)
	const isCurrentDeploymentMatched =
		normalizeDeploymentCode(currentDeploymentCode) ===
		normalizeDeploymentCode(targetDeploymentCode)

	const target = useMemo(() => {
		if (!appInitReady || !isCurrentDeploymentMatched) return null

		return (
			findOrganizationTarget(accounts, magicOrganizationCode, targetDeploymentCode) ??
			createCurrentSessionOrganizationTarget({
				magicOrganizationCode,
				organizationCode,
				magicOrganizationMap,
				teamshareOrganizations: organizations,
				userInfo,
				authorization,
				targetDeploymentCode,
				currentDeploymentCode,
			})
		)
	}, [
		appInitReady,
		accounts,
		authorization,
		currentDeploymentCode,
		isCurrentDeploymentMatched,
		magicOrganizationCode,
		magicOrganizationMap,
		organizationCode,
		organizations,
		targetDeploymentCode,
		userInfo,
	])

	const isCurrentOrganizationMatched = useMemo(() => {
		if (!appInitReady) return false
		if (!hasRouteOrganization) return true

		if (magicOrganizationCode && organizationCode === magicOrganizationCode) {
			return true
		}

		return Boolean(target && organizationCode === target.organization.magic_organization_code)
	}, [appInitReady, hasRouteOrganization, magicOrganizationCode, organizationCode, target])

	useEffect(() => {
		if (!appInitReady) {
			setStatus("loading")
			return
		}

		if (!isCurrentDeploymentMatched) {
			setStatus("switching")
			setError(null)
			return
		}

		if (!hasRouteOrganization || isCurrentOrganizationMatched) {
			setStatus("ready")
			setError(null)
			return
		}

		if (!target) {
			if (!organizationListReady) {
				setStatus("switching")
				setError(null)
				return
			}

			setStatus("error")
			setError(new Error("crew-conversation-organization-not-found"))
			return
		}

		let isActive = true

		setStatus("switching")
		setError(null)

		void switchOrganization(target.account, target.organization)
			.then(() => {
				if (!isActive) return
				setStatus("ready")
			})
			.catch((nextError) => {
				if (!isActive) return
				setStatus("error")
				setError(nextError)
			})

		return () => {
			isActive = false
		}
	}, [
		appInitReady,
		hasRouteOrganization,
		isCurrentDeploymentMatched,
		isCurrentOrganizationMatched,
		organizationListReady,
		switchOrganization,
		target,
	])

	return {
		status,
		error,
		isReady: status === "ready",
	}
}
