import React from "react"
import type {
	ConversationMessage,
	ConversationMessageAttachment,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import MessageComponents from "./config/MessageComponents"

interface MessageProps {
	content?: any
	reasoningContent?: any
	isSelf?: boolean
	messageId: string
	files?: any[]
	isStreaming?: boolean
	isReasoningStreaming?: boolean
}

class MessageFactory {
	// 组件缓存，优先读取缓存
	private static componentCache = new Map<
		string,
		React.LazyExoticComponent<React.ComponentType<MessageProps>>
	>()

	private static getFallbackComponent(): React.LazyExoticComponent<
		React.ComponentType<MessageProps>
	> {
		return React.lazy(() => import("./components/Fallback"))
	}

	// 获取文件组件
	static getFileComponent(): React.LazyExoticComponent<React.ComponentType<MessageProps>> {
		return this.getComponent(ConversationMessageType.Files)
	}

	// 解析内容
	static parseContent(
		type: string,
		message: ConversationMessage | ConversationMessageSend["message"],
	): any {
		const messageComponent = MessageComponents[type]
		if (!messageComponent?.contentParser) {
			return message
		}
		try {
			return messageComponent.contentParser(message)
		} catch (error) {
			return message
		}
	}

	// 解析推理内容
	static parseReasoningContent(type: ConversationMessageType, message: ConversationMessage) {
		const messageComponent = MessageComponents[type]
		if (!messageComponent?.reasoningContentParser) {
			return undefined
		}
		try {
			return messageComponent.reasoningContentParser(message)
		} catch (error) {
			return undefined
		}
	}

	// 解析是否推理流式
	static parseIsReasoningStreaming(type: ConversationMessageType, message: ConversationMessage) {
		const messageComponent = MessageComponents[type]
		if (!messageComponent?.isReasoningStreamingParser) {
			return false
		}
		try {
			return messageComponent.isReasoningStreamingParser(message)
		} catch (error) {
			return false
		}
	}

	// 解析是否流式
	static parseIsStreaming(type: ConversationMessageType, message: ConversationMessage) {
		const messageComponent = MessageComponents[type]
		if (!messageComponent?.isStreamingParser) {
			return false
		}
		try {
			return messageComponent.isStreamingParser(message)
		} catch (error) {
			return false
		}
	}

	// 解析文件信息
	static parseFiles(
		type: string,
		message: ConversationMessage | ConversationMessageSend["message"],
		referFileId?: string,
	): ConversationMessageAttachment[] | undefined {
		const messageComponent = MessageComponents[type]

		if (!messageComponent?.showFileComponent) {
			return undefined
		}

		try {
			if (messageComponent.fileParser) {
				return messageComponent.fileParser(message, referFileId)
			}

			return undefined
		} catch (error) {
			return undefined
		}
	}

	// 获取组件
	static getComponent(
		type: string,
	): React.LazyExoticComponent<React.ComponentType<MessageProps>> {
		// 加载并返回组件
		const messageComponent = MessageComponents[type]

		// 检查缓存
		if (messageComponent && this.componentCache.has(messageComponent.componentType)) {
			return this.componentCache.get(messageComponent.componentType)!
		}

		// 没有加载器
		if (!messageComponent?.loader) {
			return this.getFallbackComponent()
		}

		// 创建 lazy 组件
		const LazyComponent = React.lazy(() =>
			messageComponent.loader().then((module) => ({
				default: module.default as React.ComponentType<MessageProps>,
			})),
		)
		this.componentCache.set(messageComponent.componentType, LazyComponent)
		return LazyComponent
	}

	// 清除缓存
	static cleanCache(usedTypes: string[]) {
		Array.from(this.componentCache.keys()).forEach((type) => {
			if (!usedTypes.includes(type)) {
				this.componentCache.delete(type)
			}
		})
	}
}

export default MessageFactory
