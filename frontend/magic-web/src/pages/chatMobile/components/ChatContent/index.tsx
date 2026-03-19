import { ChatItemData } from "../ChatItem"
import { useStyles } from "./styles"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { memo, useMemo, useRef, useEffect, useState } from "react"
import EmptyFallback from "@/pages/chatNew/components/ChatSubSider/components/EmptyFallback"
import { cx } from "antd-style"
import VirtualList from "rc-virtual-list"
import { cn } from "@/lib/utils"

interface ChatContentProps {
	style?: React.CSSProperties
	activeListKey: "chat" | "ai"
	chatList: ChatItemData[]
	aiList: ChatItemData[]
	renderChatItem: (item: ChatItemData, index: number) => JSX.Element
	onScrollStateChange?: (isAtTop: boolean) => void
}

// ChatItem 高度（包括 padding）
const CHAT_ITEM_HEIGHT = 60

const EmptyFallbackComponent = memo(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	return (
		<Flex vertical gap={4} align="center" justify="center" className={styles.emptyFallback}>
			<EmptyFallback />
			<div className={styles.emptyFallbackText}>{t("chat.subSider.emptyFallbackText")}</div>
		</Flex>
	)
})

function ChatContent({
	style,
	activeListKey,
	chatList = [],
	aiList = [],
	renderChatItem,
	onScrollStateChange,
}: ChatContentProps) {
	const { styles } = useStyles()
	const containerRef = useRef<HTMLDivElement>(null)
	const chatListRef = useRef<HTMLDivElement>(null)
	const aiListRef = useRef<HTMLDivElement>(null)
	const [listHeight, setListHeight] = useState(600)

	// 计算列表容器高度
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const updateHeight = () => {
			const height = container.clientHeight
			if (height > 0) {
				setListHeight(height)
			}
		}

		// 初始计算
		updateHeight()

		// 使用 ResizeObserver 监听容器高度变化
		const resizeObserver = new ResizeObserver(() => {
			updateHeight()
		})

		resizeObserver.observe(container)

		// 降级方案：监听窗口大小变化
		window.addEventListener("resize", updateHeight)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener("resize", updateHeight)
		}
	}, [])

	const contentStyle = useMemo(() => {
		if (
			(activeListKey === "chat" && chatList.length === 0) ||
			(activeListKey === "ai" && aiList.length === 0)
		) {
			return {
				...style,
				height: "100%",
			}
		}

		return style
	}, [activeListKey, aiList.length, chatList.length, style])

	// 检测 VirtualList 滚动容器的滚动状态
	useEffect(() => {
		if (!onScrollStateChange) return

		const findScrollContainer = (parent: HTMLElement): HTMLElement | null => {
			// 方法1: 查找 rc-virtual-list 的滚动容器（常见的类名）
			const holder = parent.querySelector(".rc-virtual-list-holder") as HTMLElement | null
			if (holder) return holder

			// 方法2: 查找所有子元素，找到第一个可滚动的元素
			const children = parent.querySelectorAll("*")
			for (const child of children) {
				const element = child as HTMLElement
				const style = window.getComputedStyle(element)
				if (
					(style.overflowY === "auto" || style.overflowY === "scroll") &&
					element.scrollHeight > element.clientHeight
				) {
					return element
				}
			}

			return null
		}

		const checkScrollState = () => {
			// 根据当前活动的列表，查找对应的 VirtualList 滚动容器
			const activeListElement =
				activeListKey === "chat" ? chatListRef.current : aiListRef.current

			if (!activeListElement) {
				// 如果没有列表元素（空状态），认为在顶部
				onScrollStateChange(true)
				return
			}

			// 查找滚动容器
			const scrollContainer = findScrollContainer(activeListElement)

			if (!scrollContainer) {
				// 如果找不到滚动容器（可能是空列表），认为在顶部
				onScrollStateChange(true)
				return
			}

			// 检查是否在顶部（允许小的误差）
			const isAtTop = scrollContainer.scrollTop <= 1
			onScrollStateChange(isAtTop)
		}

		// 初始检查（延迟执行以确保 DOM 已渲染）
		const initialTimeout = setTimeout(() => {
			checkScrollState()
		}, 100)

		// 查找滚动容器并添加滚动监听
		const activeListElement = activeListKey === "chat" ? chatListRef.current : aiListRef.current

		if (activeListElement) {
			// 使用 MutationObserver 监听 DOM 变化，因为 VirtualList 可能在渲染后才创建滚动容器
			const observer = new MutationObserver(() => {
				const scrollContainer = findScrollContainer(activeListElement)
				if (scrollContainer) {
					checkScrollState()
					scrollContainer.addEventListener("scroll", checkScrollState, { passive: true })
					observer.disconnect()
				}
			})

			observer.observe(activeListElement, {
				childList: true,
				subtree: true,
			})

			// 立即尝试查找一次
			const scrollContainer = findScrollContainer(activeListElement)
			if (scrollContainer) {
				scrollContainer.addEventListener("scroll", checkScrollState, { passive: true })
				observer.disconnect()
			}

			return () => {
				clearTimeout(initialTimeout)
				observer.disconnect()
				const scrollContainer = findScrollContainer(activeListElement)
				if (scrollContainer) {
					scrollContainer.removeEventListener("scroll", checkScrollState)
				}
			}
		}

		return () => {
			clearTimeout(initialTimeout)
		}
	}, [activeListKey, onScrollStateChange, chatList.length, aiList.length])

	return (
		<div className={cn(styles.chatContent)} style={contentStyle} ref={containerRef}>
			<div
				ref={chatListRef}
				className={styles.chatList}
				style={{ display: activeListKey === "chat" ? "block" : "none" }}
			>
				{chatList.length === 0 ? (
					<EmptyFallbackComponent />
				) : (
					<VirtualList
						data={chatList}
						height={listHeight}
						itemHeight={CHAT_ITEM_HEIGHT}
						itemKey="id"
					>
						{(item: ChatItemData, index: number) => renderChatItem(item, index)}
					</VirtualList>
				)}
			</div>
			<div
				ref={aiListRef}
				className={cx(styles.chatList, activeListKey === "ai" && styles.aiList)}
				style={{ display: activeListKey === "ai" ? "block" : "none" }}
			>
				{aiList.length === 0 ? (
					<EmptyFallbackComponent />
				) : (
					<VirtualList
						data={aiList}
						height={listHeight}
						itemHeight={CHAT_ITEM_HEIGHT}
						itemKey="id"
					>
						{(item: ChatItemData, index) => renderChatItem(item, index)}
					</VirtualList>
				)}
			</div>
		</div>
	)
}

export default ChatContent
