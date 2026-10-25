/* magic-admin 包导出 */

// 2. 导出路由配置
export { default as PlatformPackageRoutes } from "@admin/pages/PlatformPackage/routes"
export { otherRoutes } from "@admin/routes"
export { withAccessibleIndexRedirect } from "@admin/routes/FirstAccessibleRedirect"

// 3. 导出页面组件（功能管理）
export { RouteName, RoutePath } from "@admin/const/routes"
export { useAdminStore } from "@admin/stores/admin"

export * from "@admin/const/common"
export { AiModel } from "@admin/const/aiModel"

// 5. 导出鉴权中间件
export {
	withAuthMiddleware,
	type AuthMiddlewareInjectedProps,
} from "@admin/layouts/BaseLayout/components/AuthMiddleware"
export { useAdminEntryRedirect } from "@admin/layouts/BaseLayout/hooks/useAdminEntryRedirect"

export { findRouteByPathname, checkItemPermission } from "@admin/utils/routeUtils"
export {
	getMatchedRouteChain,
	getMatchedRouteEntries,
	getPermissionSourceByPath,
	getRoutePermissionSource,
} from "@admin/utils/routeMeta"
export type { MatchedRouteEntry, PermissionSource, RouteWithMeta } from "@admin/utils/routeMeta"

// 9. 导出类型
export { PlatformPackage } from "@admin/types/platformPackage"

// 10. 组件
export { default as ServiceIcon } from "@admin/pages/PlatformPackage/components/ServiceIcon"
