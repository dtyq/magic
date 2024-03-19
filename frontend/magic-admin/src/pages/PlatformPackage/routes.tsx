import { lazy } from "react"
import { Navigate } from "@/pages/Navigate"
import { RouteName, RoutePath } from "@/const/routes"
import {
	PLATFORM_MANAGEMENT,
	PLATFORM_PACKAGE_MANAGEMENT,
	PERMISSION_KEY_MAP,
	PLATFORM_SYSTEM_SETTING,
	PLATFORM_ORIENTATION_MANAGEMENT,
	PLATFORM_MODEL_MANAGEMENT,
	PLATFORM_AGENT_MANAGEMENT,
} from "@/const/common"

const PlatformPackageLayout = lazy(() => import("./index.layout"))
const PackageManagementPage = lazy(() => import("./PackageManagement/index.page"))
const PackageDetailPage = lazy(() => import("./PackageDetail/index.page"))
const InfoManagementPage = lazy(() => import("./InfoManagement/index.page"))
const ModeManagementPage = lazy(() => import("./ModeManagement/index.page"))
const ModelPage = lazy(() => import("./Model/index.page"))
const ModelDetailPage = lazy(() => import("./ModelDetail/index.page"))
const AIDrawingPage = lazy(() => import("./AIDrawing/index.page"))
const AIDrawingDetailPage = lazy(() => import("./AIDrawingDetail/index.page"))
const AIAuditPage = lazy(() => import("./AIAudit/index.page"))
const OrderManagementPage = lazy(() => import("./OrderManagement/index.page"))
const OrgListPage = lazy(() => import("./OrganizationList/index.page"))
const OrganizationPoints = lazy(() => import("./OrganizationPoints/index.page"))
const PlatformInfoPage = lazy(() => import("./PlatformInfo/index.page"))
const AIPowerPage = lazy(() => import("./AIPower/index.page"))
const AIPowerDetailPage = lazy(() => import("./AIPowerDetail/index.page"))
const ProxyServerPage = lazy(() => import("./ProxyServer/index.page"))
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
			element: <Navigate to={RoutePath.PlatformPaidPackage} replace />,
		},
		{
			name: RouteName.AdminPlatformPackage,
			path: RoutePath.PlatformPaidPackage,
			title: "nav.platformSubMenu.platformPackage",
			validate: (permissions: string[], isSuperAdmin?: boolean) => {
				return (
					isSuperAdmin ||
					PLATFORM_PACKAGE_MANAGEMENT.some((permission) =>
						permissions.includes(permission),
					)
				)
			},
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.PlatformPaidPackageManage} replace />,
				},
				{
					name: RouteName.AdminPackageManage,
					path: RoutePath.PlatformPaidPackageManage,
					element: <PackageManagementPage />,
					title: "nav.platformSubMenu.packageManagement",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminPackageDetail,
					path: RoutePath.PlatformPaidPackageDetail,
					element: <PackageDetailPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminPackageOrder,
					path: RoutePath.PlatformPaidPackageOrder,
					element: <OrderManagementPage />,
					title: "nav.platformSubMenu.orderManagement",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.ORDER_MANAGEMENT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.ORDER_MANAGEMENT_EDIT)
						)
					},
				},
			],
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
			],
		},
		{
			name: RouteName.AdminTenant,
			path: RoutePath.PlatformTenant,
			title: "nav.platformSubMenu.platformTenant",
			validate: (permissions: string[], isSuperAdmin?: boolean) => {
				return (
					isSuperAdmin ||
					PLATFORM_ORIENTATION_MANAGEMENT.some((permission) =>
						permissions.includes(permission),
					)
				)
			},
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.PlatformTenantList} replace />,
				},
				{
					name: RouteName.AdminTenantList,
					path: RoutePath.PlatformTenantList,
					title: "nav.platformSubMenu.tenantList",
					element: <OrgListPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_LIST_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_LIST_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminTenantPoints,
					path: RoutePath.PlatformTenantPoints,
					title: "nav.platformSubMenu.tenantPoints",
					element: <OrganizationPoints />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_POINTS_LIST) ||
							permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_POINTS_DETAIL) ||
							permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_POINTS_ADD_POINTS)
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
					name: RouteName.AdminProxyServer,
					path: RoutePath.PlatformProxyServer,
					title: "nav.platformSubMenu.proxyServer",
					element: <ProxyServerPage />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.PROXY_SERVER_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.PROXY_SERVER_EDIT)
						)
					},
				},
				{
					name: RouteName.AdminAIAudit,
					path: RoutePath.PlatformAIAudit,
					element: <AIAuditPage />,
					title: "nav.platformSubMenu.audit",
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.AIAUDIT_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.AIAUDIT_DETAIL) ||
							permissions.includes(PERMISSION_KEY_MAP.AIAUDIT_MARK_RISK)
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
