import type { StructureUserItem } from "@/types/organization"
import type { User } from "@/types/user"

/**
 * 乐观更新失败回滚前保存用户信息快照：浅拷贝顶层字段并单独拷贝 preferences，
 * 避免与 store 内对象共享引用导致回滚时状态错乱。
 */
export function snapshotUserInfoForRollback<T extends User.UserInfo | StructureUserItem>(
	userInfo: T,
): T {
	return {
		...userInfo,
		preferences:
			userInfo.preferences != null ? { ...userInfo.preferences } : userInfo.preferences,
	}
}
