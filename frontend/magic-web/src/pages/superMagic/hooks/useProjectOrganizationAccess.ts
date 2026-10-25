import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { awaitAppInitPromise } from "@/app/services/httpService/interceptors/request/waitForAppInit"
import { ContactApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { useSwitchOrganization } from "@/hooks/account/useSwitchOrganization"
import { useAccount, useOrganization, useUserInfo } from "@/models/user/hooks"
import { userTransformer } from "@/models/user/transformers"
import { useTranslation } from "react-i18next"
import { reaction } from "mobx"
import type { User } from "@/types/user"
import { interfaceStore } from "@/stores/interface"
import {
	findProjectOrganizationTarget,
	resolveRequiredProjectOrganizationCode,
	suppressProjectOrganizationAccessCheckForCurrentRoute,
} from "../services/projectOrganizationAccess"
import type {
	ProjectOrganizationAccessContextValue,
	ProjectOrganizationAccessStatus,
} from "../contexts/ProjectOrganizationAccessContext"

/**
 * Gates normal project routes before their project/topic loaders mount. The accessibility endpoint is
 * intentionally fail-open so a transient lookup error retains the established project-route behavior.
 */
export function useProjectOrganizationAccess(
	projectId?: string,
): ProjectOrganizationAccessContextValue {
	const { t } = useTranslation("super")
	const { accounts } = useAccount()
	const { organizationCode, organizationListReady } = useOrganization()
	const { userInfo } = useUserInfo()
	const [appInitReady, setAppInitReady] = useState(false)
	const [requiredOrganizationCode, setRequiredOrganizationCode] = useState<string | null>(null)
	const [isCheckingAccessibility, setIsCheckingAccessibility] = useState(true)
	const [checkedAccessKey, setCheckedAccessKey] = useState<string | null>(null)
	const [isSwitching, setIsSwitching] = useState(false)
	const [targetUserInfo, setTargetUserInfo] = useState<User.UserInfo | null>(null)

	useEffect(
		() =>
			reaction(
				() => interfaceStore.isSwitchingOrganization,
				(isSwitchingOrganization) => {
					if (isSwitchingOrganization) {
						suppressProjectOrganizationAccessCheckForCurrentRoute()
					}
				},
			),
		[],
	)

	useEffect(() => {
		let isActive = true
		void awaitAppInitPromise().then(() => {
			if (isActive) setAppInitReady(true)
		})
		return () => {
			isActive = false
		}
	}, [])

	useEffect(() => {
		if (!appInitReady) return
		const accessKey = `${organizationCode || ""}:${projectId || ""}`
		if (!projectId) {
			setRequiredOrganizationCode(null)
			setIsCheckingAccessibility(false)
			setCheckedAccessKey(accessKey)
			return
		}

		let isActive = true
		setIsCheckingAccessibility(true)
		setRequiredOrganizationCode(null)

		void resolveRequiredProjectOrganizationCode({
			projectId,
			currentOrganizationCode: organizationCode,
		})
			.then((requiredCode) => {
				if (!isActive) return
				setRequiredOrganizationCode(requiredCode)
			})
			.finally(() => {
				if (isActive) {
					setCheckedAccessKey(accessKey)
					setIsCheckingAccessibility(false)
				}
			})

		return () => {
			isActive = false
		}
	}, [appInitReady, organizationCode, projectId])

	const currentAccessKey = `${organizationCode || ""}:${projectId || ""}`

	const target = useMemo(
		() =>
			findProjectOrganizationTarget(
				accounts,
				requiredOrganizationCode,
				userInfo?.magic_id ?? null,
			),
		[accounts, requiredOrganizationCode, userInfo?.magic_id],
	)
	const targetOrganizationCode = target?.organization.magic_organization_code

	useEffect(() => {
		let isActive = true
		setTargetUserInfo(null)

		if (!targetOrganizationCode) return () => undefined

		// Fetch the current user's identity in the destination organization so both switch screens
		// present the same avatar-and-name context before changing organizations.
		void ContactApi.getAccountUserInfo({ organization_code: targetOrganizationCode })
			.then((userInfo) => {
				if (isActive && userInfo) setTargetUserInfo(userTransformer(userInfo))
			})
			.catch((error) => {
				console.error("Failed to fetch shared-project target user info:", error)
			})

		return () => {
			isActive = false
		}
	}, [targetOrganizationCode])

	const switchOrganization = useSwitchOrganization({
		disabled: false,
		onSwitchBefore: () => setIsSwitching(true),
		onSwitchAfter: () => window.location.reload(),
	})

	const handleSwitchOrganization = useMemoizedFn(async () => {
		if (!target) return

		try {
			await switchOrganization(target.account, target.organization)
		} catch (error) {
			console.error("Failed to switch organization for shared project:", error)
			magicToast.error(t("collaborators.organizationSwitch.failed"))
			setIsSwitching(false)
		}
	})

	const status: ProjectOrganizationAccessStatus = useMemo(() => {
		if (!projectId) return "ready"
		if (!appInitReady || checkedAccessKey !== currentAccessKey || isCheckingAccessibility) {
			return "loading"
		}
		if (!requiredOrganizationCode) return "ready"
		if (isSwitching) return "switching"
		if (!target && !organizationListReady) return "loading"
		return target ? "switch-required" : "ready"
	}, [
		appInitReady,
		checkedAccessKey,
		currentAccessKey,
		isCheckingAccessibility,
		isSwitching,
		organizationListReady,
		projectId,
		requiredOrganizationCode,
		target,
	])

	return {
		status,
		targetOrganization: target?.organization ?? null,
		targetUserInfo,
		handleSwitchOrganization,
	}
}
