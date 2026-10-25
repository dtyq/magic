import {
	EditionRouteGroup,
	EditionRouteHref,
	EditionRouteName,
	EditionRoutePath,
	EditionRouteRedirectPath,
	EditionRouteRelativePath,
	EditionRouteSection,
} from "@magic-admin-v2/constants/edition-routes"
import {
	BaseRouteGroup,
	BaseRouteHref,
	BaseRouteName,
	BaseRoutePath,
	BaseRouteRedirectPath,
	BaseRouteRelativePath,
	BaseRouteSection,
} from "@magic-admin-v2/constants/route-keys"

/**
 * 路由名称常量。
 *
 * 开源名称与企业名称合并后的完整字典，供路由定义、菜单元数据和导航判断使用。
 */
export const RouteName = {
	...BaseRouteName,
	...EditionRouteName,
} as const satisfies Record<string, string>

/** 路由所属的一级菜单分区。 */
export const RouteSection = {
	...BaseRouteSection,
	...EditionRouteSection,
} as const satisfies Record<string, string>

/** 路由所属的二级菜单分组。 */
export const RouteGroup = {
	...BaseRouteGroup,
	...EditionRouteGroup,
} as const satisfies Record<string, string>

/** 一级菜单分区 ID。 */
export type RouteSectionId = (typeof RouteSection)[keyof typeof RouteSection]

/** 二级菜单分组 ID。 */
export type RouteGroupId = (typeof RouteGroup)[keyof typeof RouteGroup]

/**
 * 路由 path 常量。
 *
 * 值均为 React Router 路由定义使用的相对路径。
 */
export const RoutePath = {
	...BaseRoutePath,
	...EditionRoutePath,
} as const satisfies Record<string, string>

/** 非路由声明 pattern 使用的相对重定向目标。 */
export const RouteRedirectPath = {
	...BaseRouteRedirectPath,
	...EditionRouteRedirectPath,
} as const satisfies Record<string, string>

/** 同级页面之间导航时使用的相对路径。 */
export const RouteRelativePath = {
	...BaseRouteRelativePath,
	...EditionRouteRelativePath,
} as const satisfies Record<string, string>

/** 路由声明外使用的应用内绝对链接。 */
export const RouteHref = {
	...BaseRouteHref,
	...EditionRouteHref,
} as const satisfies Record<string, string>
