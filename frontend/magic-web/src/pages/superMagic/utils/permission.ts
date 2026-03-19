import {
	CollaboratorPermission,
	CollaboratorPermissionEnum,
} from "@/pages/superMagic/types/collaboration"

/**
 * 是否可以管理项目
 * @param role CollaboratorPermission
 * @returns boolean
 */
export function canManageProject(role?: CollaboratorPermission) {
	if (!role) {
		return false
	}
	if (role === CollaboratorPermissionEnum.OWNER || role === CollaboratorPermissionEnum.MANAGE)
		return true
	return false
}

/**
 * 是否是只读项目
 * @param role CollaboratorPermission 项目角色
 * @returns boolean
 */
export function isReadOnlyProject(role?: CollaboratorPermission) {
	if (!role) {
		return false
	}
	return role === CollaboratorPermissionEnum.READONLY
}

/**
 * 是否是所有者
 * @param role CollaboratorPermission
 * @returns boolean
 */
export function isOwner(role?: CollaboratorPermission): boolean {
	if (!role) {
		return false
	}
	return role === CollaboratorPermissionEnum.OWNER
}
