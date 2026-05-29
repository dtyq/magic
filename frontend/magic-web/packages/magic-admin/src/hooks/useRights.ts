import { useAdminStore } from "@admin/stores/admin"
import { PERMISSION_KEY_MAP } from "../const/common"

export default function useRights(keys: string | string[]) {
	const { userPermissions } = useAdminStore()

	const permissionsList = userPermissions

	// 优先处理超级管理员与组织所有者权限
	if (
		permissionsList.some(
			(p) =>
				p === PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS ||
				p === PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS ||
				p === PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS,
		)
	)
		return true

	/* 是否拥有权限 */
	return permissionsList.some((permission) => {
		if (Array.isArray(keys)) {
			return keys.includes(permission)
		}
		return permission === keys
	})
}
