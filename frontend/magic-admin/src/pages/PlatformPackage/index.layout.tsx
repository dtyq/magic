import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	IconInfoCircle,
	IconBrandMyOppo,
	IconListDetails,
	IconUsers,
	IconMoneybag,
	IconTool,
	IconMessageCheck,
	IconRobot,
	IconServerSpark,
	IconSettingsAi,
	IconPhotoAi,
	IconSubtitlesAi,
	IconMenu2,
} from "@tabler/icons-react"
import { useAdminStore } from "@/stores/admin"

import {
	PLATFORM_PACKAGE_MANAGEMENT,
	PERMISSION_KEY_MAP,
	PLATFORM_SYSTEM_SETTING,
	PLATFORM_ORIENTATION_MANAGEMENT,
	PLATFORM_MODEL_MANAGEMENT,
	PLATFORM_AGENT_MANAGEMENT,
} from "../../const/common"
import SecondaryLayout from "../../layouts/SecondaryLayout"
import { RoutePath } from "../../const/routes"

function PlatformPackageLayout() {
	const { t } = useTranslation("admin/common")
	const { isOfficialOrg } = useAdminStore()
	const items = useMemo(() => {
		if (!isOfficialOrg) return []
		return [
			{
				key: RoutePath.PlatformPaidPackage,
				label: t("nav.platformSubMenu.platformPackage"),
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
						key: RoutePath.PlatformPaidPackageManage,
						label: t("nav.platformSubMenu.packageManagement"),
						icon: <IconBrandMyOppo size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformPaidPackageOrder,
						label: t("nav.platformSubMenu.orderManagement"),
						icon: <IconListDetails size={20} />,
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
				key: RoutePath.PlatformModel,
				label: t("nav.platformSubMenu.platformModel"),
				validate: (permissions: string[], isSuperAdmin?: boolean) => {
					return (
						isSuperAdmin ||
						PLATFORM_MODEL_MANAGEMENT.some((permission) =>
							permissions.includes(permission),
						)
					)
				},
				children: [
					{
						key: RoutePath.PlatformAIModel,
						label: t("nav.platformSubMenu.modelManagement"),
						icon: <IconSubtitlesAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(
									PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
								) ||
								permissions.includes(
									PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT,
								)
							)
						},
					},
					{
						key: RoutePath.PlatformAIDrawing,
						label: t("nav.platformSubMenu.intelligentDrawing"),
						icon: <IconPhotoAi size={20} />,
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
				key: RoutePath.PlatformAgent,
				label: t("nav.platformSubMenu.agentEnhancement"),
				validate: (permissions: string[], isSuperAdmin?: boolean) => {
					return (
						isSuperAdmin ||
						PLATFORM_AGENT_MANAGEMENT.some((permission) =>
							permissions.includes(permission),
						)
					)
				},
				children: [
					{
						key: RoutePath.PlatformCapability,
						label: t("nav.platformSubMenu.systemCapability"),
						icon: <IconSettingsAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(
									PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY,
								) ||
								permissions.includes(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformAgentMode,
						label: t("nav.platformSubMenu.systemAgent"),
						icon: <IconRobot size={20} />,
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
				key: RoutePath.PlatformTenant,
				label: t("nav.platformSubMenu.platformTenant"),
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
						key: RoutePath.PlatformTenantList,
						label: t("nav.platformSubMenu.tenantList"),
						icon: <IconUsers size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_LIST_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_LIST_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformTenantPoints,
						label: t("nav.platformSubMenu.tenantPoints"),
						icon: <IconMoneybag size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.ORIENTATION_POINTS_LIST) ||
								permissions.includes(
									PERMISSION_KEY_MAP.ORIENTATION_POINTS_DETAIL,
								) ||
								permissions.includes(
									PERMISSION_KEY_MAP.ORIENTATION_POINTS_ADD_POINTS,
								)
							)
						},
					},
				],
			},
			{
				key: RoutePath.PlatformManage,
				label: t("nav.platformSubMenu.platformManage"),
				validate: (permissions: string[], isSuperAdmin?: boolean) => {
					return (
						isSuperAdmin ||
						PLATFORM_SYSTEM_SETTING.some((permission) =>
							permissions.includes(permission),
						)
					)
				},
				children: [
					{
						key: RoutePath.PlatformInfoManagement,
						label: t("nav.platformSubMenu.platformInfo"),
						icon: <IconInfoCircle size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(
									PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
								) ||
								permissions.includes(
									PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT,
								)
							)
						},
					},
				{
					key: RoutePath.PlatformAppMenu,
					label: t("nav.platformSubMenu.applicationMenu"),
					icon: <IconMenu2 size={20} />,
					validate: (permissions: string[], isSuperAdmin?: boolean) => {
						return (
							isSuperAdmin ||
							permissions.includes(PERMISSION_KEY_MAP.APP_MENU_QUERY) ||
							permissions.includes(PERMISSION_KEY_MAP.APP_MENU_EDIT)
						)
					},
				},
				{
					key: RoutePath.PlatformProxyServer,
						label: t("nav.platformSubMenu.proxyServer"),
						icon: <IconServerSpark size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.PROXY_SERVER_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.PROXY_SERVER_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformAIAudit,
						label: t("nav.platformSubMenu.audit"),
						icon: <IconMessageCheck size={20} />,
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
						key: RoutePath.PlatformMaintenance,
						label: t("nav.platformSubMenu.platformMaintenance"),
						icon: <IconTool size={20} />,
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
		]
	}, [t, isOfficialOrg])

	return <SecondaryLayout items={items} openKeys={[RoutePath.PlatformPaidPackage]} />
}

export default PlatformPackageLayout
