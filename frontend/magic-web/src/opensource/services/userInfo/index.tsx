import type { DataContextDb } from "@/opensource/database/data-context/types"
import type { StructureUserItem } from "@/opensource/types/organization"
import { fetchPaddingData } from "@/opensource/utils/request"
import type { IndexableType, Table } from "dexie"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import userInfoStore from "@/opensource/stores/userInfo"
import { ContactApi } from "@/opensource/apis"

/**
 * 用户信息上下文
 */
class UserInfoService {
	static STORE_NAME = "user_info"

	initd = false

	table: Table<StructureUserItem, IndexableType, StructureUserItem> | undefined

	database: DataContextDb | undefined

	promise: Promise<void> | undefined

	constructor(db?: DataContextDb) {
		this.loadData(db)
	}

	/**
	 * 拉取用户信息
	 * @param userIds 用户ID
	 * @param queryType 查询类型
	 * @returns 用户信息
	 */
	fetchUserInfos(userIds: string[], queryType: 1 | 2) {
		return fetchPaddingData((params) =>
			ContactApi.getUsersInfo({
				user_ids: userIds,
				query_type: queryType ?? 2,
				...params,
			}),
		).then((data) => {
			data.forEach((item) => {
				userInfoStore.set(item.user_id, { ...userInfoStore.get(item.user_id), ...item })
			})
			return data
		})
	}

	/**
	 * 从数据库加载数据
	 * @param db 数据库
	 * @returns 数据
	 */
	loadData(db?: DataContextDb) {
		this.database = db
		this.promise = this.database?.user_info
			.each((item) => {
				userInfoStore.set(item.user_id, item)
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
	 * 设置用户信息
	 * @param key 用户ID
	 * @param value 用户信息
	 */
	set(key: string, value: StructureUserItem) {
		const avatarUrl = value.avatar_url
		const relatedAvatarUrl = value.avatar_url

		const info = {
			...value,
			avatar_url: avatarUrl,
			related_avatar_url: relatedAvatarUrl,
		}

		userInfoStore.set(key, info)
		this.database?.user_info.put(info)
	}
}

const userInfoService = new UserInfoService()

export default userInfoService
