import { lazy } from "react"
import type { RouteObject } from "react-router"
import { PlatformPackageRoutes, otherRoutes, RouteName } from "@dtyq/magic-admin"
import { RoutePath } from "@/opensource/constants/routes"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/opensource/routes/components/Navigate"))
const BaseLayout = lazy(() => import("@/opensource/pages/magicAdmin/layouts/BaseLayout"))

export type Route = RouteObject & {
	name?: string
	title?: string
	hiddenMenu?: boolean
	children?: Route[]
	validate?: (permissions: string[], isSuperAdmin: boolean) => boolean
}
const routes: Route[] = [
	{
		name: RouteName.Admin,
		path: RoutePath.Admin,
		element: <BaseLayout />,
		children: [
			{
				index: true,
				name: RouteName.AdminPlatformPackage,
				element: <Navigate name={RouteName.AdminPlatformPackage} replace />,
			},
			PlatformPackageRoutes,
			...otherRoutes,
		],
	},
]

export default routes
