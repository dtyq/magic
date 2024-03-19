import {
	AdminProvider,
	AppEnv,
	LanguageType,
	AdminProviderProps,
	AdminComponentsProvider,
} from "@dtyq/magic-admin"
import { Navigate } from "react-router"
import { useMemo, PropsWithChildren } from "react"
import { useAreaCodes, useGlobalLanguage, useTheme } from "@/opensource/models/config/hooks"
import { observer } from "mobx-react-lite"
import magicClient from "@/opensource/apis/clients/magic"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { userStore } from "@/opensource/models/user"
import { isPrivateDeployment, env } from "@/opensource/utils/env"
import {
	useOrganization,
	useAccount,
	useCurrentMagicOrganization,
} from "@/opensource/models/user/hooks"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useSafeArea } from "@/opensource/providers/AppearanceProvider/hooks/useSafeArea"
import { ThemeType } from "@dtyq/magic-admin/components"

const MagicAdminProvider = observer(({ children }: PropsWithChildren) => {
	const { prefersColorScheme } = useTheme()
	const safeArea = useSafeArea()
	const organizationInfo = useCurrentMagicOrganization()
	const { accounts } = useAccount()
	const { areaCodes } = useAreaCodes()
	const { clusterCode } = useClusterCode()
	const { organizationCode } = useOrganization()
	const navigate = useNavigate()

	const { userInfo, isPersonalOrganization, authorization } = userStore.user

	const currentTsUserId = useMemo(() => {
		const account = accounts.find((account) => account.magic_id === userInfo?.magic_id)
		return account?.organizations.find(
			(organization) => organization.magic_organization_code === userInfo?.organization_code,
		)?.third_platform_user_id
	}, [accounts, userInfo])

	const lang = useGlobalLanguage(false)

	const config: AdminProviderProps = useMemo(
		() => ({
			language: lang as LanguageType,
			theme: prefersColorScheme,
			apiClients: {
				magicClient: magicClient as any,
			},
			clusterCode,
			isPersonalOrganization,
			isPrivateDeployment: isPrivateDeployment(),
			organization: {
				organizationCode,
				organizationInfo,
			},
			user: {
				token: authorization,
				userInfo: userInfo
					? {
							id: currentTsUserId,
							...userInfo,
						}
					: null,
				teamshareUserInfo: null,
			},
			env: {
				MAGIC_APP_ENV: env("MAGIC_APP_ENV") as AppEnv,
				MAGIC_BASE_URL: env("MAGIC_SERVICE_BASE_URL"),
			},
			areaCodes,
			navigate,
			Navigate,
			safeAreaInset: {
				top: safeArea.safeAreaInsetTop,
				bottom: safeArea.safeAreaInsetBottom,
			},
		}),
		[
			lang,
			prefersColorScheme,
			clusterCode,
			isPersonalOrganization,
			organizationCode,
			organizationInfo,
			authorization,
			userInfo,
			currentTsUserId,
			areaCodes,
			navigate,
			safeArea.safeAreaInsetTop,
			safeArea.safeAreaInsetBottom,
		],
	)

	return (
		<AdminProvider {...config}>
			<AdminComponentsProvider
				language={lang as LanguageType}
				theme={prefersColorScheme as ThemeType}
			>
				{children}
			</AdminComponentsProvider>
		</AdminProvider>
	)
})

export default MagicAdminProvider
