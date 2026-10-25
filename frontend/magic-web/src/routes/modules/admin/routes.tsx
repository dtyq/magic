import { lazy } from "react"
import type { RouteObject } from "react-router"
import {
	PlatformPackageRoutes,
	otherRoutes,
	RouteName,
	withAccessibleIndexRedirect,
} from "@dtyq/magic-admin"
import { RoutePath } from "@/constants/routes"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/routes/components/Navigate"))
const BaseLayout = lazy(() => import("@/pages/magicAdmin/layouts/BaseLayout"))

export type Route = RouteObject & {
	name?: string
	title?: string
	hiddenMenu?: boolean
	children?: Route[]
	validate?: (permissions: string[], isSuperAdmin: boolean) => boolean
}
// 子路由的 index 跳转按权限落到第一个可访问页面。
const routes: Route[] = withAccessibleIndexRedirect<Route>([
	{
		name: RouteName.Admin,
		path: RoutePath.Admin,
		element: <BaseLayout />,
		children: [
			{
				index: true,
				name: RouteName.AdminPlatformAIModel,
				element: <Navigate name={RouteName.AdminPlatformAIModel} replace />,
			},
			PlatformPackageRoutes,
			...otherRoutes,
		],
	},
])

export default routes
