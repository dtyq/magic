import { useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { Outlet } from "react-router"
import {
	Language,
	RuntimeMode,
	RuntimeProvider,
	type AccountInfo,
	type BridgeConfig,
	type OrganizationInfo,
} from "@dtyq/magic-admin-v2"
import "@dtyq/magic-admin-v2/embedded.css"
import { useSwitchOrganization } from "@/hooks/account/useSwitchOrganization"
import useLogout from "@/hooks/account/useLogout"
import openAccountModal from "@/pages/login/AccountModal"
import {
	setGlobalLanguage,
	useClusterConfig,
	useGlobalLanguage,
	useTheme,
} from "@/models/config/hooks"
import { useAccount, useAuthorization, useOrganization, useUserInfo } from "@/models/user/hooks"
import { userStore } from "@/models/user"
import { apiClients } from "@/pages/magicAdminV2/edition"
import { uploadFile, uploadPublicImage } from "@/pages/magicAdminV2/upload"
import { useAuthorizationState } from "@/pages/magicAdminV2/useAuthorizationState"
import { globalConfigStore } from "@/stores/globalConfig"
import { useClusterCode } from "@/providers/ClusterProvider"
import type { User } from "@/types/user"

const capabilities = { uploadFile, uploadPublicImage }

/**
 * Keep admin-v2 organization order consistent with the host organization switcher.
 * The host renders teamshareOrganizations (personal organization first), while the
 * Magic organization list is built from a separate auth_status response.
 */
function getOrderedMagicOrganizations(account: User.UserAccount) {
	const teamshareOrganizations = [...(account.teamshareOrganizations ?? [])].sort((a, b) => {
		if (a.is_personal_organization) return -1
		if (b.is_personal_organization) return 1
		return 0
	})
	const teamshareOrder = new Map(
		teamshareOrganizations.map((organization, index) => [
			organization.organization_code,
			index,
		]),
	)

	return [...account.organizations].sort(
		(a, b) =>
			(teamshareOrder.get(a.third_platform_organization_code) ?? Infinity) -
			(teamshareOrder.get(b.third_platform_organization_code) ?? Infinity),
	)
}

function MagicAdminEmbeddedLayout() {
	const { authorization } = useAuthorization()
	const { userInfo } = useUserInfo()
	const { accounts } = useAccount()
	const {
		organizationCode,
		organizations: teamshareOrganizations,
		teamshareOrganizationCode,
	} = useOrganization()
	const { prefersColorScheme } = useTheme()
	const { setClusterCode } = useClusterCode()
	const { clustersConfig } = useClusterConfig()
	const language = useGlobalLanguage(false)
	const switchOrganization = useSwitchOrganization({ disabled: false })
	const logout = useLogout()
	const currentAccount = useMemo(
		() => accounts.find((account) => account.magic_id === userInfo?.magic_id),
		[accounts, userInfo?.magic_id],
	)
	const teamshareOrganizationMap = useMemo(
		() =>
			new Map(
				teamshareOrganizations.map((organization) => [
					organization.organization_code,
					organization,
				]),
			),
		[teamshareOrganizations],
	)
	const organizationOptions = useMemo<OrganizationInfo[]>(
		() =>
			(currentAccount ? getOrderedMagicOrganizations(currentAccount) : []).map(
				(organization) => {
					const teamshareOrganization = teamshareOrganizationMap.get(
						organization.third_platform_organization_code,
					)
					return {
						organizationCode: organization.magic_organization_code,
						teamshareOrganizationCode: organization.third_platform_organization_code,
						logo:
							organization.organization_logo ||
							teamshareOrganization?.organization_logo?.[0]?.url,
						name:
							teamshareOrganization?.organization_name ||
							organization.organization_name ||
							organization.magic_organization_code,
					}
				},
			),
		[
			currentAccount?.organizations,
			currentAccount?.teamshareOrganizations,
			teamshareOrganizationMap,
		],
	)
	const accountOptions = useMemo<AccountInfo[]>(
		() =>
			accounts.map((account) => {
				const accountTeamshareOrganizations = new Map(
					account.teamshareOrganizations.map((organization) => [
						organization.organization_code,
						organization,
					]),
				)
				return {
					accountId: account.magic_id,
					name: account.nickname || account.magic_id,
					avatar: account.avatar || undefined,
					deployCode: account.deployCode,
					platformName: clustersConfig?.[account.deployCode]?.name,
					organizations: getOrderedMagicOrganizations(account).map((organization) => {
						const teamshareOrganization = accountTeamshareOrganizations.get(
							organization.third_platform_organization_code,
						)
						return {
							organizationCode: organization.magic_organization_code,
							teamshareOrganizationCode:
								organization.third_platform_organization_code,
							logo:
								organization.organization_logo ||
								teamshareOrganization?.organization_logo?.[0]?.url,
							name:
								teamshareOrganization?.organization_name ||
								organization.organization_name ||
								organization.magic_organization_code,
						}
					}),
				}
			}),
		[accounts, clustersConfig],
	)
	const currentMagicOrganization = currentAccount?.organizations.find(
		(organization) => organization.magic_organization_code === organizationCode,
	)
	const currentTeamshareOrganization = teamshareOrganizationMap.get(
		currentMagicOrganization?.third_platform_organization_code || teamshareOrganizationCode,
	)
	const currentTeamshareOrganizationLogo =
		currentTeamshareOrganization?.organization_logo?.[0]?.url
	const currentOrganizationLogo =
		currentMagicOrganization?.organization_logo || currentTeamshareOrganizationLogo
	const currentOrganization = useMemo<OrganizationInfo>(
		() => ({
			organizationCode,
			teamshareOrganizationCode:
				currentMagicOrganization?.third_platform_organization_code ||
				teamshareOrganizationCode,
			logo: currentOrganizationLogo,
			name:
				currentTeamshareOrganization?.organization_name ||
				currentMagicOrganization?.organization_name ||
				organizationCode,
		}),
		[
			currentMagicOrganization?.organization_name,
			currentMagicOrganization?.third_platform_organization_code,
			currentTeamshareOrganization?.organization_name,
			currentOrganizationLogo,
			organizationCode,
			teamshareOrganizationCode,
		],
	)
	const handleSwitchOrganization = useCallback(
		async (nextOrganizationCode: string) => {
			const targetOrganization = currentAccount?.organizations.find(
				(organization) => organization.magic_organization_code === nextOrganizationCode,
			)
			if (!currentAccount || !targetOrganization) {
				throw new Error("Target organization not found")
			}
			await switchOrganization(currentAccount, targetOrganization)
		},
		[currentAccount, switchOrganization],
	)
	const handleSwitchAccountOrganization = useCallback(
		async (accountId: string, nextOrganizationCode: string) => {
			const targetAccount = accounts.find((account) => account.magic_id === accountId)
			const targetOrganization = targetAccount?.organizations.find(
				(organization) => organization.magic_organization_code === nextOrganizationCode,
			)
			if (!targetAccount || !targetOrganization) {
				throw new Error("Target account or organization not found")
			}
			await switchOrganization(targetAccount, targetOrganization)
		},
		[accounts, switchOrganization],
	)

	const handleAddAccount = useCallback(() => {
		openAccountModal({
			onClusterChange: (nextClusterCode) => setClusterCode(nextClusterCode),
		})
	}, [setClusterCode])

	const handleLogoutAccount = useCallback(
		async (accountId: string) => {
			const targetAccount = accounts.find((account) => account.magic_id === accountId)
			if (targetAccount) await logout(targetAccount)
		},
		[accounts, logout],
	)
	const handleLanguageChange = useCallback((nextLanguage: Language) => {
		setGlobalLanguage(nextLanguage)
	}, [])
	const auth = useAuthorizationState({
		authorization,
		isPersonalOrganization: userStore.user.isPersonalOrganization,
		organizationCode,
		userId: userInfo?.user_id,
	})
	const platformInfo = globalConfigStore.globalConfig
	const config = useMemo<BridgeConfig>(
		() => ({
			mode: RuntimeMode.Embedded,
			apiClients,
			capabilities,
			auth,
			user: userInfo
				? {
						id: userInfo.user_id,
						name: userInfo.real_name || userInfo.nickname || userInfo.user_id,
						avatar: userInfo.avatar || undefined,
					}
				: null,
			organization: {
				current: currentOrganization,
				organizations:
					organizationOptions.length > 0 ? organizationOptions : [currentOrganization],
				switchOrganization: handleSwitchOrganization,
			},
			account: {
				current: currentAccount
					? accountOptions.find(
							(account) => account.accountId === currentAccount.magic_id,
						) || null
					: null,
				accounts: accountOptions,
				switchAccountOrganization: handleSwitchAccountOrganization,
				addAccount: handleAddAccount,
				logoutAccount: handleLogoutAccount,
			},
			language: resolveLanguage(language),
			onLanguageChange: handleLanguageChange,
			theme: prefersColorScheme === "dark" ? "dark" : "light",
			platformInfo,
		}),
		[
			accountOptions,
			auth,
			currentAccount,
			currentOrganization,
			handleAddAccount,
			handleLogoutAccount,
			handleSwitchAccountOrganization,
			handleSwitchOrganization,
			handleLanguageChange,
			language,
			organizationOptions,
			prefersColorScheme,
			platformInfo,
			userInfo,
		],
	)

	return (
		<RuntimeProvider {...config}>
			<Outlet />
		</RuntimeProvider>
	)
}

function resolveLanguage(language: string): Language {
	return language === Language.EnUS ? Language.EnUS : Language.ZhCN
}

export default observer(MagicAdminEmbeddedLayout)
