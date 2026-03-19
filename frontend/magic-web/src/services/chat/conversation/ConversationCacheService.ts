import type { ConversationGroupKey } from "@/constants/chat"
import { platformKey, unwrapperVersion, wrapperVersion } from "@/utils/storage"

class ConversationCacheServices {
	static version = 0

	/**
	 * 获取侧边栏会话组缓存key
	 * @returns 缓存key
	 */
	static getConversationSiderbarGroupsKey(magicId: string, organizationCode: string) {
		return platformKey(`conversation_siderbar/${magicId}/${organizationCode}`)
	}

	/**
	 * 缓存侧边栏会话组
	 */
	static cacheConversationSiderbarGroups(
		magicId: string | undefined,
		organizationCode: string | undefined,
		conversationSiderbarGroups: Record<ConversationGroupKey, string[]>,
	) {
		requestIdleCallback(() => {
			if (!magicId || !organizationCode) return
			const key = ConversationCacheServices.getConversationSiderbarGroupsKey(
				magicId,
				organizationCode,
			)
			const value = JSON.stringify(
				wrapperVersion(conversationSiderbarGroups, ConversationCacheServices.version),
			)
			localStorage.setItem(key, value)
		})
	}

	/**
	 * 获取缓存的侧边栏会话组
	 * @param magicId 魔法ID
	 * @param organizationCode 组织编码
	 * @returns 缓存的侧边栏会话组
	 */
	static getCacheConversationSiderbarGroups(magicId: string, organizationCode: string) {
		if (!magicId || !organizationCode) return undefined
		const key = ConversationCacheServices.getConversationSiderbarGroupsKey(
			magicId,
			organizationCode,
		)
		const value = localStorage.getItem(key)
		return value ? unwrapperVersion(JSON.parse(value)) : undefined
	}
}

export default ConversationCacheServices
