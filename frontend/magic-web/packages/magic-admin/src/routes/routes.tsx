import { lazy } from "react"
import type { RouteObject } from "react-router-dom"
import { Navigate } from "react-router-dom"
import { withAccessibleIndexRedirect } from "@admin/routes/FirstAccessibleRedirect"
import { RouteName, RoutePath } from "@admin/const/routes"

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
	validateOrganization?: (
		context: import("@admin/utils/routeMeta").OrganizationAccessContext,
	) => boolean
	validateEnvironment?: (
		env: import("@admin/utils/routeMeta").EnvironmentAccessContext,
	) => boolean
	meta?: MetaData
}

export const otherRoutes: Route[] = [
	{
		path: RoutePath.AdminNoAuthorized,
		element: <NotAuthPage />,
	},
]

export const routes: Route[] = withAccessibleIndexRedirect<Route>([
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
			...otherRoutes,
		],
	},
	{
		path: "*",
		element: <Navigate to="/admin" replace />,
	},
])
