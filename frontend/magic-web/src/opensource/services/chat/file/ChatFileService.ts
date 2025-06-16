import { groupBy } from "lodash-es"
import type { ChatFileUrlData } from "@/types/chat/conversation_message"
import { makeAutoObservable } from "mobx"
import chatDb from "@/opensource/database/chat"
import { ChatApi } from "@/apis"

export interface FileCacheData extends ChatFileUrlData {
	file_id: string
	message_id: string
	url: string
	expires: number
}

/**
 * 聊天文件业务
 */
class ChatFileService {
	fileInfoCache: Map<string, FileCacheData> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 初始化
	 */
	init() {
		chatDb
			?.getFileUrlsTable()
			?.toArray()
			.then((res) => {
				console.log("res =======> ", res)
				res.forEach((item) => {
					this.fileInfoCache.set(item.file_id, item)
				})
			})
	}

	/**
	 * 获取文件信息缓存
	 */
	getFileInfoCache(fileId?: string) {
		if (!fileId) return undefined
		return this.fileInfoCache.get(fileId)
	}

	/**
	 * 缓存文件信息
	 */
	cacheFileUrl(fileInfo: ChatFileUrlData & { file_id: string; message_id: string }) {
		this.fileInfoCache.set(fileInfo.file_id, fileInfo)
		chatDb?.getFileUrlsTable()?.put(fileInfo)
	}

	/**
	 * 检查文件是否过期
	 */
	checkFileExpired(fileId: string, expiredTime: number = 30 * 60 * 1000) {
		const fileInfo = this.fileInfoCache.get(fileId)

		if (!fileInfo) return true

		// 如果还有半小时过期则认为过期
		return fileInfo.expires * 1000 < Date.now() + expiredTime
	}

	/**
	 * 获取文件信息
	 */
	fetchFileUrl(
		datas?: { file_id: string; message_id: string }[],
	): Promise<Record<string, FileCacheData>> {
		if (!datas || !datas.length) return Promise.resolve({})

		// 检测是否过期
		const { true: expired = [], false: notExpired = [] } = groupBy(datas, (item) => {
			return this.checkFileExpired(item.file_id)
		})

		if (expired.length > 0) {
			const messageIdMap = new Map(datas.map((item) => [item.file_id, item.message_id]))
			return ChatApi.getChatFileUrls(expired).then((res) => {
				const resArray = Object.entries(res)
				for (let i = 0; i < resArray.length; i += 1) {
					const [fileId, fileInfo] = resArray[i]
					this.cacheFileUrl({
						...fileInfo,
						file_id: fileId,
						message_id: messageIdMap.get(fileId) || "",
					})
				}

				// 返回文件信息
				return datas.reduce((acc, item) => {
					acc[item.file_id] = this.fileInfoCache.get(item.file_id)!
					return acc
				}, {} as Record<string, FileCacheData>)
			})
		}

		return Promise.resolve(
			notExpired.reduce((acc, item) => {
				acc[item.file_id] = this.fileInfoCache.get(item.file_id)!
				return acc
			}, {} as Record<string, FileCacheData>),
		)
	}
}

export default new ChatFileService()
