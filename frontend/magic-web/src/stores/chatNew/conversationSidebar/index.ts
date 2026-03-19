import { ConversationGroupKey } from "@/constants/chat"
import { last } from "lodash-es"
import { makeAutoObservable } from "mobx"
import conversationStore from "../conversation"

class ConversationSiderbarStore {
	/**
	 * 侧边栏会话组
	 */
	conversationSiderbarGroups: Record<ConversationGroupKey, string[]> = {
		[ConversationGroupKey.Top]: [],
		[ConversationGroupKey.Single]: [],
		[ConversationGroupKey.User]: [],
		[ConversationGroupKey.AI]: [],
		[ConversationGroupKey.Group]: [],
		[ConversationGroupKey.Other]: [],
	}

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 添加会话到组
	 * @param groupKey 组
	 * @param conversationId 会话ID
	 */
	addConversationToGroup(groupKey: ConversationGroupKey, conversationId: string) {
		if (!this.conversationSiderbarGroups[groupKey]) {
			this.conversationSiderbarGroups[groupKey] = []
		}

		this.moveConversationFirst(conversationId, groupKey)

		// 如果是在用户组或者AI组, 则需要同时添加到单聊组
		if ([ConversationGroupKey.User, ConversationGroupKey.AI].includes(groupKey)) {
			this.moveConversationFirst(conversationId, ConversationGroupKey.Single)
		}
	}

	/**
	 * 移除会话从组
	 * @param groupKey 组
	 * @param conversationId 会话ID
	 */
	removeConversationFromGroup(
		groupKey: ConversationGroupKey,
		conversationId: string,
	): string | undefined {
		const index = this.conversationSiderbarGroups[groupKey].indexOf(conversationId)
		let nextConversationId

		if (index !== -1) {
			this.conversationSiderbarGroups[groupKey].splice(index, 1)
			nextConversationId =
				index > this.conversationSiderbarGroups[groupKey].length - 1
					? last(this.conversationSiderbarGroups[groupKey])
					: this.conversationSiderbarGroups[groupKey][index]
		} else {
			;[nextConversationId] = this.conversationSiderbarGroups[groupKey]
		}

		// 如果是在用户组或者AI组, 则需要同时移除单聊组
		if ([ConversationGroupKey.User, ConversationGroupKey.AI].includes(groupKey)) {
			const singleIndex =
				this.conversationSiderbarGroups[ConversationGroupKey.Single].indexOf(conversationId)
			if (singleIndex !== -1) {
				this.conversationSiderbarGroups[ConversationGroupKey.Single].splice(singleIndex, 1)
				nextConversationId =
					singleIndex >
						this.conversationSiderbarGroups[ConversationGroupKey.Single].length - 1
						? last(this.conversationSiderbarGroups[ConversationGroupKey.Single])
						: this.conversationSiderbarGroups[ConversationGroupKey.Single][singleIndex]
			} else {
				;[nextConversationId] = this.conversationSiderbarGroups[ConversationGroupKey.Single]
			}
		}

		return nextConversationId
	}

	/**
	 * 重置会话组
	 */
	resetConversationSidebarGroups() {
		this.conversationSiderbarGroups = {
			[ConversationGroupKey.Top]: [],
			[ConversationGroupKey.Single]: [],
			[ConversationGroupKey.User]: [],
			[ConversationGroupKey.AI]: [],
			[ConversationGroupKey.Group]: [],
			[ConversationGroupKey.Other]: [],
		}
	}

	/**
	 * 更新会话组
	 * @param groupKey 组
	 * @param conversationIds 会话ID列表
	 */
	updateConversationSiderbarGroups(groupKey: ConversationGroupKey, conversationIds: string[]) {
		this.conversationSiderbarGroups[groupKey] = Array.from(new Set(conversationIds))
	}

	/**
	 * 获取会话组
	 * @param groupKey 组
	 * @returns 会话ID列表
	 */
	getConversationSiderbarGroups() {
		return this.conversationSiderbarGroups
	}

	/**
	 * 获取会话组
	 * @param groupKey 组
	 * @returns 会话ID列表
	 */
	getConversationSiderbarGroup(groupKey: ConversationGroupKey) {
		return this.conversationSiderbarGroups[groupKey]
	}

	/**
	 * 设置会话组
	 * @param conversationSiderbarGroups 会话组
	 */
	setConversationSidebarGroups(
		conversationSiderbarGroups: Record<ConversationGroupKey, string[]>,
	) {
		this.conversationSiderbarGroups = conversationSiderbarGroups
	}

	/**
	 * 移动会话到最上面
	 * @param conversation_id 会话ID
	 */
	moveConversationFirst(conversation_id: string, menuKey: ConversationGroupKey) {
		if (!conversation_id) return

		const index = this.conversationSiderbarGroups[menuKey].indexOf(conversation_id)

		// 如果存在，则移除
		if (index !== -1) {
			this.conversationSiderbarGroups[menuKey].splice(index, 1)
		}

		// 添加到最上面
		this.conversationSiderbarGroups[menuKey].unshift(conversation_id)
	}

	/**
	 * 移动到所有置顶会话的下面
	 * @param conversation_id 会话ID
	 * @param menuKey 组
	 */
	moveAfterTopConversations(conversation_id: string, menuKey: ConversationGroupKey) {
		if (!conversation_id) return

		// 移除会话
		const index = this.conversationSiderbarGroups[menuKey].findIndex(
			(id) => id === conversation_id,
		)
		this.conversationSiderbarGroups[menuKey].splice(index, 1)

		// 移动到所有置顶会话的下面
		const firstIndexNotTop = this.conversationSiderbarGroups[menuKey].findIndex(
			(id) => !conversationStore.conversations[id].is_top,
		)
		if (firstIndexNotTop !== -1) {
			this.conversationSiderbarGroups[menuKey].splice(firstIndexNotTop, 0, conversation_id)
		} else {
			this.conversationSiderbarGroups[menuKey].push(conversation_id)
		}
	}
}

const conversationSiderbarStore = new ConversationSiderbarStore()

declare global {
	interface Window {
		ConversationSiderbarStore: ConversationSiderbarStore
	}
}

window.ConversationSiderbarStore = conversationSiderbarStore

export default conversationSiderbarStore
