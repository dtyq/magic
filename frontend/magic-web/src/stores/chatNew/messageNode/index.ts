// import {
// 	ConversationMessage,
// 	SendStatus,
// 	ConversationMessageStatus,
// } from "@/types/chat/conversation_message"
// import { makeAutoObservable } from "mobx"

// interface BaseInfo {
// 	/** 本地临时id */
// 	temp_id?: string
// 	/** 用户唯一 ID */
// 	magic_id: string
// 	/** 消息序列 ID */
// 	seq_id?: string
// 	/** 消息 ID */
// 	message_id: string
// }

// interface UserInfo {
// 	nickname: string
// 	avatar: string
// 	magic_id: string
// }

// // 消息节点（包含消息的详细内容）
// export class MessageNode {
// 	// 消息体的基础信息
//   baseInfo: BaseInfo = {
// 		/** 本地临时id */
// 		temp_id: "",
// 		/** 用户唯一 ID */
// 		magic_id: "",
// 		/** 消息序列 ID */
// 		seq_id: "",
// 		/** 消息 ID */
// 		message_id: "",
// 	}

// 	user: UserInfo = {
// 		nickname: "",
// 		avatar: "",
// 		magic_id: "",
// 	}

// 	/** 引用消息 ID */
// 	refer_message_id?: string
// 	/** 发送者消息 ID */
// 	sender_message_id?: string
// 	/** 会话 ID */
// 	conversation_id: string = ""
// 	/** 消息类型 */
// 	type: string = ""
// 	/** 消息内容 */
// 	message: ConversationMessage = {} as ConversationMessage
// 	/** 是否已撤回 */
// 	revoked?: boolean = false
// 	/** 发送时间 */
// 	send_time: string = ""
// 	/** 发送状态 */
// 	send_status: SendStatus = SendStatus.Pending
// 	/** 是否已读 */
// 	seen_status: ConversationMessageStatus = ConversationMessageStatus.Unread
// 	}

// 	constructor() {
// 		makeAutoObservable(this, {}, { autoBind: true })
// 	}
// }

// export default MessageNode
