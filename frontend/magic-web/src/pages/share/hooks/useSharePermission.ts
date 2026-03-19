import { useState, useMemo, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { useAccount } from "@/models/user/hooks/useAccount"
import { useSwitchOrganization } from "@/hooks/account/useSwitchOrganization"
import { userStore } from "@/models/user"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import { ContactApi } from "@/apis"
import type { User } from "@/types/user"

interface SharePermissionInfo {
	currentOrgName: string
	targetOrgName: string
	targetOrgLogo?: string | null
	userInfo: User.UserInfo | null
}

export function useSharePermission() {
	const { t } = useTranslation("super")
	const { accounts } = useAccount()
	const [requiredOrgCode, setRequiredOrgCode] = useState<string>("")
	const [isSwitching, setIsSwitching] = useState(false)
	const [targetUserInfo, setTargetUserInfo] = useState<User.UserInfo | null>(null)
	const { organizationCode } = userStore.user

	// 查找目标组织信息
	const findTargetOrganization = useMemoizedFn((orgCode: string) => {
		for (const account of accounts) {
			const org = account.organizations?.find((o) => o.magic_organization_code === orgCode)
			if (org) {
				return { account, organization: org }
			}
		}
		return null
	})

	// 组织切换 hook
	const switchOrganization = useSwitchOrganization({
		disabled: false,
		onSwitchAfter: () => {
			window.location.reload()
		},
		onSwitchBefore: () => {
			setIsSwitching(true)
		},
	})

	// 获取目标组织的用户信息
	useEffect(() => {
		async function fetchTargetUserInfo() {
			if (!requiredOrgCode || requiredOrgCode === organizationCode) {
				setTargetUserInfo(null)
				return
			}

			const target = findTargetOrganization(requiredOrgCode)
			if (!target) {
				setTargetUserInfo(null)
				return
			}

			try {
				const userInfo = await ContactApi.getAccountUserInfo({
					organization_code: target.organization.magic_organization_code,
				})

				if (userInfo) {
					setTargetUserInfo({
						magic_id: userInfo.magic_id,
						user_id: userInfo.user_id,
						status: userInfo.status,
						nickname: userInfo.nickname,
						real_name: userInfo.real_name,
						avatar: userInfo.avatar_url,
						organization_code: userInfo.organization_code,
						phone: userInfo.phone,
						email: userInfo.email,
						country_code: userInfo.country_code,
					})
				}
			} catch (error) {
				console.error("Failed to fetch target user info:", error)
				setTargetUserInfo(null)
			}
		}

		fetchTargetUserInfo()
	}, [requiredOrgCode, organizationCode, findTargetOrganization])

	// 切换组织处理函数
	const handleSwitchOrganization = useMemoizedFn(async () => {
		if (!requiredOrgCode || requiredOrgCode === organizationCode) return

		const target = findTargetOrganization(requiredOrgCode)
		if (!target) {
			magicToast.error(t("share.organizationNotFound"))
			return
		}

		try {
			await switchOrganization(target.account, target.organization)
		} catch (error) {
			console.error("Switch organization failed:", error)
			magicToast.error(t("share.switchOrganizationFailed"))
			setIsSwitching(false)
		}
	})

	// 计算显示信息
	const emptyStateInfo = useMemo<SharePermissionInfo | null>(() => {
		if (!requiredOrgCode || requiredOrgCode === organizationCode) return null

		const target = findTargetOrganization(requiredOrgCode)
		if (!target) return null

		const currentOrgCode = userStore.user.organizationCode
		const currentOrg = currentOrgCode
			? userStore.user.organizations?.[Number(currentOrgCode)]
			: null

		return {
			currentOrgName: currentOrg?.organization_name || "",
			targetOrgName: target.organization.organization_name,
			targetOrgLogo: target.organization.organization_logo,
			userInfo: targetUserInfo,
		}
	}, [requiredOrgCode, organizationCode, findTargetOrganization, targetUserInfo])

	return {
		emptyStateInfo,
		handleSwitchOrganization,
		isSwitching,
		setRequiredOrgCode,
	}
}
