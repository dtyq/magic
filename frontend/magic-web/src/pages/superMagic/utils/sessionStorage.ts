import { userStore } from "@/models/user"
import { User } from "@/types/user"
import { WorkspaceStateCache } from "./superMagicCache"

/**
 * 工作区/项目/话题状态 的本地缓存key，用于保存和读取状态
 * @returns 工作区/项目/话题状态 的本地缓存key
 * @deprecated Use WorkspaceStateCache.getKey() directly
 */
export const getWorkspaceStateSessionStorageKey = (userInfo: User.UserInfo | null) => {
	return WorkspaceStateCache.getKey(userInfo)
}

/**
 * 获取当前工作区/项目/话题状态
 * @returns 当前工作区/项目/话题状态
 * @deprecated Use WorkspaceStateCache.get() directly
 */
export const getWorkspaceSessionState = () => {
	const state = WorkspaceStateCache.get(userStore.user.userInfo)
	return {
		workspaceId: state.workspaceId || "",
		projectId: state.projectId || "",
		topicId: state.topicId || "",
	}
}
