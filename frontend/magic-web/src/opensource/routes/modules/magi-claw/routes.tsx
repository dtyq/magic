import { lazy } from "react"
import type { RouteObject } from "react-router"

import { RoutePath } from "@/opensource/constants/routes"
import { RouteName } from "@/opensource/routes/constants"

const MagiClawPage = lazy(() => import("@/opensource/pages/superMagic/pages/MagiClawPage"))

const magiClawRoutes: RouteObject[] = [
	{
		name: RouteName.MagiClaw,
		path: `/:clusterCode${RoutePath.MagiClaw}`,
		element: <MagiClawPage />,
	},
]

export default magiClawRoutes
