import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import SecondaryLayout from "@admin/layouts/SecondaryLayout"
import { RoutePath } from "@admin/const/routes"
import {
	IconPhotoAi,
	IconSubtitlesAi,
	IconVideo,
	IconUsers,
	IconSettingsAi,
} from "@tabler/icons-react"
import {
	AI_CUSTOM_MODEL,
	AI_INTERNAL_EMPLOYEE_SKILL,
	PERMISSION_KEY_MAP,
} from "@admin/const/common"
import { useAdminStore } from "@admin/stores/admin"

function AIManagerLayout() {
	const { t } = useTranslation("admin/common")
	const { isOfficialOrg, isPersonalOrganization } = useAdminStore()
	const items = useMemo(() => {
		return [
			{
				key: RoutePath.AICustomModel,
				label: t("nav.aiSubMenu.customModel"),
				hidden: isOfficialOrg,
				validate: (permissions: string[], isSuperAdmin?: boolean) => {
					return (
						isSuperAdmin ||
						AI_CUSTOM_MODEL.some((permission) => permissions.includes(permission))
					)
				},
				children: [
					{
						key: RoutePath.AIModel,
						label: t("nav.platformSubMenu.modelManagement"),
						icon: <IconSubtitlesAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(PERMISSION_KEY_MAP.MODEL_MANAGEMENT_QUERY) ||
								permissions.includes(PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT)
							)
						},
					},
					{
						key: RoutePath.AIDrawing,
						label: t("nav.platformSubMenu.intelligentDrawing"),
						icon: <IconPhotoAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(
									PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY,
								) ||
								permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT)
							)
						},
					},
					{
						key: RoutePath.AIVideo,
						label: t("nav.platformSubMenu.videoManagement"),
						icon: <IconVideo size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								permissions.includes(
									PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY,
								) ||
								permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT)
							)
						},
					},
				],
			},
			{
				key: RoutePath.AIInternalEmployeeSkill,
				label: t("nav.aiSubMenu.internalEmployeeSkill"),
				hidden: isPersonalOrganization,
				validate: (permissions: string[], isSuperAdmin?: boolean) => {
					return (
						isSuperAdmin ||
						AI_INTERNAL_EMPLOYEE_SKILL.some((permission) =>
							permissions.includes(permission),
						)
					)
				},
				children: [
					{
						key: RoutePath.AIEmployeeReview,
						label: t("nav.aiSubMenu.employeePublishReview"),
						icon: <IconUsers size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								AI_INTERNAL_EMPLOYEE_SKILL.some((permission) =>
									permissions.includes(permission),
								)
							)
						},
					},
					{
						key: RoutePath.AISkillReview,
						label: t("nav.aiSubMenu.skillPublishReview"),
						icon: <IconSettingsAi size={20} />,
						validate: (permissions: string[], isSuperAdmin?: boolean) => {
							return (
								isSuperAdmin ||
								AI_INTERNAL_EMPLOYEE_SKILL.some((permission) =>
									permissions.includes(permission),
								)
							)
						},
					},
				],
			},
		]
	}, [t, isOfficialOrg, isPersonalOrganization])

	return <SecondaryLayout items={items} openKeys={[RoutePath.AICustomModel]} />
}

export default AIManagerLayout
