import React from "react"
import ComponentConfig from "../config/ComponentConfig"
import type { ConversationMessage } from "@/types/chat/conversation_message"

interface MessageProps {
	content?: ConversationMessage
	reasoningContent?: any
	isSelf?: boolean
	messageId: string
	files?: any[]
	isStreaming?: boolean
	isReasoningStreaming?: boolean
}

const Fallback = React.lazy(
	() => import("@/pages/chatNew/components/ChatMessageList/components/Fallback"),
)

class MessageRenderFactory {
	// 组件缓存，优先读取缓存
	private static componentCache = new Map<
		string,
		React.LazyExoticComponent<React.ComponentType<MessageProps>>
	>()

	private static getFallbackComponent(): React.LazyExoticComponent<
		React.ComponentType<MessageProps>
	> {
		return Fallback
	}

	// 生成props
	static generateProps(type: string, message: any) {
		const componentConfig = ComponentConfig[type]
		if (!componentConfig) {
			return {}
		}

		if (!componentConfig.getProps) {
			return { ...message }
		}

		return { ...componentConfig.getProps(message) }
	}

	// 获取组件
	static getComponent(
		type: string,
	): React.LazyExoticComponent<React.ComponentType<MessageProps>> {
		// 加载并返回组件
		const messageComponent = ComponentConfig[type]

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

export default MessageRenderFactory
