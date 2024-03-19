import { RoutePathMobile } from "@/opensource/constants/routes"
import { lazy } from "react"
import type { RouteObject } from "react-router"

/** 用户详情 */
export const UserInfoDetailPage = lazy(() => import("@/opensource/pages/mobile/user-detail"))
/** 聊天 - 根据 id 打开 */
export const ConversationById = lazy(() => import("@/opensource/pages/chatMobile/current"))
/** 聊天 - 设置 */
export const SettingContent = lazy(() => import("@/opensource/pages/chatMobile/setting"))

/**
 * @description 注册移动端路由
 * @param magicRoutes - 超级麦吉路由
 * @param chatRoutes - 聊天路由
 * @param exploreRoutes - 探索路由
 */

export function registerMobileRoutes(
	magicRoutes: RouteObject,
	chatRoutes: RouteObject,
	exploreRoutes: RouteObject,
) {
	//  register user detail page
	if (!magicRoutes.children) {
		magicRoutes.children = [] as RouteObject[]
	}

	magicRoutes.children?.push(
		...[
			{
				path: RoutePathMobile.UserDetail,
				element: <UserInfoDetailPage />,
			},
		],
	)

	//  register chat mobile pages
	if (!chatRoutes.children) {
		chatRoutes.children = [] as RouteObject[]
	}
	chatRoutes.children?.push(
		{
			path: RoutePathMobile.ChatCurrent,
			element: <ConversationById />,
		},
		{
			path: RoutePathMobile.ChatSetting,
			element: <SettingContent />,
		},
	)
}
