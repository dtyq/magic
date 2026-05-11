import { lazy, type ReactNode } from "react"
import type { RouteObject } from "react-router"

import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { RoutePath } from "@/constants/routes"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { Navigate } from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"

const MagiClawPage = lazy(() => import("@/pages/superMagic/pages/MagiClawPage"))
const ClawPlaygroundPage = lazy(() => import("@/pages/superMagic/pages/ClawPlayground"))

function MagiClawAccessGuard({ children }: { children: ReactNode }) {
	const { isAllowed, isLoading } = useFunctionPermission(FUNCTION_PERMISSION_CODE.MagicClawAccess)

	if (isLoading) return null
	if (!isAllowed) return <Navigate name={RouteName.NotFound} replace />

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
