import type { RouteObject } from "react-router"
import { lazy } from "react"
import { RoutePath, RoutePathMobile } from "@/opensource/constants/routes"
import magicAdminRoutes from "@/opensource/routes/modules/admin/routes"
import magiClawRoutes from "@/opensource/routes/modules/magi-claw/routes"
import { RouteName } from "@/opensource/routes/constants"
import { routesRedirection, teamEditionRedirection } from "@/opensource/routes/helpers"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/opensource/routes/components/Navigate"))

/**
 * @description 404页面
 */
const NotFound = lazy(() => import("@/opensource/pages/exception/not-found"))

/**
 * @description SSO模块
 */
const SSOLayout = lazy(() => import("@/opensource/layouts/SSOLayout"))
const LoginPage = lazy(() => import("@/opensource/pages/login/login"))

/**
 * @description 聊天模块
 */
/** 聊天 */
const Chat = lazy(() => import("@/opensource/pages/chatNew/lazy/Chat"))
/** 聊天 - 根据 id 打开 */
const ChatConversation = lazy(() => import("@/opensource/pages/chatMobile/lazy/ChatConversation"))
/** 聊天 - 设置 */
const ChatSetting = lazy(() => import("@/opensource/pages/chatMobile/lazy/ChatSetting"))

/**
 * @description 通讯录模块
 */
const ContactsLayout = lazy(() => import("@/opensource/pages/contacts/layouts"))
/** 通讯录 */
const Contacts = lazy(() => import("@/opensource/pages/contacts/lazy/Contacts"))
/** 通讯录 */
const ContactsOrganization = lazy(
	() => import("@/opensource/pages/contacts/lazy/ContactsOrganization"),
)
/** 通讯录 */
const ContactsFriend = lazy(() => import("@/opensource/pages/contacts/myFriends"))
/** 通讯录 */
const ContactsMyGroups = lazy(() => import("@/opensource/pages/contacts/lazy/ContactsMyGroups"))
/** Ai 助手 */
const ContactsAiAssistant = lazy(
	() => import("@/opensource/pages/contacts/lazy/ContactsAiAssistant"),
)
/** 用户详情 */
const UserInfoDetailPage = lazy(() => import("@/opensource/pages/mobile/user-detail"))

/**
 * @description 流程模块
 */
const FlowLayout = lazy(() => import("@/opensource/pages/flow/layouts"))
/** 详情 */
const FlowDetail = lazy(() => import("@/opensource/pages/flow"))
/** 发现 */
const Explore = lazy(() => import("@/opensource/pages/explore/lazy/Explore"))
/** AI助力 */
const FlowAgent = lazy(() => import("@/opensource/pages/flow/agent"))
/** 流程列表(工作流/子流程/工具/向量知识库/MCP) */
const FlowList = lazy(() => import("@/opensource/pages/flow/list"))
/** MCP */
const MCP = lazy(() => import("@/opensource/pages/flow/pages/mcp"))

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

/** 无授权访问 */
const NotAuthPage = lazy(() => import("@/opensource/pages/exception/forbidden"))

/** 超级麦吉 - 通用布局 */
const SuperMagicCommonLayout = lazy(
	() => import("@/opensource/pages/superMagic/layouts/MainLayout"),
)
/** 超级麦吉 - 项目跳转页面 */
const ProjectPage = lazy(() => import("@/opensource/pages/superMagic/lazy/ProjectPage"))
/** 移动端 - 个人中心 */
const Profile = lazy(() => import("@/opensource/pages/user/pages/my/lazy/Profile"))
/** 移动端 - 个人中心 - 个人信息 */
const ProfileInfo = lazy(() => import("@/opensource/pages/user/pages/my/components/AccountInfo"))
/** 移动端 - 个人中心 - 登录设备 */
const ProfileLoginDevices = lazy(
	() => import("@/opensource/pages/user/pages/my/components/LoginDevices"),
)
/** 移动端 - 个人中心 - 设置 */
const ProfileSettings = lazy(() => import("@/opensource/pages/user/pages/my/components/Settings"))
/** 移动端 - 个人中心 - 设置 - 语言 */
const ProfileSettingsLanguage = lazy(
	() => import("@/opensource/pages/user/pages/my/components/Settings/LanguageSelector"),
)
/** 移动端 - 个人中心 - 设置 - 时区 */
const ProfileSettingsTimezone = lazy(
	() => import("@/opensource/pages/user/pages/my/components/Settings/TimezoneSelector"),
)
/** 移动端 - 个人中心 - 账户安全 */
const ProfileAccountSecurity = lazy(
	() => import("@/opensource/pages/user/pages/my/components/AccountSecurity"),
)
const SuperMagicNavigate = lazy(
	() => import("@/opensource/pages/superMagic/lazy/SuperMagicNavigate"),
)
const SuperRootRedirect = lazy(() => import("@/opensource/pages/superMagic/lazy/SuperRootRedirect"))
/** Crew Market - 员工市场 */
const CrewMarketPage = lazy(
	() => import("@/opensource/pages/superMagic/pages/CrewMarket/index.desktop"),
)
/** Crew Edit - 编辑 Crew */
const CrewEditPage = lazy(
	() => import("@/opensource/pages/superMagic/pages/CrewEdit/index.desktop"),
)
/** My Skills - 我的技能 */
const MySkillsPage = lazy(
	() => import("@/opensource/pages/superMagic/pages/MySkillsPage/index.desktop"),
)
/** My Crew - 我的员工 */
const MyCrewPage = lazy(
	() => import("@/opensource/pages/superMagic/pages/MyCrewPage/index.desktop"),
)
const WorkspacePage = lazy(() => import("@/opensource/pages/superMagic/lazy/WorkspacePage"))
const TopicPage = lazy(() => import("@/opensource/pages/superMagic/lazy/TopicPage"))
const MobileTabs = lazy(() => import("@/opensource/pages/mobileTabs"))

const SuperMagicShare = lazy(() => import("@/opensource/pages/share"))

const SuperAssistant = lazy(() => import("@/opensource/pages/superMagic/pages/Assistant"))

/** 授权回调页面 */
const AuthLayout = lazy(() => import("@/opensource/pages/auth/layouts/AuthLayout"))
const AuthCallback = lazy(() => import("@/opensource/pages/auth/callback"))

/** 系统初始化流程页面 */
const InitializationPage = lazy(() => import("@/opensource/pages/initialization"))

/** 全局布局 */
const ClusterLayout = lazy(() => import("@/opensource/layouts/ClusterLayout"))
const BaseLayout = lazy(() => import("@/opensource/layouts/BaseLayout"))

/** 平台布局（用于分发不同平台入口） */
const MagicPlatformLayout = lazy(
	() => import("@/opensource/layouts/PlatformLayout/MagicPlatformLayout"),
)
const AdminPlatformLayout = lazy(
	() => import("@/opensource/layouts/PlatformLayout/AdminPlatformLayout"),
)

interface RouteConfig {
	isPersonalOrganization?: boolean
}

export function registerRoutes(config: RouteConfig = {}): Array<RouteObject> {
	const { isPersonalOrganization = false } = config

	const ChatRoutes = {
		name: RouteName.Chat,
		path: `/:clusterCode${RoutePath.Chat}`,
		children: [
			{
				index: true,
				element: <Chat />,
				meta: {
					title: "routes.chat",
				},
			},
			{
				name: RouteName.ChatConversation,
				path: `/:clusterCode${RoutePathMobile.ChatCurrent}`,
				element: <ChatConversation />,
				meta: {
					title: "routes.chat",
				},
			},
			{
				name: RouteName.ChatSetting,
				path: `/:clusterCode${RoutePathMobile.ChatSetting}`,
				element: <ChatSetting />,
				meta: {
					title: "routes.chatSettings",
				},
			},
		],
	} as RouteObject

	// 团队版路由，由于筛选掉个人版禁用的路由
	const teamEditionRoutes = [
		ChatRoutes,
		{
			name: RouteName.Contacts,
			path: `/:clusterCode${RoutePath.Contacts}`,
			element: <ContactsLayout />,
			children: [
				{
					index: true,
					name: RouteName.Contacts,
					path: `/:clusterCode${RoutePath.Contacts}`,
					element: <Contacts />,
					meta: {
						title: "routes.contacts",
					},
				},
				{
					name: RouteName.ContactsOrganization,
					path: `/:clusterCode${RoutePath.ContactsOrganization}`,
					element: <ContactsOrganization />,
					meta: {
						title: "routes.contactsOrganization",
					},
				},
				{
					name: RouteName.ContactsMyFriends,
					path: `/:clusterCode${RoutePath.ContactsMyFriends}`,
					element: <ContactsFriend />,
					meta: {
						title: "routes.contactsMyFriends",
					},
				},
				{
					name: RouteName.ContactsMyGroups,
					path: `/:clusterCode${RoutePath.ContactsMyGroups}`,
					element: <ContactsMyGroups />,
					meta: {
						title: "routes.contactsMyGroups",
					},
				},
				{
					name: RouteName.ContactsAiAssistant,
					path: `/:clusterCode${RoutePath.ContactsAiAssistant}`,
					element: <ContactsAiAssistant />,
					meta: {
						title: "routes.contactsAiAssistant",
					},
				},
			],
		},
	]
	const clusterRoutes = {
		path: "/:clusterCode",
		element: <BaseLayout />,
		children: [
			{
				name: RouteName.MobileTabs,
				path: `/:clusterCode${RoutePathMobile.MobileTabs}`,
				element: <MobileTabs />,
			},
			{
				name: RouteName.Profile,
				path: `/:clusterCode${RoutePathMobile.Profile}`,
				element: <Profile />,
			},
			{
				name: RouteName.ProfileInfo,
				path: `/:clusterCode${RoutePathMobile.ProfileInfo}`,
				element: <ProfileInfo />,
			},
			{
				name: RouteName.ProfileLoginDevices,
				path: `/:clusterCode${RoutePathMobile.ProfileLoginDevices}`,
				element: <ProfileLoginDevices />,
			},
			{
				name: RouteName.ProfileSettings,
				path: `/:clusterCode${RoutePathMobile.ProfileSettings}`,
				element: <ProfileSettings />,
			},
			{
				name: RouteName.ProfileSettingsLanguage,
				path: `/:clusterCode${RoutePathMobile.ProfileSettingsLanguage}`,
				element: <ProfileSettingsLanguage />,
			},
			{
				name: RouteName.ProfileSettingsTimezone,
				path: `/:clusterCode${RoutePathMobile.ProfileSettingsTimezone}`,
				element: <ProfileSettingsTimezone />,
			},
			{
				name: RouteName.ProfileAccountSecurity,
				path: `/:clusterCode${RoutePathMobile.ProfileAccountSecurity}`,
				element: <ProfileAccountSecurity />,
			},
			{
				name: RouteName.UserInfoDetails,
				path: `/:clusterCode${RoutePathMobile.UserDetail}`,
				element: <UserInfoDetailPage />,
			},
			{
				name: RouteName.Explore,
				path: `/:clusterCode${RoutePath.Explore}`,
				children: [
					{
						index: true,
						element: <Explore />,
						meta: {
							title: "routes.explore",
						},
					},
				],
			},
			{
				name: RouteName.FlowDetail,
				path: `/:clusterCode${RoutePath.FlowDetail}`,
				element: <FlowDetail />,
			},
			{
				path: `/:clusterCode${RoutePath.Flow}`,
				element: <FlowLayout />,
				children: [
					{
						name: RouteName.AgentList,
						path: `/:clusterCode${RoutePath.AgentList}`,
						element: <FlowAgent />,
						meta: {
							title: "routes.agentList",
						},
					},
					{
						name: RouteName.MCP,
						path: `/:clusterCode${RoutePath.MCP}`,
						element: <MCP />,
						meta: {
							title: "routes.mcp",
						},
					},
					{
						name: RouteName.Flows,
						path: `/:clusterCode${RoutePath.Flows}`,
						element: <FlowList />,
					},
				],
			},
			{
				path: `/:clusterCode${RoutePath.VectorKnowledge}`,
				element: <VectorKnowledgeLayout />,
				children: [
					{
						name: RouteName.VectorKnowledgeCreate,
						path: `/:clusterCode${RoutePath.VectorKnowledgeCreate}`,
						element: <VectorKnowledgeCreate />,
						meta: {
							title: "routes.vectorKnowledgeCreate",
						},
					},
					{
						name: RouteName.VectorKnowledgeDetail,
						path: `/:clusterCode${RoutePath.VectorKnowledgeDetail}`,
						element: <VectorKnowledgeDetail />,
					},
				],
			},
			{
				name: RouteName.Explore,
				path: `/:clusterCode${RoutePath.Explore}`,
				element: <Explore />,
			},
			{
				name: RouteName.Super,
				path: `/:clusterCode${RoutePath.Super}`,
				element: <SuperMagicCommonLayout />,
				children: [
					{
						index: true,
						element: <SuperRootRedirect />,
					},
					{
						name: RouteName.SuperWorkspaceState,
						path: `/:clusterCode${RoutePath.SuperWorkspaceState}`,
						element: <WorkspacePage />,
					},
					{
						name: RouteName.SuperWorkspaceProjectState,
						path: `/:clusterCode${RoutePath.SuperWorkspaceProjectState}`,
						element: <ProjectPage />,
					},
					{
						name: RouteName.SuperWorkspaceProjectTopicState,
						path: `/:clusterCode${RoutePath.SuperWorkspaceProjectTopicState}`,
						element: <TopicPage />,
					},
				],
			},
			{
				name: RouteName.CrewMarket,
				path: `/:clusterCode${RoutePath.CrewMarket}`,
				element: <Navigate name={RouteName.CrewMarketCrew} replace />,
			},
			{
				name: RouteName.CrewMarketCrew,
				path: `/:clusterCode${RoutePath.CrewMarketCrew}`,
				element: <CrewMarketPage />,
			},
			{
				name: RouteName.CrewMarketSkills,
				path: `/:clusterCode${RoutePath.CrewMarketSkills}`,
				element: <CrewMarketPage />,
			},
			{
				name: RouteName.CrewEdit,
				path: `/:clusterCode${RoutePath.CrewEdit}`,
				element: <CrewEditPage />,
			},
			{
				name: RouteName.MySkills,
				path: `/:clusterCode${RoutePath.MySkills}`,
				element: <MySkillsPage />,
			},
			{
				name: RouteName.MyCrew,
				path: `/:clusterCode${RoutePath.MyCrew}`,
				element: <MyCrewPage />,
			},
			...magiClawRoutes,
			{
				name: RouteName.SuperMagicNavigate,
				path: `/:clusterCode${RoutePathMobile.SuperMagicNavigate}`,
				element: <SuperMagicNavigate />,
			},
			{
				name: RouteName.SuperAssistant,
				path: `/:clusterCode${RoutePath.SuperAssistant}`,
				element: <SuperAssistant />,
			},
			// 以下是历史路由对重定向到超级麦吉的兼容处理，后续需要删除
			{
				name: RouteName.SuperMagic,
				path: `/:clusterCode${RoutePath.SuperMagic}`,
				element: <Navigate name={RouteName.Super} replace />,
			},
			{
				name: RouteName.SuperMagicWorkspace,
				path: `/:clusterCode${RoutePath.SuperMagicWorkspace}`,
				element: <Navigate name={RouteName.Super} replace />,
			},
			{
				name: RouteName.SuperMagicFiles,
				path: `/:clusterCode${RoutePath.SuperMagicFiles}`,
				element: <Navigate name={RouteName.Super} replace />,
			},
			{
				name: RouteName.SuperWorkspace,
				path: `/:clusterCode${RoutePath.SuperWorkspace}`,
				element: <Navigate name={RouteName.Super} replace />,
			},
			...(isPersonalOrganization
				? teamEditionRedirection(teamEditionRoutes)
				: teamEditionRoutes),
		],
	}

	const appRoutes: Array<RouteObject> = [
		{
			name: RouteName.Initialization,
			path: RoutePath.Initialization,
			element: <InitializationPage />,
		},
		{
			name: RouteName.SuperMagicShare,
			path: RoutePath.SuperMagicShare,
			element: <SuperMagicShare />,
		},
		{
			name: RouteName.SuperMagicFileShare,
			path: RoutePath.SuperMagicFileShare,
			element: <SuperMagicShare />,
		},
		{
			name: RouteName.AuthLayout,
			path: RoutePath.AuthLayout,
			element: <AuthLayout />,
			children: [
				{
					name: RouteName.AuthCallback,
					path: RoutePath.AuthCallback,
					element: <AuthCallback />,
					meta: {
						title: "routes.authCallback",
					},
				},
			],
		},
		{
			path: "/:clusterCode",
			element: <ClusterLayout />,
			children: [
				{
					index: true,
					element: <Navigate name={RouteName.Super} replace />,
				},
				clusterRoutes,
			],
		},
		{
			name: RouteName.NotFound,
			path: RoutePath.NotFound,
			element: <NotFound />,
		},
		{
			name: RouteName.NotAuth,
			path: RoutePath.NotAuth,
			element: <NotAuthPage />,
		},
	]

	const routes = [
		{
			name: RouteName.AdminPlatform,
			path: "/admin",
			element: <AdminPlatformLayout />,
			children: magicAdminRoutes,
		},
		{
			name: RouteName.MagicPlatform,
			path: "/",
			element: <MagicPlatformLayout />,
			children: [...routesRedirection([clusterRoutes]), ...appRoutes],
		},
		{
			name: RouteName.SSOLayout,
			path: RoutePath.Login,
			element: <SSOLayout />,
			children: [
				{
					name: RouteName.Login,
					path: RoutePath.Login,
					element: <LoginPage />,
					meta: {
						title: "routes.login",
					},
				},
			],
		},
	]

	return routes
}
