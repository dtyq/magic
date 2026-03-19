import { GroupConversationMember } from "@/types/chat/conversation"
import { GroupInfo } from "@/types/organization"
import { makeAutoObservable } from "mobx"

class GroupInfoStore {
	map: Map<IDBValidKey, GroupInfo> = new Map()

	currentGroup: GroupInfo | undefined

	currentGroupMembers: GroupConversationMember[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get(key: string): GroupInfo | undefined {
		return this.map.get(key)
	}

	set(key: string, value: GroupInfo) {
		this.map.set(key, value)
	}

	get currentGroupId() {
		return this.currentGroup?.id
	}

	/**
	 * 设置当前群聊
	 * @param group 群聊
	 */
	setCurrentGroup(group: GroupInfo) {
		this.currentGroup = group
	}

	/**
	 * 设置当前群聊成员
	 * @param members 成员
	 */
	setCurrentGroupMembers(members: GroupConversationMember[]) {
		this.currentGroupMembers = members
	}

	/**
	 * 移除群组成员
	 * @param userIds 用户ID
	 */
	removeGroupMembers(userIds: string[]) {
		this.currentGroupMembers = this.currentGroupMembers.filter(
			(member) => !userIds.includes(member.user_id),
		)
	}
}

export default new GroupInfoStore()
