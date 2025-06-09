import { observer, useLocalObservable } from "mobx-react-lite"
import { useRef, useCallback, useEffect, useLayoutEffect } from "react"
import { useMemoizedFn } from "ahooks"
import MessageStore from "@/opensource/stores/chatNew/message"
import MessageService from "@/opensource/services/chat/message/MessageService"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import MessageImagePreview from "@/opensource/services/chat/message/MessageImagePreview"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import MessageDropdownService from "@/opensource/services/chat/message/MessageDropdownService"
import MessageDropdownStore from "@/opensource/stores/chatNew/messageUI/Dropdown"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useTranslation } from "react-i18next"
import { autorun } from "mobx"
import { cx } from "antd-style"
import { DomClassName } from "@/const/dom"
import { debounce, throttle } from "lodash-es"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import AiConversationMessageLoading from "./components/AiConversationMessageLoading"
import BackBottom from "./components/BackBottom"
import { useStyles } from "./styles"
import GroupSeenPanelStore, {
	domClassName as GroupSeenPanelDomClassName,
} from "@/opensource/stores/chatNew/groupSeenPanel"
import { isMessageInView } from "./utils"
import MessageRender from "./components/MessageRender"

let canScroll = true
let isScrolling = false
let lastScrollTop = 0
let lastMessageId = ""

const ChatMessageList = observer(() => {
	const { t } = useTranslation()
	const { fontSize } = useFontSize()
	const { styles } = useStyles({ fontSize })
	const bottomRef = useRef<HTMLDivElement | null>(null)
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	const chatListRef = useRef<HTMLDivElement | null>(null)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)
	const initialRenderRef = useRef(true)
	const isContentChanging = useRef(false)
	const checkMessagesFillViewportTimerRef = useRef<NodeJS.Timeout | null>(null)
	const state = useLocalObservable(() => ({
		isLoadingMore: false,
		isAtBottom: true,
		openDropdown: false,
		isConversationSwitching: false,
		marginSize: 4,
		size: { width: 92, height: 240 },
		dropdownPosition: { x: 0, y: 0 },
		setIsLoadingMore: (value: boolean) => {
			state.isLoadingMore = value
		},
		setIsAtBottom: (value: boolean) => {
			state.isAtBottom = value
		},
		setOpenDropdown: (value: boolean) => {
			state.openDropdown = value
		},
		setIsConversationSwitching: (value: boolean) => {
			state.isConversationSwitching = value
		},
		setDropdownPosition: (value: { x: number; y: number }) => {
			state.dropdownPosition = value
			state.adjustPosition()
		},
		adjustPosition: () => {
			// 调整位置, 防止超出屏幕
			if (typeof window !== "undefined") {
				const windowWidth = window.innerWidth - state.marginSize * 2
				const windowHeight = window.innerHeight - state.marginSize * 2

				// 确保卡片右边界不超出屏幕
				if (state.dropdownPosition.x + state.size.width + state.marginSize > windowWidth) {
					state.dropdownPosition.x = windowWidth - state.size.width - state.marginSize
				}

				// 确保卡片不超出左边界
				if (state.dropdownPosition.x < 0) {
					state.dropdownPosition.x = state.marginSize
				}

				// 确保卡片底部不超出屏幕
				if (state.dropdownPosition.y + state.size.height > windowHeight) {
					state.dropdownPosition.y = windowHeight - state.size.height - state.marginSize
				}

				// 确保卡片不超出顶部边界
				if (state.dropdownPosition.y < 0) {
					state.dropdownPosition.y = state.marginSize
				}
			}
		},
		reset() {
			state.isLoadingMore = false
			state.isAtBottom = true
			state.openDropdown = false
			state.isConversationSwitching = false
			state.dropdownPosition = { x: 0, y: 0 }
		},
	}))

	// const renderMessage = useMemoizedFn((message: any) => {
	// 	switch (message.type) {
	// 		case ControlEventMessageType.GroupAddMember:
	// 			return (
	// 				<InviteMemberTip
	// 					key={message.message_id}
	// 					content={message.message as GroupAddMemberMessage}
	// 				/>
	// 			)
	// 		case ControlEventMessageType.GroupCreate:
	// 			return (
	// 				<GroupCreateTip
	// 					key={message.message_id}
	// 					content={message.message as GroupCreateMessage}
	// 				/>
	// 			)
	// 		case ControlEventMessageType.GroupUsersRemove:
	// 			return (
	// 				<GroupUsersRemoveTip
	// 					key={message.message_id}
	// 					content={message.message as GroupUsersRemoveMessage}
	// 				/>
	// 			)
	// 		case ControlEventMessageType.GroupUpdate:
	// 			return (
	// 				<GroupUpdateTip
	// 					key={message.message_id}
	// 					content={message.message as GroupUpdateMessage}
	// 				/>
	// 			)
	// 		case ControlEventMessageType.GroupDisband:
	// 			return (
	// 				<GroupDisbandTip
	// 					key={message.message_id}
	// 					content={message.message as GroupDisbandMessage}
	// 				/>
	// 			)
	// 		default:
	// 			return message.revoked ? (
	// 				<RevokeTip key={message.message_id} senderUid={message.sender_id} />
	// 			) : (
	// 				<MessageItem
	// 					key={message.message_id}
	// 					message_id={message.message_id}
	// 					sender_id={message.sender_id}
	// 					name={message.name}
	// 					avatar={message.avatar}
	// 					is_self={message.is_self ?? false}
	// 					message={message.message}
	// 					unread_count={message.unread_count}
	// 					refer_message_id={message.refer_message_id}
	// 				/>
	// 			)
	// 	}
	// })

	const scrollToMessage = useMemoizedFn(
		(
			messageId: string,
			block: "center" | "start" | "end",
			behavior: "smooth" | "auto" = "smooth",
		) => {
			if (wrapperRef.current) {
				const messageElement = wrapperRef.current.querySelector(
					`[data-message-id="${messageId}"]`,
				)
				if (messageElement) {
					canScroll = false
					isScrolling = true
					messageElement.scrollIntoView({ behavior, block })
					setTimeout(() => {
						isScrolling = false
						canScroll = true
					}, 0)
				}
			}
		},
	)

	const scrollToBottom = useMemoizedFn((force?: boolean) => {
		// 不允许滚动
		if (!canScroll && !force) {
			return
		}

		if (bottomRef?.current) {
			isScrolling = true
			bottomRef.current.scrollIntoView({ behavior: "smooth" })
		}

		setTimeout(() => {
			isScrolling = false
			state.setIsAtBottom(true)
			canScroll = true
		}, 0)
	})

	// 加载更多历史消息
	const loadMoreHistoryMessages = useMemoizedFn(async () => {
		if (state.isLoadingMore || !MessageStore.hasMoreHistoryMessage) return

		try {
			state.setIsLoadingMore(true)
			canScroll = false

			// 请求历史消息
			await MessageService.getHistoryMessages(
				conversationStore.currentConversation?.id ?? "",
				conversationStore.currentConversation?.current_topic_id ?? "",
			)
		} catch (error) {
			// 发生错误时恢复样式
			if (chatListRef.current) {
				chatListRef.current.style.transform = ""
				chatListRef.current.style.position = ""
			}
		} finally {
			state.setIsLoadingMore(false)
		}
	})

	// 检查滚动位置并处理
	const checkScrollPosition = useMemoizedFn(() => {
		if (!wrapperRef.current || !initialRenderRef.current || isScrolling) return
		// 初始化状态不处理
		if (lastScrollTop === 0) {
			lastScrollTop = wrapperRef.current.scrollTop
			return
		}

		const { scrollTop, clientHeight, scrollHeight } = wrapperRef.current
		const distance = Math.abs(scrollTop + clientHeight - scrollHeight)

		state.setIsAtBottom(distance < 100)
		canScroll = distance < 100

		const isScrollUp = lastScrollTop - scrollTop > 0
		lastScrollTop = scrollTop
		if (isScrollUp && !state.isLoadingMore) {
			// 加载更多，判断第四条消息是否进入视图
			const messageId = MessageStore.messages[3]?.message_id

			if (isMessageInView(messageId, wrapperRef.current) || scrollTop < 150) {
				loadMoreHistoryMessages()
			}
		}
	})

	// 检查是否需要加载更多消息来填充视图
	const checkMessagesFillViewport = useMemoizedFn(async () => {
		if (
			!wrapperRef.current ||
			!chatListRef.current ||
			state.isLoadingMore ||
			!MessageStore.hasMoreHistoryMessage
		) {
			return
		}

		const wrapperHeight = wrapperRef.current.clientHeight
		const listHeight = chatListRef.current.clientHeight

		// 如果内容高度小于容器高度，并且我们有足够的消息可以加载
		// 加载更多历史消息直到填满视图或没有更多消息
		if (listHeight < wrapperHeight && MessageStore.messages.length > 0) {
			console.log("容器未填满，尝试加载更多历史消息", listHeight, wrapperHeight)

			try {
				await loadMoreHistoryMessages()

				// 递归检查，直到填满或没有更多消息
				if (checkMessagesFillViewportTimerRef.current) {
					clearTimeout(checkMessagesFillViewportTimerRef.current)
				}

				checkMessagesFillViewportTimerRef.current = setTimeout(() => {
					checkMessagesFillViewport()
				}, 300)
			} catch (error) {
				console.error("加载更多消息失败", error)
			}
		}
	})

	// 处理容器大小变化
	const handleResize = useMemoizedFn(() => {
		if (!chatListRef.current || isScrolling) return

		const { messages } = MessageStore
		if (!messages.length) return

		// 如果最后一条消息为空，证明是初始化状态，滚动到底部
		if (!lastMessageId) {
			lastMessageId = messages[messages.length - 1]?.message_id
			scrollToBottom(true)

			return
		}

		// 有新消息，并且不是当前消息，尝试滚动到底部
		const lastMessage = messages[messages.length - 1]
		// 如果是我发送的新消息，滚动到底部，或者是在底部
		if (
			(lastMessage.is_self && lastMessage?.message_id !== lastMessageId) ||
			state.isAtBottom
		) {
			console.log("handleResize send bottom")
			lastMessageId = lastMessage?.message_id
			scrollToBottom(true)
			return
		}

		// 更新 lastMessageId
		lastMessageId = lastMessage?.message_id

		// 其他情况，滚回底部
		if (canScroll && wrapperRef.current) {
			return wrapperRef.current.scrollTo({
				top: chatListRef.current.clientHeight,
				behavior: "smooth",
			})
		}

		// 数据变更，并且滚动条停留在顶部，加载多一页
		if (
			wrapperRef.current &&
			wrapperRef.current.scrollTop === 0 &&
			!MessageStore.hasMoreHistoryMessage
		) {
			loadMoreHistoryMessages()
			requestAnimationFrame(() => {
				if (wrapperRef.current) {
					wrapperRef.current.scrollTop = 200
				}
			})
		}
	})

	const handleContainerScroll = throttle(() => {
		// 列表大小变化时，不处理
		if (isContentChanging.current) return

		checkScrollPosition()
	}, 50)

	// 切换会话或者话题
	useEffect(() => {
		if (wrapperRef.current) {
			wrapperRef.current.removeEventListener("scroll", handleContainerScroll)
		}

		// 立即设置切换状态，防止消息串台
		state.setIsConversationSwitching(true)
		state.reset()
		lastMessageId = ""
		canScroll = true
		lastScrollTop = 0
		initialRenderRef.current = false

		// 立即滚动到底部，不延迟
		setTimeout(() => {
			scrollToBottom(true)
		}, 0)

		// 减少延迟时间，快速恢复正常状态
		setTimeout(() => {
			if (wrapperRef.current) {
				wrapperRef.current.addEventListener("scroll", handleContainerScroll)
			}
			initialRenderRef.current = true
			state.setIsConversationSwitching(false)

			// 会话切换后，检查消息是否填满视图
			if (checkMessagesFillViewportTimerRef.current) {
				clearTimeout(checkMessagesFillViewportTimerRef.current)
			}
			checkMessagesFillViewport()
		}, 100) // 减少延迟从1000ms到100ms
	}, [MessageStore.conversationId, MessageStore.topicId])

	useLayoutEffect(() => {
		// 创建 ResizeObserver 实例，监听消息列表高度变化
		resizeObserverRef.current = new ResizeObserver(
			debounce((entries) => {
				const chatList = entries[0]
				if (!chatList) return
				// 列表大小变化
				isContentChanging.current = true
				handleResize()
				// 重置
				setTimeout(() => {
					isContentChanging.current = false
				}, 0)
			}, 100),
		)

		// 开始观察
		if (chatListRef.current) {
			resizeObserverRef.current.observe(chatListRef.current)
		}

		// 消息聚焦
		const focusDisposer = autorun(() => {
			if (MessageStore.focusMessageId) {
				scrollToMessage(MessageStore.focusMessageId, "center")
			}
		})

		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement
			if (target.classList.contains("message-item-menu")) {
				return
			}
			state.setOpenDropdown(false)
		}

		document.addEventListener("click", handleClick)

		return () => {
			focusDisposer()
			document.removeEventListener("click", handleClick)
			state.reset()
			resizeObserverRef.current?.disconnect()
			resizeObserverRef.current = null
			if (wrapperRef.current) {
				wrapperRef.current.removeEventListener("scroll", handleContainerScroll)
			}
			if (checkMessagesFillViewportTimerRef.current) {
				clearTimeout(checkMessagesFillViewportTimerRef.current)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleContainerClick = useCallback((e: React.MouseEvent) => {
		const target = e.target as HTMLElement
		// 从点击元素开始向上查找，直到找到带有 data-message-id 的元素
		const messageElement = target.closest("[data-message-id]")
		const messageId = messageElement?.getAttribute("data-message-id")

		// 如果是图片点击，并且不是表情
		if (target.tagName === "IMG" && target.classList.contains("magic-image")) {
			const fileInfo = target.getAttribute("data-file-info")
			if (fileInfo) {
				try {
					const fileInfoObj = JSON.parse(atob(fileInfo))
					// 如果是同一张图片，先重置状态
					MessageImagePreview.setPreviewInfo({
						...fileInfoObj,
						messageId,
						conversationId: conversationStore.currentConversation?.id,
					})
				} catch (error) {
					console.error("解析文件信息失败", error)
				}
			}
		}

		if (messageElement && messageElement.classList.contains(GroupSeenPanelDomClassName)) {
			if (messageId) {
				GroupSeenPanelStore.openPanel(messageId, { x: e.clientX, y: e.clientY })
			}
		} else if (GroupSeenPanelStore.open) {
			GroupSeenPanelStore.closePanel()
		}
	}, [])

	const handleContainerContextMenu = (e: React.MouseEvent) => {
		e.preventDefault()
		const target = e.target as HTMLElement
		if (target.closest(`.${DomClassName.MESSAGE_ITEM}`)) {
			// 从点击元素开始向上查找，直到找到带有 data-message-id 的元素
			const messageElement = target.closest("[data-message-id]")
			const messageId = messageElement?.getAttribute("data-message-id")
			MessageDropdownService.setMenu(messageId ?? "", e.target)
			state.setDropdownPosition({ x: e.clientX, y: e.clientY })
			state.setOpenDropdown(true)
		}
	}

	return (
		<div
			className={cx(styles.container)}
			onClick={handleContainerClick}
			onContextMenu={handleContainerContextMenu}
		>
			{state.isLoadingMore && (
				<div className={styles.loadingMore}>
					{t("message.chat.loadingMoreMessages", { ns: "interface" })}
				</div>
			)}
			<div
				ref={wrapperRef}
				className={cx(styles.wrapper)}
				// onScroll={handleContainerScroll()}
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
								{t("message.chat.switchingConversation", { ns: "interface" })}
							</div>
						</div>
					) : (
						MessageStore.messages
							.filter((message) => {
								// 过滤消息，确保只显示当前会话的消息
								return message.conversation_id === MessageStore.conversationId
							})
							.map((message) => {
								// 使用复合key防止不同会话间的组件复用
								const messageKey = `${MessageStore.conversationId}-${MessageStore.topicId}-${message.message_id}`
								return (
									<div
										id={message.message_id}
										key={messageKey}
										style={{ willChange: "transform" }}
										data-conversation-id={message.conversation_id}
										data-message-id={message.message_id}
									>
										<MessageRender message={message} />
									</div>
								)
							})
					)}
					<AiConversationMessageLoading
						key={`ai-loading-${MessageStore.conversationId}-${MessageStore.topicId}`}
					/>
					<div ref={bottomRef} />
				</div>
				<MagicDropdown
					className="message-item-menu"
					autoAdjustOverflow
					open={state.openDropdown}
					overlayClassName={styles.dropdownMenu}
					trigger={[]}
					overlayStyle={{
						position: "fixed",
						left: state.dropdownPosition.x,
						top: state.dropdownPosition.y,
					}}
					menu={{
						items: MessageDropdownStore.menu.map((item) => {
							if (item.key.startsWith("divider")) {
								return {
									key: item.key,
									type: "divider",
								}
							}
							return {
								icon: item.icon ? (
									<MagicIcon
										color={item.icon.color}
										component={item.icon.component as any}
										size={item.icon.size}
									/>
								) : undefined,
								key: item.key,
								label: t(item.label ?? "", { ns: "interface" }),
								danger: item.danger,
								onClick: () => {
									MessageDropdownService.clickMenuItem(item.key as any)
								},
							}
						}),
					}}
				>
					<div style={{ display: "none" }} />
				</MagicDropdown>
			</div>
			<BackBottom visible={!state.isAtBottom} onScrollToBottom={() => scrollToBottom(true)} />
		</div>
	)
})

export default ChatMessageList
