import { lazy } from "react"
import type { RouteObject } from "react-router-dom"
import { Navigate } from "react-router-dom"
import { RouteName, RoutePath } from "@admin/const/routes"

import AiManageRoutes from "../pages/AiManage/routes"
import PlatformPackageRoutes from "../pages/PlatformPackage/routes"

const BaseLayout = lazy(() => import("@admin/layouts/BaseLayout"))
const NotAuthPage = lazy(() => import("@admin/pages/NotAuthPage"))

interface MetaData {
	title?: string
	description?: string
	keywords?: string
	// default is true
	isShouldInitChat?: boolean
}

export type Route = RouteObject & {
	name?: string
	title?: string
	hiddenMenu?: boolean
	children?: Route[]
	validate?: (permissions: string[], isSuperAdmin: boolean) => boolean
	meta?: MetaData
}

export const otherRoutes: Route[] = [
	{
		path: RoutePath.AdminNoAuthorized,
		element: <NotAuthPage />,
	},
]

export const routes: Route[] = [
	{
		name: RouteName.Admin,
		path: RoutePath.Admin,
		element: <BaseLayout />,
		children: [
			{
				index: true,
				element: <Navigate to={RoutePath.Platform} replace />,
			},
			PlatformPackageRoutes,
			AiManageRoutes,
			...otherRoutes,
		],
	},
	{
		path: "*",
		element: <Navigate to="/admin" replace />,
	},
]
