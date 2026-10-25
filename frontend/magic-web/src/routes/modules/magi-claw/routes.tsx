import { lazy, useEffect, type ReactNode } from "react"
import type { RouteObject } from "react-router"
import { useTranslation } from "react-i18next"

import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { RoutePath } from "@/constants/routes"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { Button } from "@/components/shadcn-ui/button"
import { RouteName } from "@/routes/constants"

const MagiClawPage = lazy(() => import("@/pages/superMagic/pages/MagiClawPage"))
const ClawPlaygroundPage = lazy(() => import("@/pages/superMagic/pages/ClawPlayground"))

function MagiClawAccessGuard({ children }: { children: ReactNode }) {
	const { t } = useTranslation("sidebar")
	const { isAllowed, isLoading, permissions, error, mutate } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawAccess,
	)

	useEffect(() => {
		let pending = false
		const refresh = () => {
			if (document.visibilityState !== "visible" || pending) return
			pending = true
			void mutate()
				.catch(() => undefined)
				.finally(() => {
					pending = false
				})
		}
		// Reconcile the existing permission cache while this module is open and after suspension.
		const timer = window.setInterval(refresh, 30_000)
		document.addEventListener("visibilitychange", refresh)
		window.addEventListener("online", refresh)
		window.addEventListener("pageshow", refresh)
		return () => {
			window.clearInterval(timer)
			document.removeEventListener("visibilitychange", refresh)
			window.removeEventListener("online", refresh)
			window.removeEventListener("pageshow", refresh)
		}
	}, [mutate])

	// Keep the active playground mounted during a background permission refresh.
	if (isLoading && !permissions) return null
	if (!isAllowed)
		return (
			<section
				className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
				role="status"
			>
				<h1 className="text-lg font-semibold">{t("clawRuntime.accessUnavailable")}</h1>
				<p className="max-w-lg text-sm text-muted-foreground">
					{error ? t("clawRuntime.refreshFailed") : t("clawRuntime.accessRevoked")}
				</p>
				<Button
					variant="outline"
					disabled={isLoading}
					onClick={() => void mutate().catch(() => undefined)}
				>
					{t("clawRuntime.refreshPermission")}
				</Button>
			</section>
		)

	return children
}

const magiClawRoutes: RouteObject[] = [
	{
		name: RouteName.MagiClaw,
		path: `/:clusterCode${RoutePath.MagiClaw}`,
		element: (
			<MagiClawAccessGuard>
				<MagiClawPage />
			</MagiClawAccessGuard>
		),
	},
	{
		name: RouteName.ClawPlayground,
		path: `/:clusterCode${RoutePath.ClawPlayground}`,
		element: (
			<MagiClawAccessGuard>
				<ClawPlaygroundPage />
			</MagiClawAccessGuard>
		),
	},
]

export default magiClawRoutes
