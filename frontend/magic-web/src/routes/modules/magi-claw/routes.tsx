import { lazy } from "react"
import type { RouteObject } from "react-router"

import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"

const MagiClawPage = lazy(() => import("@/pages/superMagic/pages/MagiClawPageOld"))
// const ClawPlaygroundPage = lazy(() => import("@/pages/superMagic/pages/ClawPlayground"))

const magiClawRoutes: RouteObject[] = [
	{
		name: RouteName.MagiClaw,
		path: `/:clusterCode${RoutePath.MagiClaw}`,
		element: <MagiClawPage />,
	},
	// {
	// 	name: RouteName.ClawPlayground,
	// 	path: `/:clusterCode${RoutePath.ClawPlayground}`,
	// 	element: <ClawPlaygroundPage />,
	// },
]

export default magiClawRoutes
