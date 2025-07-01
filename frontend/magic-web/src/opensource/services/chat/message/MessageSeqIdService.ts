import localstorage from "@/utils/localstorage"
import { bigNumCompare } from "@/utils/string"
import { userStore } from "@/opensource/models/user"
import { platformKey } from "@/utils/storage"

class MessageSeqIdService {
	seqIdMap: Record<string, string | Record<string, string>> = {}

	// eslint-disable-next-line class-methods-use-this
	get magicId() {
		return userStore.user.userInfo?.magic_id
	}

	/**
	 * 获取全局最后拉取消息序列号的存储键
	 */
	private get globalPullSeqIdKey() {
		return platformKey(`pullLastSeqId/${this.magicId}`)
	}

	/**
	 * 获取会话级别最后拉取消息序列号的存储键
	 */
	private get conversationPullSeqIdKey() {
		return platformKey(`conversationPullSeqId/${this.magicId}`)
	}

	/**
	 * 获取组织级别最后渲染消息序列号的存储键
	 */
	private get renderLastSeqIdKey() {
		return platformKey(`renderLastSeqId/${this.magicId}`)
	}

	/**
	 * 获取会话级别最后拉取消息序列号的存储键
	 */
	private get conversationdRenerSeqIdKey() {
		return platformKey(`conversationRenderSeqId/${this.magicId}`)
	}

	// ========== 全局拉取序列号管理 ==========
	private getGlobalPullSeqIdFromLocalStorage(): string {
		return localstorage.get(this.globalPullSeqIdKey) ?? ""
	}

	private getGlobalPullSeqIdFromMemory(): string {
		return this.seqIdMap[this.globalPullSeqIdKey] as string
	}

	/**
	 * 获取全局最后拉取的序列号
	 */
	public getGlobalPullSeqId(): string {
		// 优先从内存中获取
		if (this.seqIdMap[this.globalPullSeqIdKey]) {
			return this.getGlobalPullSeqIdFromMemory()
		}
		// 从本地存储中获取
		return this.getGlobalPullSeqIdFromLocalStorage()
	}

	/**
	 * 更新全局最后拉取的序列号
	 */
	public updateGlobalPullSeqId(seqId: string): void {
		// 判断seqId
		const globalSeqId = this.getGlobalPullSeqIdFromLocalStorage()
		if (bigNumCompare(seqId, globalSeqId) > 0) {
			// 更新本地存储
			localstorage.set(this.globalPullSeqIdKey, seqId)
		}

		const sessionSeqId = this.getGlobalPullSeqIdFromMemory()
		if (!sessionSeqId || (sessionSeqId && bigNumCompare(seqId, sessionSeqId) > 0)) {
			// 更新内存
			this.seqIdMap[this.globalPullSeqIdKey] = seqId
		}
	}

	// ========== 会话级别拉取序列号管理 ==========
	private getConversationPullSeqIdFromLocalStorage(): Record<string, string> {
		return localstorage.get(this.conversationPullSeqIdKey, true) ?? {}
	}

	private getConversationPullSeqIdFromMemory(): Record<string, string> {
		if (!this.seqIdMap[this.conversationPullSeqIdKey]) {
			this.seqIdMap[this.conversationPullSeqIdKey] = {}
		}
		return this.seqIdMap[this.conversationPullSeqIdKey] as Record<string, string>
	}

	/**
	 * 获取所有会话的拉取序列号映射
	 */
	public getConversationPullSeqIds(): Record<string, string> {
		if (this.seqIdMap[this.conversationPullSeqIdKey]) {
			return this.getConversationPullSeqIdFromMemory()
		}
		return this.getConversationPullSeqIdFromLocalStorage()
	}

	/**
	 * 获取指定会话的拉取序列号
	 */
	public getConversationPullSeqId(conversationId: string): string {
		if (this.seqIdMap[this.conversationPullSeqIdKey]) {
			const seqIds = this.getConversationPullSeqIdFromMemory()
			return seqIds[conversationId] ?? ""
		}

		return this.getConversationPullSeqIds()[conversationId] ?? ""
	}

	// /**
	//  * 设置所有会话的拉取序列号映射
	//  */
	// public setConversationPullSeqIds(seqIds: Record<string, string>): void {
	// 	// 判断seqIds
	// 	const conversationSeqIds = this.getConversationPullSeqIdFromLocalStorage()
	// 	Object.entries(seqIds).forEach(([conversationId, seqId]) => {
	// 		if (bigNumCompare(seqId, conversationSeqIds[conversationId] ?? "0") > 0) {
	// 			conversationSeqIds[conversationId] = seqId
	// 		}
	// 	})

	// 	// 更新本地存储
	// 	localstorage.set(this.conversationPullSeqIdKey, conversationSeqIds)

	// 	const sessionSeqIds = this.getConversationPullSeqIdFromMemory()
	// 	Object.entries(seqIds).forEach(([conversationId, seqId]) => {
	// 		if (bigNumCompare(seqId, sessionSeqIds[conversationId] ?? "0") > 0) {
	// 			sessionSeqIds[conversationId] = seqId
	// 		}
	// 	})
	// 	this.seqIdMap[this.conversationPullSeqIdKey] = sessionSeqIds
	// }
	private setGlobalConversationPullSeqIds(seqIds: Record<string, string>): void {
		// 更新全局缓存
		localstorage.set(this.conversationPullSeqIdKey, seqIds)
	}

	private setSessionConversationPullSeqIds(seqIds: Record<string, string>): void {
		// 更新临时缓存
		this.seqIdMap[this.conversationPullSeqIdKey] = seqIds
	}

	/**
	 * 更新指定会话的拉取序列号
	 */
	public updateConversationPullSeqId(conversationId: string, seqId: string): void {
		// 判断seqId，分开更新
		const globalSeqIds = this.getConversationPullSeqIdFromLocalStorage()

		if (bigNumCompare(seqId, globalSeqIds[conversationId] ?? "0") > 0) {
			globalSeqIds[conversationId] = seqId
			this.setGlobalConversationPullSeqIds(globalSeqIds)
		}

		const sessionSeqIds = this.getConversationPullSeqIdFromMemory()
		if (bigNumCompare(seqId, sessionSeqIds[conversationId] ?? "0") > 0) {
			sessionSeqIds[conversationId] = seqId
			this.setSessionConversationPullSeqIds(sessionSeqIds)
		}
	}

	/**
	 * 删除指定会话的拉取序列号
	 */
	public deleteConversationPullSeqId(conversationId: string): void {
		// 更新全局缓存
		const globalSeqIds = this.getConversationPullSeqIdFromLocalStorage()
		delete globalSeqIds[conversationId]
		this.setGlobalConversationPullSeqIds(globalSeqIds)

		// 更新临时缓存
		const sessionSeqIds = this.getConversationPullSeqIdFromMemory()
		delete sessionSeqIds[conversationId]
		this.setSessionConversationPullSeqIds(sessionSeqIds)
	}

	// ========== 组织级别渲染序列号管理 ==========
	private getOrganizationRenderObjectFromLocalStorage(): Record<string, string> {
		return JSON.parse(localstorage.get(this.renderLastSeqIdKey) ?? "{}")
	}

	private getOrganizationRenderObjectFromMemory(): Record<string, string> {
		if (!this.seqIdMap[this.renderLastSeqIdKey]) {
			this.seqIdMap[this.renderLastSeqIdKey] = {}
		}
		return this.seqIdMap[this.renderLastSeqIdKey] as Record<string, string>
	}

	/**
	 * 获取组织级别渲染对象
	 */
	public getOrganizationRenderObject(): Record<string, string> {
		if (this.seqIdMap[this.renderLastSeqIdKey]) {
			return this.getOrganizationRenderObjectFromMemory()
		}
		return this.getOrganizationRenderObjectFromLocalStorage()
	}

	private setGlobalOrganizationRenderObject(object: Record<string, string>): void {
		localstorage.set(this.renderLastSeqIdKey, object)
	}

	private setSessionOrganizationRenderObject(object: Record<string, string>): void {
		this.seqIdMap[this.renderLastSeqIdKey] = object
	}

	/**
	 * 获取组织级别渲染序列号
	 */
	public getOrganizationRenderSeqId(organization_code: string) {
		if (!organization_code) {
			return ""
		}

		if (this.seqIdMap[this.renderLastSeqIdKey]) {
			return this.getOrganizationRenderObject()[organization_code] ?? ""
		}

		return this.getOrganizationRenderObject()[organization_code] ?? ""
	}

	public updateOrganizationRenderSeqId(organization_code: string, seq_id: string): void {
		const globalSeqIds = this.getOrganizationRenderObjectFromLocalStorage()

		if (bigNumCompare(seq_id, globalSeqIds[organization_code] ?? "0") > 0) {
			globalSeqIds[organization_code] = seq_id
			this.setGlobalOrganizationRenderObject(globalSeqIds)
		}

		const sessionSeqIds = this.getOrganizationRenderObjectFromMemory()
		if (bigNumCompare(seq_id, sessionSeqIds[organization_code] ?? "0") > 0) {
			sessionSeqIds[organization_code] = seq_id
			this.setSessionOrganizationRenderObject(sessionSeqIds)
		}
	}

	// ========== 会话级别渲染序列号管理 ==========
	private getConversationRenderSeqIdFromLocalStorage(): Record<string, string> {
		return localstorage.get(this.conversationdRenerSeqIdKey, true) ?? {}
	}

	private getConversationRenderSeqIdFromMemory(): Record<string, string> {
		if (!this.seqIdMap[this.conversationdRenerSeqIdKey]) {
			this.seqIdMap[this.conversationdRenerSeqIdKey] = {}
		}
		return this.seqIdMap[this.conversationdRenerSeqIdKey] as Record<string, string>
	}

	/**
	 * 获取所有会话的渲染序列号映射
	 */
	public getConversationRenderSeqIds(): Record<string, string> {
		if (this.seqIdMap[this.conversationdRenerSeqIdKey]) {
			return this.getConversationRenderSeqIdFromMemory()
		}
		return this.getConversationRenderSeqIdFromLocalStorage()
	}

	/**
	 * 获取指定会话的渲染序列号
	 */
	public getConversationRenderSeqId(conversationId: string): string {
		if (this.seqIdMap[this.conversationdRenerSeqIdKey]) {
			return this.getConversationRenderSeqIdFromMemory()[conversationId] ?? ""
		}

		return this.getConversationRenderSeqIds()[conversationId] ?? ""
	}

	private setGlobalConversationRenderSeqIds(seqIds: Record<string, string>): void {
		localstorage.set(this.conversationdRenerSeqIdKey, seqIds)
	}

	private setSessionConversationRenderSeqIds(seqIds: Record<string, string>): void {
		this.seqIdMap[this.conversationdRenerSeqIdKey] = seqIds
	}

	/**
	 * 更新指定会话的渲染序列号
	 */
	public updateConversationRenderSeqId(conversationId: string, seqId: string): void {
		const globalSeqIds = this.getConversationRenderSeqIdFromLocalStorage()
		if (bigNumCompare(seqId, globalSeqIds[conversationId] ?? "0") > 0) {
			globalSeqIds[conversationId] = seqId
			this.setGlobalConversationRenderSeqIds(globalSeqIds)
		}

		const sessionSeqIds = this.getConversationRenderSeqIdFromMemory()
		if (bigNumCompare(seqId, sessionSeqIds[conversationId] ?? "0") > 0) {
			sessionSeqIds[conversationId] = seqId
			this.setSessionConversationRenderSeqIds(sessionSeqIds)
		}
	}

	/**
	 * 删除指定会话的渲染序列号
	 */
	public deleteConversationRenderSeqId(conversationId: string): void {
		const globalSeqIds = this.getConversationRenderSeqIdFromLocalStorage()
		delete globalSeqIds[conversationId]
		this.setGlobalConversationRenderSeqIds(globalSeqIds)

		const sessionSeqIds = this.getConversationRenderSeqIdFromMemory()
		delete sessionSeqIds[conversationId]
		this.setSessionConversationRenderSeqIds(sessionSeqIds)
	}

	// ========== 批量操作 ==========
	/**
	 * 清除指定会话的所有序列号
	 */
	public clearConversationSeqIds(conversationId: string): void {
		this.deleteConversationPullSeqId(conversationId)
		this.deleteConversationRenderSeqId(conversationId)
	}

	/**
	 * 清除所有序列号
	 */
	public clearAllSeqIds(): void {
		localstorage.remove(this.globalPullSeqIdKey)
		localstorage.remove(this.conversationPullSeqIdKey)
		localstorage.remove(this.renderLastSeqIdKey)
	}

	/**
	 * 初始化所有组织的渲染序列号
	 */
	public initAllOrganizationRenderSeqId(seqId: string) {
		const allOrganization = userStore.user.magicOrganizationMap
		this.setGlobalOrganizationRenderObject(
			Object.values(allOrganization).reduce((prev, current) => {
				prev[current.magic_organization_code] = seqId
				return prev
			}, {} as Record<string, string>),
		)
		this.setSessionOrganizationRenderObject(
			Object.values(allOrganization).reduce((prev, current) => {
				prev[current.magic_organization_code] = seqId
				return prev
			}, {} as Record<string, string>),
		)
	}

	/**
	 * 检查所有组织的渲染序列号(避免新增组织，导致渲染序列号缺失)
	 */
	checkAllOrganizationRenderSeqId() {
		const allOrganization = userStore.user.magicOrganizationMap
		const allOrganizationRenderSeqId = this.getOrganizationRenderObject()

		Object.values(allOrganization).forEach((organization) => {
			if (!allOrganizationRenderSeqId[organization.magic_organization_code]) {
				allOrganizationRenderSeqId[organization.magic_organization_code] =
					this.getGlobalPullSeqId()
			}
		})

		this.setGlobalOrganizationRenderObject(allOrganizationRenderSeqId)
		this.setSessionOrganizationRenderObject(allOrganizationRenderSeqId)
	}
}

export default new MessageSeqIdService()
