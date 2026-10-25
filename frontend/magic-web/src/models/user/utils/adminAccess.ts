/**
 * 天书后台身份 identifications。
 * 与商业版管理后台 PERMISSION_KEY_MAP 对齐：超管 / 组织所有者 / 子管理员均可进入后台。
 */
export const TEAMSHARE_ADMIN_IDENTIFICATIONS = [
	"super_admin",
	"organization_owner",
	"sub_admin",
] as const

/** 天书后台细粒度权限前缀，例如 TeamshareOS_console_organization.read */
export const TEAMSHARE_ADMIN_PERMISSION_PREFIX = "TeamshareOS_"

const TEAMSHARE_ADMIN_IDENTIFICATION_SET: Set<string> = new Set(TEAMSHARE_ADMIN_IDENTIFICATIONS)

export function hasTeamshareAdminIdentification(
	identifications: string[] | null | undefined,
): boolean {
	if (!identifications?.length) return false
	return identifications.some(
		(identification) =>
			TEAMSHARE_ADMIN_IDENTIFICATION_SET.has(identification) ||
			identification.startsWith(TEAMSHARE_ADMIN_PERMISSION_PREFIX),
	)
}

export function hasMagicAdminPermission(permissions: string[] | null | undefined): boolean {
	if (!permissions?.length) return false
	return permissions.some(
		(permission) =>
			permission === "MAGIC_ALL_PERMISSIONS" ||
			permission === "MAGIC_PLATFORM_PERMISSIONS" ||
			permission.startsWith("admin.") ||
			permission.startsWith("workspace.") ||
			permission.startsWith("platform."),
	)
}
