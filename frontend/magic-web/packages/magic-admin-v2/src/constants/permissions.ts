import { EditionPermissionKeyMap } from "@magic-admin-v2/constants/edition-permissions"
import { BasePermissionKeyMap } from "@magic-admin-v2/constants/permission-keys"

/**
 * 权限 key 映射。
 *
 * 开源 key 与企业 key 合并后的完整字典。具体路由是否使用某个权限，仍由路由配置决定。
 */
export const PERMISSION_KEY_MAP = {
	...BasePermissionKeyMap,
	...EditionPermissionKeyMap,
} as const satisfies Record<string, string>

/** 当前构建可引用的权限 key 联合类型。 */
export type PermissionKey = (typeof PERMISSION_KEY_MAP)[keyof typeof PERMISSION_KEY_MAP]
