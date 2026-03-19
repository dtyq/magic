import { lazy } from "react"
import type { RouteObject } from "react-router"

import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"

const MagiClawPage = lazy(() => import("@/pages/superMagic/pages/MagiClawPage"))

const magiClawRoutes: RouteObject[] = [
	{
		name: RouteName.MagiClaw,
		path: `/:clusterCode${RoutePath.MagiClaw}`,
		element: <MagiClawPage />,
	},
]

export default magiClawRoutes
