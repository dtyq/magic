import { observer } from "mobx-react-lite"
import { cx } from "antd-style"
import MessageStore from "@/stores/chatNew/message"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"

// Components
import { default as AiConversationMessageLoadingComponent } from "./components/AiConversationMessageLoading"
import BackBottom from "./components/BackBottom"
import { default as MessageRenderComponent } from "./components/MessageRender"
import MessageMenu from "./components/MessageMenu"

// Styles
import { useStyles } from "./styles"

// Hooks
import { useChatMessageList } from "./hooks/useChatMessageList"

// Utils
import { generateMessageKey } from "./utils"
import { forwardRef, useImperativeHandle } from "react"

// Stores
import ConversationStore from "@/stores/chatNew/conversation"

import "../../utils/registerComponents"

const ChatMessageList = observer(
	forwardRef<
		{
			scrollToBottom: () => void
		},
		{
			MessageRender?: React.LazyExoticComponent<React.ComponentType<any>>
			AiConversationMessageLoading?: React.LazyExoticComponent<React.ComponentType<any>>
		}
	>(
		(
			{
				MessageRender = MessageRenderComponent,
				AiConversationMessageLoading = AiConversationMessageLoadingComponent,
			},
			ref,
		) => {
			const { fontSize } = useFontSize()
			const isMobile = useIsMobile()
			const { t } = useTranslation()
			const { styles } = useStyles({ fontSize })

			// Use main hook to manage all logic
			const { state, scrollManager, eventHandlers, refs } = useChatMessageList()
			const { bottomRef, wrapperRef, chatListRef } = refs

			useImperativeHandle(ref, () => {
				return {
					scrollToBottom: scrollManager.scrollToBottom,
				}
			}, [scrollManager.scrollToBottom])

			return (
				<div
					className={cx(styles.container)}
					onClick={eventHandlers.handleContainerClick}
					onContextMenu={eventHandlers.handleContainerContextMenu}
				>
					{state.isLoadingMore && (
						<div className={styles.loadingMore}>
							{t("message.chat.loadingMoreMessages", { ns: "interface" })}
						</div>
					)}
					<div
						ref={wrapperRef}
						className={cx(styles.wrapper, "chat-message-list-wrapper")}
						style={{ position: "relative", overflow: "auto" }}
					>
						<div
							ref={chatListRef}
							className={cx(styles.chatList)}
							data-testid="chat-list"
							style={{
								willChange: "transform",
							}}
						>
							{/* 会话切换时显示加载状态，防止消息串台 */}
							{state.isConversationSwitching ? (
								<div className={styles.conversationSwitching}>
									<div>
										{t("message.chat.switchingConversation", {
											ns: "interface",
										})}
									</div>
								</div>
							) : (
								MessageStore.messages
									.filter((message) => {
										// 过滤消息，确保只显示当前会话的消息
										return (
											message.conversation_id ===
											MessageStore.conversationId &&
											message.message.topic_id === MessageStore.topicId
										)
									})
									.map((message) => {
										// 使用复合key防止不同会话间的组件复用
										const messageKey = generateMessageKey(
											MessageStore.conversationId,
											MessageStore.topicId,
											message.message_id,
										)
										return (
											<div
												id={message.message_id}
												key={messageKey}
												style={{ willChange: "transform" }}
												data-conversation-id={message.conversation_id}
												data-message-id={message.message_id}
												data-is-ai-message={
													ConversationStore.currentConversation
														?.isAiConversation && !message.is_self
												}
											>
												<MessageRender message={message} />
											</div>
										)
									})
							)}
							<AiConversationMessageLoading />
							<div ref={bottomRef} />
						</div>
						{!isMobile && (
							<MessageMenu
								open={state.openDropdown}
								dropdownPosition={state.dropdownPosition}
								setDropdownSize={state.setDropdownSize}
								onClose={() => state.setOpenDropdown(false)}
							/>
						)}
					</div>
					<BackBottom
						visible={!state.isAtBottom}
						onScrollToBottom={() => scrollManager.scrollToBottom(true)}
					/>
				</div>
			)
		},
	),
)

export default ChatMessageList
