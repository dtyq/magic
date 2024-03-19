import { useState, useRef, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { useStyles } from "./styles"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"

// Components
import UserHeader from "./components/UserHeader"
import ChatItem, { ChatItemData } from "./components/ChatItem"
import PinnedMessages from "./components/PinnedMessages"
import ChatContent from "./components/ChatContent"
import MessageTypeSegmented from "./components/MessageTypeSegmented"
import ConversationMenu from "./components/ConversationMenu"
import MagicPullToNavigate from "@/opensource/components/base/MagicPullToNavigate"

// Hooks
import usePinnedMessages from "./hooks/usePinnedMessages"
import useChatLists from "./hooks/useChatLists"
import useSegmentedOptions from "./hooks/useSegmentedOptions"

// Services
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"

// Stores
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import ConversationMenuStore from "./stores/ConversationMenuStore"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { interfaceStore } from "@/opensource/stores/interface"
import { useTheme } from "antd-style"
import { ChatApi } from "@/opensource/apis"
import { useLocation } from "react-router"
import { RouteName } from "@/opensource/routes/constants"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { cn } from "@/opensource/lib/utils"

const enum Action {
	More = "more",
	Pin = "pin",
	Delete = "delete",
}

const ChatMobile = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	const lang = useGlobalLanguage(false)
	const navigate = useNavigate()
	const { magicColorScales, magicColorUsages } = useTheme()
	const location = useLocation()

	// State
	const [activeListKey, setActiveListKey] = useState<"chat" | "ai">("chat")
	const [isListAtTop, setIsListAtTop] = useState(true)

	// Add timeout ref for tab bar recovery
	const tabBarRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (tabBarRecoveryTimeoutRef.current) {
				clearTimeout(tabBarRecoveryTimeoutRef.current)
			}
		}
	}, [])

	// 初始化 Chat 数据（后台异步，不阻塞 UI）
	// const { isInitializing: isChatDataInitializing } = useChatDataInit()

	// Custom hooks
	const { chatList, topChatList, aiList } = useChatLists(lang)
	const {
		showPinnedMessages,
		toggleShowPinnedMessages,
		pinnedMessageListRef,
		pinnedMessageListHeight,
	} = usePinnedMessages(topChatList.length)
	const segmentedOptions = useSegmentedOptions()

	const handleChatItemClick = (chatId: string) => {
		ConversationService.switchConversation(ConversationStore.getConversation(chatId))
		navigate({ name: RouteName.ChatConversation })
	}

	const handleActionClick = (action: string, chatId: string) => {
		console.log(`${action} clicked for chat ${chatId}`)
		// Add your action logic here
		switch (action) {
			case Action.More:
				ConversationMenuStore.openMenu(chatId)
				break
			case Action.Pin:
				ConversationService.setTopStatus(
					chatId,
					ConversationStore.getConversation(chatId)?.is_top ? 0 : 1,
				)
				break
			case Action.Delete:
				ConversationService.deleteConversation(chatId)
				ChatApi.hideConversation(chatId)
				break
		}
	}

	const handleNavigateToAIMarket = async () => {
		// Navigate to AI assistant market
		try {
			// Add a small delay for better UX
			await new Promise((resolve) => setTimeout(resolve, 1000))
			// Navigate to AI market or explore page
			navigate({ name: RouteName.Explore, viewTransition: false })
			console.log("Successfully navigated to AI assistant market")
		} catch (error) {
			console.error("Failed to navigate to AI market:", error)
			throw error // Re-throw to let the pull component handle it
		}
	}

	useEffect(() => {
		let destroy = null
		if (location.pathname === getRoutePath({ name: RouteName.Chat })) {
			destroy = interfaceStore.setEnableGlobalSafeArea({
				top: false,
				bottom: false,
			})
		}

		return () => {
			if (destroy) {
				destroy()
			}
		}
	}, [location.pathname])

	const renderChatItem = (item: ChatItemData, index: number) => {
		return (
			<ChatItem
				key={item.id}
				data={item}
				className={cn(index === chatList.length - 1 && "pb-safe-bottom-with-tabbar")}
				onClick={() => handleChatItemClick(item.id)}
				onMoreClick={() => handleActionClick(Action.More, item.id)}
				onPinClick={() => handleActionClick(Action.Pin, item.id)}
				onDeleteClick={() => handleActionClick(Action.Delete, item.id)}
			/>
		)
	}

	return (
		<>
			<MagicPullToNavigate
				onNavigateBefore={() => {
					interfaceStore.setMobileTabBarVisible(false)
				}}
				onNavigateAfter={() => {
					setTimeout(() => {
						interfaceStore.setMobileTabBarVisible(true)
					})
				}}
				onNavigate={handleNavigateToAIMarket}
				texts={{
					pullDown: t("pullToNavigate.pullDown"),
					releaseToNavigate: t("pullToNavigate.releaseToNavigate"),
					navigating: t("pullToNavigate.navigating"),
				}}
				threshold={120}
				resistance={0.5}
				respectScrollableChildren={true}
				disabled={!isListAtTop}
			>
				<div className={cn(styles.container)}>
					{/* User Header */}
					<UserHeader
						wrapperClassName="!border-b-0"
						center={
							// Message Types
							<MessageTypeSegmented
								options={segmentedOptions}
								value={activeListKey}
								onChange={setActiveListKey}
							/>
						}
					/>

					<div className={cn(styles.chatContentContainer)}>
						{/* 数据加载中骨架屏 */}
						{/* {isChatDataInitializing && <ChatListSkeleton />} */}

						{/* Pinned Messages */}
						{activeListKey === "chat" && (
							<PinnedMessages
								topChatList={topChatList}
								showPinnedMessages={showPinnedMessages}
								pinnedMessageListHeight={pinnedMessageListHeight}
								pinnedMessageListRef={pinnedMessageListRef}
								onToggle={toggleShowPinnedMessages}
								renderChatItem={renderChatItem}
							/>
						)}

						{/* Chat Content */}
						<ChatContent
							style={{
								backgroundColor:
									topChatList.length === 0
										? magicColorUsages.bg[0]
										: magicColorScales.grey[0],
							}}
							activeListKey={activeListKey}
							chatList={chatList}
							aiList={aiList}
							renderChatItem={renderChatItem}
							onScrollStateChange={setIsListAtTop}
						/>
					</div>
				</div>
				<ConversationMenu />
			</MagicPullToNavigate>
		</>
	)
})

export default ChatMobile
