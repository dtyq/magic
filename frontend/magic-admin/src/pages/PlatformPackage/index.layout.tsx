import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	IconInfoCircle,
	IconTool,
	IconRobot,
	IconSettingsAi,
	IconPhotoAi,
	IconSubtitlesAi,
	IconMenu2,
	IconUsers,
} from "@tabler/icons-react"
import { useAdminStore } from "@/stores/admin"

import {
	PERMISSION_KEY_MAP,
	PLATFORM_SYSTEM_SETTING,
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
					{
						key: RoutePath.PlatformAgentSkill,
						label: t("nav.platformSubMenu.systemSkill"),
						icon: <IconSettingsAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformAgentSkillMarket,
						label: t("nav.platformSubMenu.skillMarket"),
						icon: <IconSettingsAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformAgentEmployeeReview,
						label: t("nav.platformSubMenu.employeeReview"),
						icon: <IconUsers size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.PlatformAgentEmployeeMarket,
						label: t("nav.platformSubMenu.employeeMarket"),
						icon: <IconUsers size={20} />,
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
