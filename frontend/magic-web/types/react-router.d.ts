import type { IndexRouteObject, NonIndexRouteObject } from "react-router/dist/lib/context"

/** 扩展 react-router 声明 */
declare module "react-router" {
	interface MetaData {
		title?: string
		description?: string
		keywords?: string
		// default is true
		isShouldInitChat?: boolean
	}

	interface MagicIndexRouteObject extends IndexRouteObject {
		name?: string
		meta?: MetaData
	}

	interface MagicNonIndexRouteObject extends NonIndexRouteObject {
		name?: string
		children?: Array<RouteObject>
		meta?: MetaData
	}

	export type RouteObject = MagicIndexRouteObject | MagicNonIndexRouteObject
}
