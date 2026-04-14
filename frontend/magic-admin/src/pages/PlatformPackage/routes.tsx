import { lazy } from "react"
import { Navigate } from "@/pages/Navigate"
import { RouteName, RoutePath } from "@/const/routes"
import {
	PLATFORM_MANAGEMENT,
	PERMISSION_KEY_MAP,
	PLATFORM_SYSTEM_SETTING,
	PLATFORM_MODEL_MANAGEMENT,
	PLATFORM_AGENT_MANAGEMENT,
} from "@/const/common"

const PlatformPackageLayout = lazy(() => import("./index.layout"))

const InfoManagementPage = lazy(() => import("./InfoManagement/index.page"))
const ModeManagementPage = lazy(() => import("./ModeManagement/index.page"))
const ModelPage = lazy(() => import("./Model/index.page"))
const ModelDetailPage = lazy(() => import("./ModelDetail/index.page"))
const AIDrawingPage = lazy(() => import("./AIDrawing/index.page"))
const AIDrawingDetailPage = lazy(() => import("./AIDrawingDetail/index.page"))
const ModelAuditLogPage = lazy(() => import("./ModelAuditLog/index.page"))
const PlatformInfoPage = lazy(() => import("./PlatformInfo/index.page"))
const AIPowerPage = lazy(() => import("./AIPower/index.page"))
const AIPowerDetailPage = lazy(() => import("./AIPowerDetail/index.page"))
const SkillManagementPage = lazy(() => import("./SkillManagement/index.page"))
const EmployeeReviewPage = lazy(() => import("./EmployeeReview/index.page"))
const SkillMarketPage = lazy(() => import("./SkillMarket/index.page"))
const EmployeeMarketPage = lazy(() => import("./EmployeeMarket/index.page"))
const AppMenuPage = lazy(() => import("./AppMenu/index.page"))

export default {
	name: RouteName.AdminPlatformLayout,
	path: RoutePath.Platform,
	element: <PlatformPackageLayout />,
	title: "nav.platform",
	meta: {
		title: "nav.platform",
	},
	validate: (permissions: string[], isSuperAdmin?: boolean) => {
		return (
			isSuperAdmin ||
			PLATFORM_MANAGEMENT.some((permission) => permissions.includes(permission))
		)
	},
	children: [
		{
			index: true,
			element: <Navigate to={RoutePath.PlatformModel} replace />,
		},
		{
			name: RouteName.AdminPlatformModel,
			path: RoutePath.PlatformModel,
			title: "nav.platformSubMenu.platformModel",
			validate: (permissions: string[], isSuperAdmin?: boolean) => {
				return (
					isSuperAdmin ||
					PLATFORM_MODEL_MANAGEMENT.some((permission) => permissions.includes(permission))
				)
			},
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.PlatformAIModel} replace />,
				},
				{
					name: RouteName.AdminPlatformAIModel,
					path: RoutePath.PlatformAIModel,
					element: <ModelPage />,
					title: "nav.platformSubMenu.modelManagement",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
							) ||
							permissions.includes(PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminPlatformAIModelDetails,
					path: RoutePath.PlatformAIModelDetail,
					element: <ModelDetailPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
							) ||
							permissions.includes(PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminPlatformAIDrawing,
					path: RoutePath.PlatformAIDrawing,
					element: <AIDrawingPage />,
					title: "nav.platformSubMenu.intelligentDrawing",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_QUERY,
							) ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
							)
						)
					},
				},
				{
					name: RouteName.AdminPlatformAIDrawingDetails,
					path: RoutePath.PlatformAIDrawingDetail,
					element: <AIDrawingDetailPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_QUERY,
							) ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
							)
						)
					},
				},
				{
					name: RouteName.AdminPlatformModelAuditLog,
					path: RoutePath.PlatformModelAuditLog,
					element: <ModelAuditLogPage />,
					title: "nav.platformSubMenu.modelAuditLog",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.SAFE_MODEL_AUDIT_LOG_QUERY)
						)
					},
				},
			],
		},
		{
			name: RouteName.AdminAgentEnhancement,
			path: RoutePath.PlatformAgent,
			title: "nav.platformSubMenu.agentEnhancement",
			validate: (permissions: string[], isSuperAdmin?: boolean) => {
				return (
					isSuperAdmin ||
					PLATFORM_AGENT_MANAGEMENT.some((permission) => permissions.includes(permission))
				)
			},
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.PlatformCapability} replace />,
				},

				{
					name: RouteName.AdminSystemCapability,
					path: RoutePath.PlatformCapability,
					element: <AIPowerPage />,
					title: "nav.platformSubMenu.systemCapability",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminSystemCapabilityDetail,
					path: RoutePath.PlatformCapabilityDetail,
					element: <AIPowerDetailPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)
						)
					},
				},

				{
					name: RouteName.AdminSystemAgent,
					path: RoutePath.PlatformAgentMode,
					element: <ModeManagementPage />,
					title: "nav.platformSubMenu.systemAgent",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminSkillMarket,
					path: RoutePath.PlatformAgentSkillMarket,
					element: <SkillMarketPage />,
					title: "nav.platformSubMenu.skillMarket",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminSystemSkill,
					path: RoutePath.PlatformAgentSkill,
					element: <SkillManagementPage />,
					title: "nav.platformSubMenu.systemSkill",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminEmployeeReview,
					path: RoutePath.PlatformAgentEmployeeReview,
					element: <EmployeeReviewPage />,
					title: "nav.platformSubMenu.employeeReview",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminEmployeeMarket,
					path: RoutePath.PlatformAgentEmployeeMarket,
					element: <EmployeeMarketPage />,
					title: "nav.platformSubMenu.employeeMarket",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
						)
					},
				},
			],
		},
		{
			name: RouteName.AdminPlatformManage,
			path: RoutePath.PlatformManage,
			title: "nav.platformSubMenu.platformManage",
			validate: (permissions: string[], isSuperAdmin?: boolean) => {
				return (
					isSuperAdmin ||
					PLATFORM_SYSTEM_SETTING.some((permission) => permissions.includes(permission))
				)
			},
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.PlatformInfoManagement} replace />,
				},
				{
					name: RouteName.AdminPlatformInfoManagement,
					path: RoutePath.PlatformInfoManagement,
					title: "nav.platformSubMenu.platformInfo",
					element: <PlatformInfoPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(
								PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
							) ||
							permissions.includes(PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminAppMenu,
					path: RoutePath.PlatformAppMenu,
					title: "nav.platformSubMenu.applicationMenu",
					element: <AppMenuPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.APP_MENU_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.APP_MENU_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminPlatformMaintenance,
					path: RoutePath.PlatformMaintenance,
					title: "nav.platformSubMenu.platformMaintenance",
					element: <InfoManagementPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.INFO_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.INFO_MANAGEMENT_EDIT)
						)
					},
				},
			],
		},
	],
}
