import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import { throttle, debounce } from "lodash-es"
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import LoadingMessage from "../LoadingMessage"
import Empty from "./components/Empty"
import BackToLatestButton from "./components/BackToLatestButton"
import MessageListFallback from "./components/MessageListFallback"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/lib/utils"
import { MessageStatus, TaskStatus, Topic } from "../../pages/Workspace/types"
import { messageFilter } from "../../utils/handleMessage"
import { useTranslation } from "react-i18next"
import { IconArrowBackUp, IconChevronsDown, IconChevronsUp } from "@tabler/icons-react"
import { SuperMagicMessageItem } from "./type"
import { Node } from "./components/Nodes"
import { observer } from "mobx-react-lite"
import { toJS, reaction } from "mobx"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { superMagicStore } from "../../stores"
import { SuperMagicApi } from "@/apis"
import { messagesConverter, getMessageNodeKey, createCheckIsLastMessage } from "./helpers"
import { buildMessageKeysAndTurnGroups } from "./message-turn-groups"
import { MessageTurnGroupList, wrapUserMessageRow } from "./MessageTurnGroupList"
import magicToast from "@/components/base/MagicToaster/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"

export { MessageListProvider } from "./context"

interface MessageListProps {
	data: Array<SuperMagicMessageItem>
	isShare?: boolean
	setSelectedDetail?: (detail: any) => void
	className?: string
	isEmptyStatus?: boolean
	selectedTopic: Topic | null
	handlePullMoreMessage?: (selectedTopic: Topic | null, callback?: () => void) => void
	showLoading?: boolean
	currentTopicStatus?: TaskStatus
	handleSendMsg?: (content: string, options?: any) => void
	children?: ReactNode | ((item: any, index: number) => ReactNode)
	onFileClick?: (fileItem: any) => void
	/** Extra classes; set [--sticky-message-mask-bg] / [--sticky-message-mask-fade-from] to tune mask */
	stickyMessageClassName?: string
	/** True while the initial message fetch is in-flight; suppresses the empty fallback */
	isMessagesLoading?: boolean
	fallbackRender?: ReactNode
}

// Shared base classes for the revoked-messages action buttons
const revokedActionButton = cn(
	"inline-flex h-6 items-center gap-1 px-2.5 py-1",
	"cursor-pointer rounded-lg text-xs leading-4",
	"border border-border bg-background text-foreground",
	"hover:bg-fill hover:text-foreground",
	"active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)

// Top reserved distance: minimum gap kept when restoring scroll position
// Prevents scroll restoration from landing too close to the top
const MIN_TOP_DISTANCE = 400

// 底部保留距离：当恢复滚动位置时，如果计算位置过于接近底部，保留的最小距离
// 使用场景：防止用户滚动位置恢复到过于靠近底部，确保有足够空间容错触发自动滚动到底部
const MIN_BOTTOM_DISTANCE = 50

const MAX_SCROLL_TOP = 99999999

/** 订阅布局变更配置 */
const observerOptions = {
	childList: true,
	subtree: true,
	characterData: true,
	// 添加属性观察，特别是样式相关
	attributes: true,
	attributeFilter: ["style", "class"],
}

const MessageList = observer(
	({
		data,
		setSelectedDetail,
		selectedTopic,
		className,
		isEmptyStatus = false,
		handlePullMoreMessage,
		showLoading,
		currentTopicStatus,
		handleSendMsg,
		onFileClick,
		stickyMessageClassName,
		children,
	}: MessageListProps) => {
		const { t } = useTranslation("super")
		const isMobile = useIsMobile()
		/** ======================== Refs ======================== */
		/** 当前滚动位置 */
		const scrollTop = useRef<number>(0)
		/** 当前滚动视区中的容器高度 */
		const scrollHeight = useRef<number>(0)
		/** 消息加载中 */
		const isMessageLoading = useRef(false)
		/** 是否启用自动滚动到底部模式 */
		const autoScrollBottom = useRef(true)
		/** DOM 引用：消息列表滚动容器的引用，用于控制滚动行为和获取滚动位置 */
		const nodesPanelRef = useRef<HTMLDivElement | null>(null)
		/** MutationObserver 实例引用，用于组件卸载时清理 */
		const observerRef = useRef<MutationObserver | null>(null)
		/** 已渲染消息 key（用于识别真正新增的消息，避免历史消息反复触发进入动画） */
		const renderedMessageKeysRef = useRef<Set<string>>(new Set())
		/** 当前话题是否允许新增消息进入动画（首屏历史消息不做进入动画） */
		const canAnimateNewMessagesRef = useRef(false)
		/** 当前话题 key */
		const currentTopicKeyRef = useRef<string>("")
		/** 当前是否为代码触发滚动，避免与用户滚动竞争 */
		const isProgrammaticScrolling = useRef(false)
		/** 代码滚动状态重置定时器 */
		const programmaticScrollTimerRef = useRef<number | null>(null)

		/** ======================== States ======================== */
		// 回到最新按钮显示状态：控制"回到最新"悬浮按钮的显示/隐藏
		// 使用场景：当用户向上滚动查看历史消息时显示，点击可快速回到最新消息
		const [showBackToLatest, setShowBackToLatest] = useState(false)

		const { messages, messageKeys, messageTurnGroups } = useMemo(() => {
			const messages = messagesConverter(data)
			const { messageKeys, messageTurnGroups } = buildMessageKeysAndTurnGroups(messages)
			return { messages, messageKeys, messageTurnGroups }
		}, [data])

		const currentTopicKey = selectedTopic?.chat_topic_id || ""
		if (currentTopicKeyRef.current !== currentTopicKey) {
			currentTopicKeyRef.current = currentTopicKey
			renderedMessageKeysRef.current = new Set(messageKeys)
			canAnimateNewMessagesRef.current = false
		}

		const entryAnimationMeta = useMemo(() => {
			const insertedKeySet = new Set<string>()
			const insertedOrderMap = new Map<string, number>()
			if (!canAnimateNewMessagesRef.current) {
				return { insertedKeySet, insertedOrderMap }
			}

			let order = 0
			for (const key of messageKeys) {
				if (!renderedMessageKeysRef.current.has(key)) {
					insertedKeySet.add(key)
					insertedOrderMap.set(key, order++)
				}
			}
			return { insertedKeySet, insertedOrderMap }
		}, [messageKeys])

		const isStreamLoading = superMagicStore.topicMeta.get(
			selectedTopic?.chat_topic_id || "",
		)?.isStreamLoading

		useEffect(() => {
			canAnimateNewMessagesRef.current = true
		}, [currentTopicKey])

		useEffect(() => {
			renderedMessageKeysRef.current = new Set(messageKeys)
		}, [messageKeys])

		// 当selectedTopic变化时，重置showBackToLatest
		useUpdateEffect(() => {
			autoScrollBottom.current = true
			setShowBackToLatest(false)
		}, [selectedTopic?.id])

		const clearProgrammaticScrolling = useMemoizedFn(() => {
			if (programmaticScrollTimerRef.current) {
				window.clearTimeout(programmaticScrollTimerRef.current)
				programmaticScrollTimerRef.current = null
			}
			isProgrammaticScrolling.current = false
		})

		const startProgrammaticScrolling = useMemoizedFn((duration = 1000) => {
			if (programmaticScrollTimerRef.current) {
				window.clearTimeout(programmaticScrollTimerRef.current)
			}
			isProgrammaticScrolling.current = true
			programmaticScrollTimerRef.current = window.setTimeout(() => {
				clearProgrammaticScrolling()
			}, duration + 120)
		})

		/** 唯一持续滚动方法（通过 MutationObserver 持续短时间订阅滚动容器中的内容变化持续执行滚动至，目标高度） */
		const scrollToBottom = useMemoizedFn(
			(top: number, options?: { behavior?: ScrollBehavior; time?: number }) => {
				const element = nodesPanelRef.current
				if (element) {
					const duration = options?.time || 1000
					startProgrammaticScrolling(duration)

					const getTargetTop = () =>
						top >= MAX_SCROLL_TOP
							? element.scrollHeight
							: Math.max(top, element.scrollHeight)

					// 清理之前的 observer(在清理完成后，禁止监听 element.scroll 事件再次执行 clearObserver)
					clearObserver()

					element.scrollTo({
						top: getTargetTop(),
						behavior: options?.behavior,
					})

					const clear = debounce(
						() => {
							clearObserver()
							clearProgrammaticScrolling()
						},
						duration,
						{
							leading: false,
							trailing: true,
						},
					)

					// 创建观察者实例
					observerRef.current = new MutationObserver(() => {
						element.scrollTop = getTargetTop()
						requestAnimationFrame(() => {
							element.scrollTop = getTargetTop()
						})
						clear()
					})

					// 开始观察目标元素
					observerRef.current.observe(element, observerOptions)
				}
			},
		)

		const pullMoreMessage = useMemoizedFn(() => {
			console.log("[DEBUG】 pullMoreMessage")
			if (handlePullMoreMessage) {
				handlePullMoreMessage(selectedTopic, () => {
					isMessageLoading.current = true
				})
			}
		})

		useDeepCompareEffect(() => {
			return reaction(
				() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
				() => {
					const element = nodesPanelRef.current
					if (isMessageLoading.current) {
						isMessageLoading.current = false

						if (element) {
							// 清理之前的 observer
							clearObserver()

							const newHeight = element.scrollHeight - scrollHeight.current

							element.scrollTop = scrollTop.current + newHeight
							const clear = debounce(clearObserver, 500)

							// 创建观察者实例
							observerRef.current = new MutationObserver(() => {
								const newHeight = element.scrollHeight - scrollHeight.current
								requestAnimationFrame(() => {
									element.scrollTop = scrollTop.current + newHeight
								})
								clear()
							})

							// 开始观察目标元素
							observerRef.current.observe(element, observerOptions)
						}
					} else {
						if (autoScrollBottom.current) {
							scrollToBottom(MAX_SCROLL_TOP, { behavior: "smooth", time: 1000 })
						}
					}
				},
				{ fireImmediately: true },
			)
		}, [selectedTopic?.chat_topic_id])

		/**
		 * @description 添加滚动监听，处理以下场景：
		 * 1. 当滚动到顶部时触发 handlePullMoreMessage 拉取历史消息
		 * 2. 当滚动到接近底部时开启 自动滚动模式（该模式下通过广播 PubSubEvents.Message_Scroll_Auto_Bottom 滚动到底部）
		 * 3. 当禁用滚动处理时，取消 MutationObserver 订阅同步滚动x、y轴偏移
		 */
		useEffect(() => {
			const pullMessages = debounce((event) => {
				if (event.target.scrollTop < MIN_TOP_DISTANCE) {
					pullMoreMessage()
				}
			}, 300)
			// 重置 autoScrollBottom
			const keepAutoScrollToBottom = debounce(
				(event) => {
					if (isProgrammaticScrolling.current) return
					autoScrollBottom.current =
						event.target.scrollHeight -
							event.target.scrollTop -
							event.target.clientHeight <
						MIN_BOTTOM_DISTANCE
				},
				100,
				{ leading: false, trailing: true },
			)
			const handleScroll = throttle(
				(event) => {
					if (!isProgrammaticScrolling.current) {
						autoScrollBottom.current = false
						clearObserver()
					}
					scrollTop.current = event.target.scrollTop
					scrollHeight.current = event.target.scrollHeight
					setShowBackToLatest(
						event.target.scrollTop + event.target.clientHeight + 100 <
							event.target.scrollHeight,
					)
					pullMessages(event)
					keepAutoScrollToBottom(event)
				},
				16,
				{ leading: false, trailing: true },
			)
			const element = nodesPanelRef.current
			element?.addEventListener("scroll", handleScroll)

			return () => {
				element?.removeEventListener("scroll", handleScroll)
				pullMessages.cancel()
				keepAutoScrollToBottom.cancel()
				handleScroll.cancel()
			}
		}, [])

		const isLastMessageError = useMemo(() => {
			const lastNode = data?.[data?.length - 1]
			const n = superMagicStore.getMessageNode(lastNode?.app_message_id)
			return n?.status === TaskStatus.ERROR
		}, [data])

		const showAiGeneratedTip =
			(data.length > 0 &&
				!showLoading &&
				!isStreamLoading &&
				currentTopicStatus !== TaskStatus.RUNNING) ||
			isLastMessageError

		const isLastMessageUserType = useMemo(() => {
			const filteredShowMessages = data?.filter?.((node: any) => {
				const n = superMagicStore.getMessageNode(node?.app_message_id)
				return !messageFilter(n)
			})
			const lastNode = filteredShowMessages?.[filteredShowMessages?.length - 1]
			return lastNode?.role !== "assistant"
		}, [data])

		const checkIsLastMessage = useMemoizedFn(createCheckIsLastMessage(messages))

		/** 是否展开已撤销消息 */
		const [isRevokedMessagesExpanded, setIsRevokedMessagesExpanded] = useState(false)
		/** 是否强制隐藏已撤销消息 */
		const [forceHideRevokedMessages, setForceHideRevokedMessages] = useState(false)
		const [isCancelRevokedLoading, setIsCancelRevokedLoading] = useState(false)

		/** 展开或收起已撤销消息 */
		const handleRevokedMessagesExpanded = useMemoizedFn(() => {
			setIsRevokedMessagesExpanded((prev) => !prev)
		})

		/** 取消撤销已撤销消息 */
		const handleCancelRevokedMessages = useMemoizedFn(async () => {
			if (!selectedTopic?.id || isCancelRevokedLoading) return
			try {
				setIsCancelRevokedLoading(true)
				await SuperMagicApi.cancelUndoMessage({ topic_id: selectedTopic.id })
				magicToast.success(t("warningCard.cancelUndoMessageSuccess"))
				pubsub.publish(PubSubEvents.Show_Revoked_Messages)
				pubsub.publish(PubSubEvents.Update_Attachments)
				pubsub.publish(PubSubEvents.Refresh_Topic_Messages)
			} catch (error) {
				console.error("handleCancelRevokedMessages error:", error)
			} finally {
				setIsCancelRevokedLoading(false)
			}
		})

		useEffect(() => {
			pubsub.subscribe(
				PubSubEvents.Message_Scroll_To_Bottom,
				(options?: { behavior?: ScrollBehavior; time?: number }) => {
					autoScrollBottom.current = true
					scrollToBottom(nodesPanelRef.current?.scrollHeight || MAX_SCROLL_TOP, {
						behavior: options?.behavior || "smooth",
						time: options?.time,
					})
				},
			)
			pubsub.subscribe(PubSubEvents.Hide_Revoked_Messages, () => {
				setForceHideRevokedMessages(true)
			})
			pubsub.subscribe(PubSubEvents.Show_Revoked_Messages, () => {
				setForceHideRevokedMessages(false)
			})
			return () => {
				pubsub?.unsubscribe(PubSubEvents.Message_Scroll_To_Bottom)
				pubsub?.unsubscribe(PubSubEvents.Hide_Revoked_Messages)
				pubsub?.unsubscribe(PubSubEvents.Show_Revoked_Messages)
			}
		}, [])

		useDeepCompareEffect(() => {
			// 订阅流式是否正在执行（正在流式时，触发判断消息列表是否需滚动到底部）
			return reaction(
				() => {
					const messagesCache =
						superMagicStore.messages.get(selectedTopic?.chat_topic_id || "") || []
					const lastMessageNode = messagesCache?.[messagesCache.length - 1]
					if (
						!lastMessageNode?.event ||
						lastMessageNode?.event?.indexOf("agent_reply") < 0
					) {
						return false
					}
					return superMagicStore.messageMap.get(lastMessageNode?.app_message_id)?.content
				},
				throttle(
					(isStreamNode) => {
						if (isStreamNode && autoScrollBottom.current) {
							scrollToBottom(MAX_SCROLL_TOP, { behavior: "smooth", time: 2000 })
						}
					},
					20,
					{ leading: false, trailing: true },
				),
			)
		}, [selectedTopic?.chat_topic_id, scrollToBottom])

		const clearObserver = useMemoizedFn(() => {
			if (observerRef.current) {
				observerRef.current.disconnect()
				observerRef.current = null
			}
		})

		// 组件卸载时清理 MutationObserver
		useEffect(() => {
			return () => {
				clearObserver()
				clearProgrammaticScrolling()
			}
		}, [])

		const renderNodeContent = (
			node: SuperMagicMessageItem,
			index: number,
			options?: { disableEntryAnimation?: boolean },
		): ReactNode => {
			const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`

			if (!children) {
				const isNewlyInserted =
					!options?.disableEntryAnimation &&
					Boolean(nodeKey) &&
					entryAnimationMeta.insertedKeySet.has(nodeKey)
				const entryAnimationOrder = isNewlyInserted
					? entryAnimationMeta.insertedOrderMap.get(nodeKey) || 0
					: 0

				return (
					<Node
						role={node?.role || "user"}
						node={node}
						isFirst={messages?.[index - 1]?.role === "user"}
						checkIsLastMessage={checkIsLastMessage}
						selectedTopic={selectedTopic}
						onSelectDetail={setSelectedDetail}
						isSelected={node?.topic_id === selectedTopic?.id}
						onFileClick={onFileClick}
						isNewlyInserted={isNewlyInserted}
						entryAnimationOrder={entryAnimationOrder}
						isShare={false}
					/>
				)
			}
			if (typeof children === "function") return children(node, index)
			if (children) return children
			return null
		}

		const renderNodes = (
			node: SuperMagicMessageItem,
			index: number,
			options?: {
				disableEntryAnimation?: boolean
				disableUserSticky?: boolean
			},
		) => {
			const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`

			return (
				<div
					key={nodeKey}
					data-message-id={nodeKey}
					data-message-role={node?.role || "user"}
					className="relative"
				>
					{wrapUserMessageRow(node, renderNodeContent(node, index, options))}
				</div>
			)
		}

		// 使用 useCallback 优化 itemContent 函数，避免每次渲染都重新创建
		return (
			<div
				className={cn(
					"relative flex w-full flex-1 overflow-hidden",
					"h-[calc(100%-50px)]",
					"message-list-container",
					className,
				)}
			>
				<div
					className={cn("flex h-full w-full flex-col overflow-hidden")}
					onClick={() =>
						console.log(/** keep-console */ "消息列表数据", toJS(data), messages)
					}
				>
					<ScrollArea
						className={cn(
							"h-full w-full",
							"[&>[data-slot='scroll-area-viewport']>div]:pr-3",
							"[&>[data-slot='scroll-area-viewport']>div]:pl-2",
							"[&>[data-slot='scroll-area-viewport']>div]:pt-0",
							// Bottom inset so the last message is not flush with the editor
							"[&>[data-slot='scroll-area-viewport']>div]:pb-8",
							"[&>[data-slot='scroll-area-viewport']>div]:!flex",
							"[&>[data-slot='scroll-area-viewport']>div]:!flex-col",
							"[&>[data-slot='scroll-area-viewport']>div]:!gap-2",
							"[&>[data-slot='scroll-area-viewport']>div]:!max-w-3xl",
							"[&>[data-slot='scroll-area-viewport']>div]:!min-w-[unset]",
							"[&>[data-slot='scroll-area-viewport']>div]:!mx-auto",
							isMobile
								? "[&>[data-slot='scroll-area-viewport']>div:first-child]:mt-[10px]"
								: "[&>[data-slot='scroll-area-viewport']>div:first-child]:mt-[50px]",
						)}
						viewportRef={nodesPanelRef}
					>
						{data.length > 0 || !isEmptyStatus ? (
							<>
								<MessageTurnGroupList
									groups={messageTurnGroups}
									isMobile={isMobile}
									stickyMessageClassName={stickyMessageClassName}
									renderNode={({ node, index }) => renderNodeContent(node, index)}
								/>
								{data.filter((node: any) => node?.status === MessageStatus.REVOKED)
									.length > 0 &&
									!forceHideRevokedMessages && (
										<div
											className={cn(
												"relative max-h-[600px] flex-shrink-0 overflow-hidden",
												isRevokedMessagesExpanded &&
													"max-h-none overflow-visible",
											)}
										>
											<div
												className={cn(
													"relative overflow-hidden rounded-lg p-4",
													"[&::after]:absolute [&::after]:inset-0 [&::after]:z-[1] [&::after]:content-['']",
													"[&::after]:pointer-events-none [&::after]:bg-white/50 dark:[&::after]:bg-black/30",
												)}
											>
												{messagesConverter(
													data.filter(
														(node: any) =>
															node?.status === MessageStatus.REVOKED,
													),
													false,
												)?.map((node, index) =>
													renderNodes(node, index, {
														disableEntryAnimation: true,
														disableUserSticky: true,
													}),
												)}
											</div>
											<div
												className={cn(
													"pointer-events-none absolute inset-0 z-[2] flex items-end",
													"bg-[linear-gradient(to_bottom,rgb(var(--sidebar-rgb))_0%,transparent_50%,rgb(var(--sidebar-rgb))_100%)]",
													isRevokedMessagesExpanded && "static bg-none",
												)}
											>
												<div
													className={cn(
														"pointer-events-auto flex w-full gap-1 pb-2.5 pt-2.5",
														"bg-sidebar",
													)}
												>
													<IconArrowBackUp size={22} />
													<div className="flex flex-col gap-2.5">
														<div className="text-sm leading-5 text-foreground">
															{t("warningCard.undoMessageContentTip")}
														</div>
														<div className="flex gap-2.5">
															<Button
																className={revokedActionButton}
																onClick={
																	handleRevokedMessagesExpanded
																}
															>
																<div>
																	{isRevokedMessagesExpanded
																		? t(
																				"warningCard.collapseContent",
																			)
																		: t(
																				"warningCard.expandContent",
																			)}
																</div>
																{isRevokedMessagesExpanded ? (
																	<IconChevronsUp size={16} />
																) : (
																	<IconChevronsDown size={16} />
																)}
															</Button>
															<Button
																className={revokedActionButton}
																onClick={
																	handleCancelRevokedMessages
																}
															>
																{isCancelRevokedLoading ? (
																	<Spinner
																		className="animate-spin"
																		size={16}
																	/>
																) : null}
																{t("warningCard.restoreContent")}
															</Button>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}
							</>
						) : (
							<Empty />
						)}
						{(data?.length === 1 || (showLoading && !isStreamLoading)) && (
							<LoadingMessage
								messages={data}
								showLoading={showLoading}
								selectedTopic={selectedTopic}
								style={{ marginTop: isLastMessageUserType ? "0" : "10px" }}
								handleSendMsg={handleSendMsg}
							/>
						)}
						{showAiGeneratedTip && (
							<div
								className={cn(
									"mx-auto mb-5 mt-2.5 text-center text-xs leading-4",
									"text-muted-foreground",
								)}
							>
								{t("ui.aiGeneratedTip")}
							</div>
						)}
					</ScrollArea>
				</div>
				<BackToLatestButton
					visible={showBackToLatest}
					onClick={() => {
						autoScrollBottom.current = true
						scrollToBottom(nodesPanelRef.current?.scrollHeight || MAX_SCROLL_TOP, {
							behavior: "smooth",
						})
					}}
				/>
			</div>
		)
	},
)

export default memo((props: MessageListProps) => {
	if (props.data.length === 0) {
		if (props.isMessagesLoading) {
			return (
				<div
					className={cn(
						"flex h-full w-full items-center justify-center",
						props.className,
					)}
				>
					<Spinner size={16} className="animate-spin text-muted-foreground" />
				</div>
			)
		}
		return props.fallbackRender || <MessageListFallback className={props.className} />
	}

	return <MessageList {...props} />
})
