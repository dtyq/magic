import { ChatApi } from "@/apis"
import type { GroupInfo } from "@/types/organization"
import { fetchPaddingData } from "@/utils/request"
import type { IndexableType, Table } from "dexie"
import { makeAutoObservable, observable } from "mobx"
import type { GroupUpdateMessage } from "@/types/chat/control_message"
import groupInfoStore from "@/stores/groupInfo"
import userInfoService from "../userInfo"
import { DataContextDb } from "@/database/data-context/types"
/**
 * 群组信息上下文
 */
class GroupInfoSerivce {
	static STORE_NAME = "group_info"

	initd = false

	table: Table<GroupInfo, IndexableType, GroupInfo> | undefined

	database: DataContextDb | undefined

	promise: Promise<void> | undefined

	constructor(db?: DataContextDb) {
		this.loadData(db)
		makeAutoObservable(this, { database: observable.ref }, { autoBind: true })
	}

	loadData(db?: DataContextDb) {
		this.initd = false
		this.database = db
		this.promise = this.database?.group_info
			.each((item) => {
				groupInfoStore.set(item.id, item)
			})
			.then(() => {
				this.initd = true
			})

		return this.promise
	}

	setInitd(initd: boolean) {
		this.initd = initd
	}

	/**
	 * 拉取群组信息
	 * @param groupIds 群组ID
	 * @returns 群组信息
	 */
	fetchGroupInfos(groupIds: string[]) {
		return fetchPaddingData((params) =>
			ChatApi.getGroupConversationDetails({
				group_ids: groupIds,
				...params,
			}),
		).then((data) => {
			data.forEach((item) => {
				this.set(item.id, item)
				if (groupInfoStore.currentGroupId === item.id) {
					groupInfoStore.setCurrentGroup(item)
				}
			})
			return data
		})
	}

	fetchGroupMembers(groupId: string) {
		return fetchPaddingData((params) =>
			ChatApi.getGroupConversationMembers({
				group_id: groupId,
				...params,
			}),
		).then((data) => {
			groupInfoStore.setCurrentGroupMembers(data)
			const userIds = data.map((item) => item.user_id)
			return userInfoService.fetchUserInfos(userIds, 2)
		})
	}

	set(key: string, value: GroupInfo) {
		groupInfoStore.set(key, value)
		this.database?.table(GroupInfoSerivce.STORE_NAME).put(value)
	}

	updateGroupInfo(
		group_id: string,
		group_update: Partial<Omit<GroupUpdateMessage["group_update"], "group_id">>,
	) {
		const groupInfo = groupInfoStore.get(group_id)
		if (!groupInfo) return

		if (group_update.group_name) {
			groupInfo.group_name = group_update.group_name
		}
		if (group_update.group_avatar) {
			groupInfo.group_avatar = group_update.group_avatar
		}
		this.set(group_id, groupInfo)

		if (groupInfoStore.currentGroupId === group_id) {
			groupInfoStore.setCurrentGroup(groupInfo)
		}
	}
}

const groupInfoService = new GroupInfoSerivce()

export default groupInfoService
