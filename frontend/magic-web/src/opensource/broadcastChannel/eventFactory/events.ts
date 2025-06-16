/**
 * 消息相关事件
 */
export enum EVENTS {
	// 消息相关
	APPLY_MESSAGE = "applyMessage",
	APPLY_MESSAGES = "applyMessages",
	ADD_SEND_MESSAGE = "addSendMessage",
	RESEND_MESSAGE = "resendMessage",
	UPDATE_MESSAGE_STATUS = "updateMessageStatus",
	UPDATE_MESSAGE = "updateMessage",
	DELETE_MESSAGE = "deleteMessage",
	UPDATE_MESSAGE_ID = "updateMessageId",
	UPDATE_SEND_MESSAGE = "updateSendMessage",

	// 会话、话题相关
	SET_TOP_CONVERSATION = "setTopConversation",
	CANCEL_TOP_CONVERSATION = "cancelTopConversation",
	CANCEL_SET_NO_DISTURB_STATUS = "cancelNotDisturbStatus",
	_NO_DISTURB_STATUS = "setNotDisturbStatus",
	REMOVE_CONVERSATION = "removeConversation",
	UPDATE_CONVERSATION_DOT = "updateConversationDot",
	CLEAR_CONVERSATION_DOT = "clearConversationDot",
	UPDATE_TOPIC_DOT = "updateTopicDot",
	CLEAR_TOPIC_DOT = "clearTopicDot",
	REMOVE_TOPIC = "removeTopic",
	CREATE_TOPIC = "createTopic",
	UPDATE_TOPIC = "updateTopic",

	// 用户相关
	LOGOUT = "logout",
	DO_LOGOUT = "doLogout",
	LOGIN = "login",
	DO_LOGIN = "login", // 注意这里与LOGIN相同
	// SWITCH_USER = "switchUser",
	// DO_SWITCH_USER = "doSwitchUser",
	SWITCH_ORGANIZATION = "switchOrganization",
	DO_SWITCH_ORGANIZATION = "doSwitchOrganization",
	UPDATE_ORGANIZATION_DOT = "updateOrganizationDot",
	DO_UPDATE_ORGANIZATION_DOT = "doUpdateOrganizationDot",
	UPDATE_ORGANIZATION = "updateOrganization",
	DO_UPDATE_ORGANIZATION = "doUpdateOrganization",
	SWITCH_ACCOUNT = "switchAccount",
	DO_SWITCH_ACCOUNT = "doSwitchAccount",
	DELETE_ACCOUNT = "deleteAccount",
	DO_DELETE_ACCOUNT = "doDeleteAccount",
	ADD_ACCOUNT = "addAccount",
	DO_ADD_ACCOUNT = "doAddAccount",
}
