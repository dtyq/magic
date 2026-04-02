/* magic-admin 包导出 */

// 1. 导出 Provider 能力
export {
	AdminProvider,
	AdminProviderContext,
	AppEnv,
	useAdmin,
} from "@/provider/AdminProvider"
export type { AdminProviderProps } from "@/provider/AdminProvider"

// 2. 导出路由配置
export { default as PlatformPackageRoutes } from "@/pages/PlatformPackage/routes"
export { otherRoutes } from "@/routes"

export * from "@/const/common"
export { AiModel } from "@/const/aiModel"

// 3. 导出路由常量
export { RouteName, RoutePath } from "@/const/routes"
export { useAdminStore } from "@/stores/admin"

// 4. 鉴权中间件
export { withAuthMiddleware } from "@/layouts/BaseLayout/components/AuthMiddleware"

// 5. 导出工具函数
export { findRouteByPathname, checkItemPermission } from "@/utils/routeUtils"

// 6. 导出类型
export { PlatformPackage } from "@/types/platformPackage"

// 7. 导出 ServiceIcon
export { default as ServiceIcon } from "@/pages/PlatformPackage/components/ServiceIcon"
