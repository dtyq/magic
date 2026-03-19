import OrganizationDotsStore from "@/stores/chatNew/dots/OrganizationDotsStore"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"
import { observe } from "mobx"

class OrganizationDotsDbService {
	magicId: string | undefined

	constructor() {
		// 监听用户信息变化
		observe(userStore.user, "userInfo", (change) => {
			const newUserInfo = change.newValue
			if (newUserInfo?.magic_id && this.magicId !== newUserInfo.magic_id) {
				this.magicId = newUserInfo.magic_id
				// 加载持久化数据
				OrganizationDotsStore.reset(this.getPersistenceData(), this.getDotSeqIdData())
			}
		})
	}

	get dot_seqid_key() {
		return platformKey(`organization_dots_seqid/${this.magicId}`)
	}

	/**
	 * 持久化数据key
	 */
	get persistence_key() {
		return platformKey(`organization_dots/${this.magicId}`)
	}

	/**
	 * 获取持久化数据
	 * @returns 持久化数据
	 */
	getPersistenceData() {
		const data = localStorage.getItem(this.persistence_key)
		if (!data) return {}
		return JSON.parse(data)
	}

	/**
	 * 设置持久化数据
	 * @param data 持久化数据
	 */
	setPersistenceData(data: Record<string, number>) {
		localStorage.setItem(this.persistence_key, JSON.stringify(data))
	}

	/**
	 * 获取最后更新红点的seqid数据
	 * @returns dot_seqid数据
	 */
	getDotSeqIdData() {
		const data = localStorage.getItem(this.dot_seqid_key)
		if (!data) return {}
		return JSON.parse(data)
	}

	/**
	 * 设置最后更新红点的seqid数据
	 * @param data 最后更新红点的seqid数据
	 */
	setDotSeqIdData(data: Record<string, string>) {
		localStorage.setItem(this.dot_seqid_key, JSON.stringify(data))
	}
}

export default new OrganizationDotsDbService()
