import { makeAutoObservable } from "mobx"

class OrganizationDotsStore {
	dots: Record<string, number> = {}
	dotSeqId: Record<string, string> = {}

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 重置
	 */
	reset(data: Record<string, number>, seqId: Record<string, string>) {
		this.dots = data
		this.dotSeqId = seqId
	}

	/**
	 * 设置组织红点
	 * @param organizationCode 组织编码
	 * @param dots 红点数量
	 */
	setOrganizationDots(organizationCode: string, dots: number) {
		console.log("setOrganizationDots ====> ", organizationCode, dots)
		this.dots[organizationCode] = dots
	}

	/**
	 * 获取组织红点
	 * @param organizationCode 组织编码
	 * @returns 红点数量
	 */
	getOrganizationDots(organizationCode: string) {
		return this.dots[organizationCode] || 0
	}

	/**
	 * 清除组织红点
	 * @param organizationCode 组织编码
	 */
	clearOrganizationDots(organizationCode: string) {
		delete this.dots[organizationCode]
	}

	/**
	 * 清除所有组织红点
	 */
	clearAllOrganizationDots() {
		this.dots = {}
	}

	/**
	 * 设置组织红点seqid
	 * @param organizationCode 组织编码
	 * @param seqId seqid
	 */
	setOrganizationDotSeqId(organizationCode: string, seqId: string) {
		this.dotSeqId[organizationCode] = seqId
	}

	/**
	 * 获取组织红点seqid
	 * @param organizationCode 组织编码
	 * @returns seqid
	 */
	getOrganizationDotSeqId(organizationCode: string) {
		return this.dotSeqId[organizationCode] || ""
	}

	/**
	 * 清除组织红点seqid
	 * @param organizationCode 组织编码
	 */
	clearOrganizationDotSeqId(organizationCode: string) {
		delete this.dotSeqId[organizationCode]
	}

	/**
	 * 清除所有组织红点seqid
	 */
	clearAllOrganizationDotSeqId() {
		this.dotSeqId = {}
	}
}

export default new OrganizationDotsStore()
