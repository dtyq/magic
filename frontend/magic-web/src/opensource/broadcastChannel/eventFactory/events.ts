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

	// 全局应用相关
	SWITCH_LANGUAGE = "switchLanguage",

	// 用户相关
	LOGOUT = "logout",
	LOGIN = "login",
	/** 弹窗登录，携带 token 等信息回传给主窗口 */
	POPUP_LOGIN = "popupLogin",
	// SWITCH_USER = "switchUser",
	// DO_SWITCH_USER = "doSwitchUser",
	SWITCH_ORGANIZATION = "switchOrganization",
	UPDATE_ORGANIZATION_DOT = "updateOrganizationDot",
	UPDATE_ORGANIZATION = "updateOrganization",
	SWITCH_ACCOUNT = "switchAccount",
	DELETE_ACCOUNT = "deleteAccount",
	ADD_ACCOUNT = "addAccount",
	UPDATE_ACCOUNT = "updateAccount",
	UPDATE_USER_INFO = "updateUserInfo",
}
