import { useMemoizedFn } from "ahooks"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
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
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { superMagicStore } from "../../stores"
import { SuperMagicApi } from "@/apis"
import { messagesConverter, getMessageNodeKey, createCheckIsLastMessage } from "./helpers"
import { buildMessageKeysAndTurnGroups } from "./message-turn-groups"
import {
	MessageTurnGroupList,
	USER_MESSAGE_ROW_CLASS,
	getUserMessageStickyTopClass,
	USER_MESSAGE_STICKY_OVERLAY_CLASS,
} from "./MessageTurnGroupList"
import magicToast from "@/components/base/MagicToaster/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { useAutoScroll } from "./hooks/useAutoScroll"
import RevokedEditableUserMessage from "./components/RevokedEditableUserMessage"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"

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
	/** Override BackToLatestButton position (e.g. clear bottom fade above editor) */
	backToLatestButtonClassName?: string
	enableRevokedUserMessageReedit?: boolean
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
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

const MessageList = observer(
	({
		data,
		isShare = false,
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
		backToLatestButtonClassName,
		enableRevokedUserMessageReedit = false,
		topicModelStore,
	}: MessageListProps) => {
		const { t } = useTranslation("super")
		const isMobile = useIsMobile()

		const nodesPanelRef = useRef<HTMLDivElement | null>(null)
		const renderedMessageKeysRef = useRef<Set<string>>(new Set())
		const canAnimateNewMessagesRef = useRef(false)
		const currentTopicKeyRef = useRef<string>("")

		const isStreamLoading = superMagicStore.isTopicStreaming(selectedTopic?.chat_topic_id || "")

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

		const userMessageStickyTopClass = getUserMessageStickyTopClass(isMobile)

		useEffect(() => {
			canAnimateNewMessagesRef.current = true
		}, [currentTopicKey])

		useEffect(() => {
			renderedMessageKeysRef.current = new Set(messageKeys)
		}, [messageKeys])

		const { showBackToLatest, scrollToBottom, notifyPullMoreStarted } = useAutoScroll({
			containerRef: nodesPanelRef,
			topicKey: selectedTopic?.chat_topic_id || "",
			onPullMore: () => {
				handlePullMoreMessage?.(selectedTopic, () => {
					notifyPullMoreStarted()
				})
			},
		})

		const isLastMessageError = useMemo(() => {
			const lastNode = data?.[data?.length - 1]
			const n = superMagicStore.getMessageNode(lastNode?.app_message_id)
			return n?.status === TaskStatus.ERROR
		}, [data])

		const showAiGeneratedTip =
			(data.length > 0 && !showLoading && currentTopicStatus !== TaskStatus.RUNNING) ||
			isLastMessageError

		const revokedMessages = useMemo(
			() => data.filter((node: any) => node?.status === MessageStatus.REVOKED),
			[data],
		)

		const revokedDisplayMessages = useMemo<Array<SuperMagicMessageItem>>(
			() => messagesConverter(revokedMessages, false) as Array<SuperMagicMessageItem>,
			[revokedMessages],
		)

		const firstRevokedUserMessageIndex = useMemo(
			() => revokedDisplayMessages.findIndex((node) => node?.role === "user"),
			[revokedDisplayMessages],
		)

		const firstRevokedUserMessage =
			firstRevokedUserMessageIndex >= 0
				? revokedDisplayMessages[firstRevokedUserMessageIndex]
				: null

		const maskedRevokedMessages = useMemo(() => {
			if (firstRevokedUserMessageIndex < 0)
				return revokedDisplayMessages.map((node, index) => ({ node, index }))

			return revokedDisplayMessages
				.map((node, index) => ({ node, index }))
				.filter(({ index }) => index !== firstRevokedUserMessageIndex)
		}, [firstRevokedUserMessageIndex, revokedDisplayMessages])

		const firstRevokedUserMessageKey = firstRevokedUserMessage
			? getMessageNodeKey(firstRevokedUserMessage) ||
				`${firstRevokedUserMessage?.role || "message"}-${firstRevokedUserMessageIndex}`
			: null

		const checkIsLastMessage = useMemoizedFn(createCheckIsLastMessage(messages))

		/** 是否展开已撤销消息 */
		const [isRevokedMessagesExpanded, setIsRevokedMessagesExpanded] = useState(false)
		/** 是否强制隐藏已撤销消息 */
		const [forceHideRevokedMessages, setForceHideRevokedMessages] = useState(false)
		const [isCancelRevokedLoading, setIsCancelRevokedLoading] = useState(false)
		const [isFirstRevokedUserMessagePendingSend, setIsFirstRevokedUserMessagePendingSend] =
			useState(false)

		/** 展开或收起已撤销消息 */
		const handleRevokedMessagesExpanded = useMemoizedFn(() => {
			setIsRevokedMessagesExpanded((prev) => !prev)
		})

		useEffect(() => {
			setIsFirstRevokedUserMessagePendingSend(false)
		}, [firstRevokedUserMessageKey])

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
			pubsub.subscribe(PubSubEvents.Hide_Revoked_Messages, () => {
				setForceHideRevokedMessages(true)
			})
			pubsub.subscribe(PubSubEvents.Show_Revoked_Messages, () => {
				setForceHideRevokedMessages(false)
			})
			return () => {
				pubsub?.unsubscribe(PubSubEvents.Hide_Revoked_Messages)
				pubsub?.unsubscribe(PubSubEvents.Show_Revoked_Messages)
			}
		}, [])

		const renderNodeContent = (
			node: SuperMagicMessageItem,
			index: number,
			options?: {
				disableEntryAnimation?: boolean
				previousNode?: SuperMagicMessageItem
			},
		): ReactNode => {
			const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`
			const firstRevokedUserMessageKey = firstRevokedUserMessage
				? getMessageNodeKey(firstRevokedUserMessage) ||
					`${firstRevokedUserMessage?.role || "message"}-${firstRevokedUserMessageIndex}`
				: null
			const isFirstRevokedUserMessage = nodeKey === firstRevokedUserMessageKey

			if (!children) {
				const isNewlyInserted =
					!options?.disableEntryAnimation &&
					Boolean(nodeKey) &&
					entryAnimationMeta.insertedKeySet.has(nodeKey)
				const entryAnimationOrder = isNewlyInserted
					? entryAnimationMeta.insertedOrderMap.get(nodeKey) || 0
					: 0

				const previousNode = options?.previousNode || messages?.[index - 1]
				return (
					<Node
						role={node?.role || "user"}
						node={node}
						prevNode={previousNode}
						isFirst={previousNode?.role === "user" && node?.role === "assistant"}
						checkIsLastMessage={checkIsLastMessage}
						selectedTopic={selectedTopic}
						onSelectDetail={setSelectedDetail}
						isSelected={node?.topic_id === selectedTopic?.id}
						onFileClick={onFileClick}
						isNewlyInserted={isNewlyInserted}
						entryAnimationOrder={entryAnimationOrder}
						isFirstRevokedUserMessage={isFirstRevokedUserMessage}
						isShare={isShare}
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
				previousNode?: SuperMagicMessageItem
			},
		) => {
			const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`
			const isUser = node?.role !== "assistant" && node?.role !== "tool"

			return (
				<div
					key={nodeKey}
					data-message-id={nodeKey}
					data-message-role={node?.role || "user"}
					className={cn("relative", isUser && USER_MESSAGE_ROW_CLASS)}
				>
					{renderNodeContent(node, index, options)}
				</div>
			)
		}

		return (
			<div
				className={cn(
					"relative flex h-full w-full flex-1 flex-col overflow-hidden",
					"message-list-container",
					className,
				)}
			>
				<ScrollArea
					className={cn(
						"h-full w-full",
						"[&>[data-slot='scroll-area-viewport']>div]:pr-3",
						"[&>[data-slot='scroll-area-viewport']>div]:pl-2",
						"[&>[data-slot='scroll-area-viewport']>div]:pt-0",
						"[&>[data-slot='scroll-area-viewport']>div]:pb-2",
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
							{revokedDisplayMessages.length > 0 && !forceHideRevokedMessages && (
								<section className="relative flex flex-col gap-2">
									{firstRevokedUserMessage &&
										(() => {
											const firstRevokedUserMessageKey =
												getMessageNodeKey(firstRevokedUserMessage) ||
												`${firstRevokedUserMessage?.role || "message"}-${firstRevokedUserMessageIndex}`
											const firstRevokedPreviousNode =
												firstRevokedUserMessageIndex > 0
													? revokedDisplayMessages[
															firstRevokedUserMessageIndex - 1
														]
													: undefined
											const firstRevokedUserMessageContent =
												enableRevokedUserMessageReedit && !isMobile ? (
													<RevokedEditableUserMessage
														node={firstRevokedUserMessage}
														selectedTopic={selectedTopic}
														showLoading={showLoading}
														messagesLength={data.length}
														onFileClick={onFileClick}
														topicModelStore={topicModelStore}
														onPendingSendChange={
															setIsFirstRevokedUserMessagePendingSend
														}
														fallbackContent={renderNodeContent(
															firstRevokedUserMessage,
															firstRevokedUserMessageIndex,
															{
																disableEntryAnimation: true,
																previousNode:
																	firstRevokedPreviousNode,
															},
														)}
													/>
												) : (
													renderNodeContent(
														firstRevokedUserMessage,
														firstRevokedUserMessageIndex,
														{
															disableEntryAnimation: true,
															previousNode: firstRevokedPreviousNode,
														},
													)
												)

											return (
												<div
													data-sticky-message-id={
														firstRevokedUserMessageKey
													}
													className={cn(
														USER_MESSAGE_STICKY_OVERLAY_CLASS,
														userMessageStickyTopClass,
														stickyMessageClassName,
													)}
												>
													<div
														data-message-id={firstRevokedUserMessageKey}
														data-message-role={
															firstRevokedUserMessage?.role || "user"
														}
														className="relative"
													>
														{firstRevokedUserMessageContent}
													</div>
												</div>
											)
										})()}
									{!isFirstRevokedUserMessagePendingSend &&
									maskedRevokedMessages.length > 0 ? (
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
												{maskedRevokedMessages.map(({ node, index }) =>
													renderNodes(node, index, {
														disableEntryAnimation: true,
														disableUserSticky: true,
														previousNode:
															index > 0
																? revokedDisplayMessages[index - 1]
																: undefined,
													}),
												)}
											</div>
											<div
												className={cn(
													"pointer-events-none absolute inset-0 z-[2] flex items-end",
													"bg-[linear-gradient(to_bottom,transparent_0%,transparent_50%,rgb(var(--sidebar-rgb))_100%)]",
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
									) : null}
									{!isFirstRevokedUserMessagePendingSend &&
									maskedRevokedMessages.length === 0 ? (
										<div className="flex items-start gap-1 rounded-lg bg-sidebar pb-2.5 pt-2.5">
											<IconArrowBackUp size={22} />
											<div className="flex flex-col gap-2.5">
												<div className="text-sm leading-5 text-foreground">
													{t("warningCard.undoMessageContentTip")}
												</div>
												<Button
													className={revokedActionButton}
													onClick={handleCancelRevokedMessages}
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
									) : null}
								</section>
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
						/>
					)}
					{showAiGeneratedTip && (
						<div
							className={cn(
								"mx-auto mb-2.5 mt-2.5 text-center text-xs leading-4",
								"text-muted-foreground",
							)}
						>
							{t("ui.aiGeneratedTip")}
						</div>
					)}
				</ScrollArea>
				<BackToLatestButton
					visible={showBackToLatest}
					className={backToLatestButtonClassName}
					onClick={() => scrollToBottom("smooth")}
				/>
			</div>
		)
	},
)

export default function MessageListEntry(props: MessageListProps) {
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
}
