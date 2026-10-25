import { lazy, type PropsWithChildren } from "react"
import type { RouteObject } from "react-router"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import { isMicroAppEnabled } from "@/services/microAppFeature"

const MicroAppsPage = lazy(() => import("@/pages/superMagic/pages/MicroAppsPage"))
const MicroAppPage = lazy(() => import("@/pages/superMagic/lazy/MicroAppPage"))
const MicroAppSharePage = lazy(() => import("@/pages/share/microApp"))
const NotFound = lazy(() => import("@/pages/exception/not-found"))

function MicroAppRoute({ children }: PropsWithChildren) {
	// Keep disabled paths matched so generic project routes cannot capture them.
	return isMicroAppEnabled() ? children : <NotFound />
}

export const superMagicMicroAppRoutes: RouteObject[] = [
	{
		name: RouteName.MicroApps,
		path: `/:clusterCode${RoutePath.MicroApps}`,
		element: (
			<MicroAppRoute>
				<MicroAppsPage />
			</MicroAppRoute>
		),
		meta: {
			title: "routes.application",
		},
	},
	{
		name: RouteName.MicroAppsList,
		path: `/:clusterCode${RoutePath.MicroAppsList}`,
		element: (
			<MicroAppRoute>
				<MicroAppsPage mobileView="list" />
			</MicroAppRoute>
		),
		meta: {
			title: "routes.application",
		},
	},
	{
		name: RouteName.MicroApp,
		path: `/:clusterCode${RoutePath.MicroApp}`,
		element: (
			<MicroAppRoute>
				<MicroAppPage />
			</MicroAppRoute>
		),
	},
]

export const microAppPublicRoutes: RouteObject[] = [
	{
		name: RouteName.MicroAppShare,
		path: RoutePath.MicroAppShare,
		element: (
			<MicroAppRoute>
				<MicroAppSharePage />
			</MicroAppRoute>
		),
	},
]
