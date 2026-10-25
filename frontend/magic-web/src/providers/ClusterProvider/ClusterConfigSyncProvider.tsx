import type { PropsWithChildren } from "react"
import { useState } from "react"
import { userStore } from "@/models/user"
import { service } from "@/services"
import type { LoginService } from "@/services/user/LoginService"
import { useMount, useDebounceFn } from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import { useClusterCode } from "@/providers/ClusterProvider"
import { useTranslation } from "react-i18next"

/**
 * Synchronizes cluster configuration before rendering its children.
 */
export function ClusterConfigSyncProvider(props: PropsWithChildren) {
	const { children } = props

	const [loading, setLoading] = useState(true)

	const { t } = useTranslation("interface")
	const { setClusterCode } = useClusterCode()

	/**
	 * Synchronizes environment configuration for an authenticated user.
	 * @param access_token The user's authorization token.
	 */
	const { run: onUserLoginChange } = useDebounceFn(
		async (access_token: string | null) => {
			try {
				if (access_token) {
					const { clusterCode } = await service
						.get<LoginService>("loginService")
						.syncClusterConfig()
					setClusterCode(clusterCode)
				}
			} catch (error) {
				console.error(error)
			} finally {
				setLoading(false)
				// Keep redirects out of configuration synchronization.
			}
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	// Synchronize user, organization, environment, and authorization state after login.
	useMount(() => {
		const { authorization } = userStore.user
		if (authorization) {
			onUserLoginChange(authorization)?.catch(console.error)
		} else {
			setLoading(false)
		}
	})

	return loading ? (
		<MagicSpin spinning tip={t("spin.loadingCluster")}>
			<div className="h-screen" />
		</MagicSpin>
	) : (
		children
	)
}
