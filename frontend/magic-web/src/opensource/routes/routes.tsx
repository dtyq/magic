import type { RouteObject } from "react-router"
import { lazy } from "react"
import { RoutePath } from "@/const/routes"
import BaseLayout from "@/opensource/layouts/BaseLayout"

export function registerRoutes(): Array<RouteObject> {
	/** 404页面 */
	const NotFound = lazy(() => import("@/opensource/pages/notFound"))

	/** SSO模块 */
	const SSOLayout = lazy(() => import("@/opensource/layouts/SSOLayout"))
	/** SSO */
	const SignIn = lazy(() => import("@/opensource/pages/login/login"))

	/** 聊天新版 */
	const ChatNew = lazy(() => import("@/opensource/pages/chatNew"))

	/** 通讯录模块 */
	const ContactsLayout = lazy(() => import("@/opensource/pages/contacts/layouts"))
	/** 通讯录 */
	const ContactsOrganization = lazy(() => import("@/opensource/pages/contacts/organization"))
	/** 通讯录 */
	const ContactsFriend = lazy(() => import("@/opensource/pages/contacts/myFriends"))
	/** 通讯录 */
	const ContactsGroups = lazy(() => import("@/opensource/pages/contacts/myGroups"))
	/** Ai 助手 */
	const ContactsAiAssistant = lazy(() => import("@/opensource/pages/contacts/aiAssistant"))

	/** 流程模块 */
	const FlowLayout = lazy(() => import("@/opensource/pages/flow/layouts"))
	/** 详情 */
	const FlowDetail = lazy(() => import("@/opensource/pages/flow"))
	/** 发现 */
	const FlowExplore = lazy(() => import("@/opensource/pages/explore"))
	/** AI助力 */
	const FlowAgent = lazy(() => import("@/opensource/pages/flow/agent"))
	/** 流程列表(工作流/子流程/工具/知识库) */
	const FlowList = lazy(() => import("@/opensource/pages/flow/list"))
	/** 知识库详情 */
	const FlowKnowledgeDetail = lazy(() => import("@/opensource/pages/flow/knowledge/[id]"))

	/**
	 * @description 向量知识库模块
	 */
	const VectorKnowledgeLayout = lazy(() => import("@/opensource/pages/vectorKnowledge/layouts"))
	/** 创建 */
	const VectorKnowledgeCreate = lazy(
		() => import("@/opensource/pages/vectorKnowledge/components/Create"),
	)
	/** 详情 */
	const VectorKnowledgeDetail = lazy(
		() => import("@/opensource/pages/vectorKnowledge/components/Details"),
	)

	/** 全局设置 */
	const Settings = lazy(() => import("../pages/settings/Settings.page"))

	/** 超级麦吉 - 工作区 */
	const SuperMagicWorkspace = lazy(() => import("@/opensource/pages/superMagic/pages/Workspace"))

	/** 超级麦吉分享(不需要登录) */
	const SuperMagicShare = lazy(() => import("@/opensource/pages/share"))

	return [
		{
			path: RoutePath.SuperMagicShare,
			element: <SuperMagicShare />,
		},
		{
			path: "/",
			element: <BaseLayout />,
			children: [
				{
					path: "/",
					element: <Settings />,
				},
				{
					path: RoutePath.Chat,
					element: <ChatNew />,
				},
				{
					path: RoutePath.SuperMagic,
					element: <SuperMagicWorkspace />,
				},
				{
					path: RoutePath.Contacts,
					element: <ContactsLayout />,
					children: [
						{
							path: RoutePath.ContactsOrganization,
							element: <ContactsOrganization />,
						},
						{
							path: RoutePath.ContactsMyFriends,
							element: <ContactsFriend />,
						},
						{
							path: RoutePath.ContactsMyGroups,
							element: <ContactsGroups />,
						},
						{
							path: RoutePath.ContactsAiAssistant,
							element: <ContactsAiAssistant />,
						},
					],
				},
				{
					path: RoutePath.Explore,
					element: <FlowExplore />,
				},
				{
					path: RoutePath.FlowDetail,
					element: <FlowDetail />,
				},
				{
					path: RoutePath.Flow,
					element: <FlowLayout />,
					children: [
						{
							path: RoutePath.AgentList,
							element: <FlowAgent />,
						},
						{
							path: RoutePath.Flows,
							element: <FlowList />,
						},
						{
							path: RoutePath.FlowKnowledgeDetail,
							element: <FlowKnowledgeDetail />,
						},
					],
				},
				{
					path: RoutePath.VectorKnowledge,
					element: <VectorKnowledgeLayout />,
					children: [
						{
							path: RoutePath.VectorKnowledgeCreate,
							element: <VectorKnowledgeCreate />,
						},
						{
							path: RoutePath.VectorKnowledgeDetail,
							element: <VectorKnowledgeDetail />,
						},
					],
				},
				{
					path: RoutePath.Explore,
					element: <FlowExplore />,
				},
				{
					path: RoutePath.Settings,
					element: <Settings />,
				},
			],
		},
		{
			path: RoutePath.Login,
			element: <SSOLayout />,
			children: [
				{
					path: RoutePath.Login,
					element: <SignIn />,
				},
			],
		},
		{
			path: RoutePath.NotFound,
			element: <NotFound />,
		},
	]
}
