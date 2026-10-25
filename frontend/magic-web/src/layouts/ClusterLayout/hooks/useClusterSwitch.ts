import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { matchPath, useLocation } from "react-router"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import { useAccount } from "@/stores/authentication"
import { service } from "@/services"
import type { ConfigService } from "@/services/config/ConfigService"
import { ensureClusterConfigReady } from "@/services/config/cluster-config-loader"
import { CommonApi } from "@/apis"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { history } from "@/routes"
import { RouteName } from "@/routes/constants"
import { omit } from "lodash-es"
import { whiteListRoutes } from "@/routes/const/whiteRoutes"
import { refreshAccountContextPage } from "@/broadcastChannel/eventFactory/accountContextRefresh"
import { defaultClusterCode } from "@/routes/helpers"
import { appStore } from "@/stores/app"

type Admission = "pending" | "ready" | "login-required"
const normalizeCluster = (code: string) => (code === defaultClusterCode ? "" : code)

/**
 * Bootstrap owns login; this hook only reconciles the route's target afterwards.
 * Global account/config changes are login outputs, not new route-switch intents.
 */
export function useClusterSwitch({ targetClusterCode }: { targetClusterCode: string }) {
	const { accountSwitch } = useAccount()
	const { pathname } = useLocation()
	const isWhiteListRoute = whiteListRoutes.some((route) => matchPath(route, pathname))
	const target = normalizeCluster(targetClusterCode)
	const [decision, setDecision] = useState<{
		target: string
		publicRoute: boolean
		status: Admission
	}>()
	// Existing account switching is not cancellable. Wait for it before reconciling
	// another target, so this layout cannot run two legacy switches concurrently.
	const pendingSwitch = useRef<Promise<void> | null>(null)
	const setSameCluster = useMemoizedFn((ready: boolean) => {
		setDecision({
			target,
			publicRoute: isWhiteListRoute,
			status: ready ? "ready" : "login-required",
		})
	})

	useEffect(() => {
		const controller = new AbortController()
		const { signal } = controller
		const publish = (status: Admission) => {
			if (!signal.aborted) setDecision({ target, publicRoute: isWhiteListRoute, status })
		}
		async function reconcile() {
			// Read accounts only after the entire AppService flow, including DingTalk
			// auth, has settled. A boolean loading flag does not provide this ordering.
			try {
				// AppService owns failure redirects; its cached result must not veto a
				// later successful login when this route is visited again.
				await appStore.appInitPromise
			} catch (error) {
				if (!signal.aborted) {
					console.error(error)
					publish("login-required")
				}
				return
			}
			const previousSwitch = pendingSwitch.current
			try {
				await previousSwitch
			} catch {
				publish("login-required")
				return
			}
			if (signal.aborted) return

			const current = () => normalizeCluster(configStore.cluster.clusterCode)
			if (current() === target || isWhiteListRoute) {
				publish("ready")
				// A completed switch still needs its account-scoped stores rebuilt,
				// even if navigation superseded the effect that originally started it.
				if (previousSwitch) return refreshAccountContextPage()
				// Preserve the existing public-route configuration behavior without
				// unmounting content while configuration is fetched.
				if (!configStore.cluster.clusterConfig[target]) {
					try {
						const previousCluster = current()
						await ensureClusterConfigReady(target)
						// Config discovery must not overwrite a login completed in the meantime.
						if (!signal.aborted && current() === previousCluster)
							await service.get<ConfigService>("configService").setClusterCode(target)
					} catch (error) {
						console.warn("cluster config sync failed", error)
					}
				}
				return
			}

			try {
				// Keep existing cluster validation, account switching and refresh semantics.
				await CommonApi.getPrivateConfigure(target, {
					skipAppInitWait: true,
					enableErrorMessagePrompt: false,
					enableRequestUnion: true,
				})
				if (signal.aborted) return
				if (target && !configStore.cluster.clusterConfig[target])
					await ensureClusterConfigReady(target)
				if (signal.aborted) return
				if (current() === target) return publish("ready")

				const account = userStore.account.accounts.find(
					(item) =>
						normalizeCluster(item.deployCode).toLowerCase() === target.toLowerCase(),
				)
				if (!account) return publish("login-required")
				const task = accountSwitch(
					account.magic_id,
					account.magic_user_id,
					account.organizationCode,
				)
				pendingSwitch.current = task
				try {
					await task
					if (signal.aborted) return
					publish("ready")
					refreshAccountContextPage()
				} catch (error) {
					if (!signal.aborted) {
						console.error(error)
						publish("login-required")
					}
				} finally {
					if (pendingSwitch.current === task) pendingSwitch.current = null
				}
			} catch (error) {
				if (signal.aborted) return
				console.error(error)
				publish("login-required")
				handleInitError()
			}
		}
		void reconcile()
		return () => controller.abort()
	}, [target, isWhiteListRoute, accountSwitch])

	// Ordinary navigation within the same cluster reuses admission. Only a change
	// of target or access policy blocks the Outlet, never a query/key change.
	const status =
		decision?.target === target && decision.publicRoute === isWhiteListRoute
			? decision.status
			: "pending"
	return { loading: status === "pending", isSameCluster: status === "ready", setSameCluster }
}

/**
 * 处理初始化错误
 * 当集群编码无效时，重定向至对应集群路由或超麦
 */
function handleInitError() {
	const url = new URL(window.location.href)
	const routeMeta = routesMatch(url.pathname)

	if (routeMeta?.route?.name) {
		// 重定向到当前路由但移除集群编码
		history.replace({
			name: routeMeta.route.name,
			params: omit(routeMeta.params, ["clusterCode"]),
			query: convertSearchParams(url.searchParams),
		})
	} else {
		// 重定向到超麦
		history.replace({
			name: RouteName.Super,
		})
	}
}
