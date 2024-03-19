import { UserType } from "@/opensource/types/user"
import type { User } from "@/opensource/types/user"
import type { StructureUserItem, PathNode } from "@/opensource/types/organization"
import DepartmentRender from "../../DepartmentRender"

/**
 * Check if user is AI type
 */
export function isAiUser(userType?: UserType): boolean {
	return userType === UserType.AI
}

/**
 * Check if user is normal person
 */
export function isNormalUser(userType?: UserType): boolean {
	return userType === UserType.Normal
}

/**
 * Generate description items for AI user
 */
export function generateAiUserItems(userInfo: StructureUserItem, t: (key: string) => string) {
	return [
		{
			key: "assistantIntroduction",
			label: t("memberCard.assistantIntroduction"),
			children: userInfo.description,
		},
	]
}

/**
 * Generate description items for normal user
 */
export function generateNormalUserItems(
	userInfo: StructureUserItem,
	organization: User.MagicOrganization | undefined,
	t: (key: string) => string,
) {
	return [
		{
			key: "enterprise/organization",
			label: t("memberCard.enterprise_organization"),
			children: organization?.organization_name,
		},
		{
			key: "title",
			label: t("memberCard.title"),
			children: userInfo.job_title,
		},
		{
			key: "email",
			label: t("memberCard.email"),
			children: userInfo.email,
		},
		...(userInfo.path_nodes?.map((item: PathNode) => ({
			key: item.department_id,
			label: t("memberCard.department"),
			children: (
				<DepartmentRender
					path={item.path.replace("-1/", "")}
					separator=" / "
					allowNavigate
				/>
			),
		})) ?? []),
		{
			key: "phone",
			label: t("memberCard.phone"),
			children: userInfo.phone,
		},
	]
}

/**
 * Generate description items based on user type
 */
export function generateDescriptionItems(
	userInfo: StructureUserItem | null,
	organization: User.MagicOrganization | undefined,
	t: (key: string) => string,
) {
	if (!userInfo) return []

	const userType = userInfo.user_type

	switch (userType) {
		case UserType.AI:
			return generateAiUserItems(userInfo, t)
		case UserType.Normal:
			return generateNormalUserItems(userInfo, organization, t)
		default:
			return []
	}
}
