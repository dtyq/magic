import ConversationDotsService from "./ConversationDotsService"
import OrganizationDotsService from "./OrganizationDotsService"

const DotsService = {
	// 增加会话未读数量
	addConversationUnreadDots(
		organizationId: string,
		conversationId: string,
		topicId: string,
		seqId: string,
		dots: number,
	) {
		ConversationDotsService.addUnreadDots(conversationId, topicId, dots)
		OrganizationDotsService.addOrganizationDot(organizationId, seqId, dots)
	},
	// 减少话题未读数量
	reduceTopicUnreadDots(
		organizationId: string,
		conversationId: string,
		topicId: string,
		dots: number,
	) {
		ConversationDotsService.reduceUnreadDots(conversationId, topicId, dots)
		OrganizationDotsService.reduceOrganizationDot(organizationId, dots)
	},
}

export default DotsService
