import type { ReactNode } from "react"
import type { RouteGroupId, RouteSectionId } from "@magic-admin-v2/constants/routes"
import type { AccessContext } from "@magic-admin-v2/runtime/types"

export type RouteValidate = (context: AccessContext) => boolean

export type Route = {
	name: string
	path?: string
	index?: boolean
	element?: ReactNode
	titleKey?: string
	children?: Route[]
	/** 路由访问权限，同时决定 RouteGuard 是否放行和默认菜单是否展示。 */
	validate?: RouteValidate
	meta?: {
		section?: RouteSectionId
		group?: RouteGroupId
		/** 仅控制菜单展示，不参与路由访问控制。 */
		menuVisible?: boolean | RouteValidate
	}
}
