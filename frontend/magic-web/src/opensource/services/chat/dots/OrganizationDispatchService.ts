import { userStore } from "@/opensource/models/user"
import OrganizationDotsStore from "@/opensource/stores/chatNew/dots/OrganizationDotsStore"

const OrganizationDispatchService = {
	/**
	 * 更新组织红点
	 * @param organizationCode 组织编码
	 * @param count 数量
	 * @param seqId 序号
	 */
	updateOrganizationDot({
		magicId,
		organizationCode,
		count,
		seqId,
	}: {
		magicId: string
		organizationCode: string
		count: number
		seqId?: string
	}) {
		if (magicId === userStore.user.userInfo?.magic_id) {
			OrganizationDotsStore.setOrganizationDots(organizationCode, count)

			if (seqId) {
				OrganizationDotsStore.setOrganizationDotSeqId(organizationCode, seqId)
			}
		}
	},
}

export default OrganizationDispatchService
