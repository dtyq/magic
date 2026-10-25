import { restoreWechatChatContent } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/transform"
import { WechatChatHistoryExtension } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/extension"
import { useEffect, useMemo, useRef, useState, memo, ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { getSuperIdState } from "@/pages/superMagic/utils/query"
import { projectStore } from "@/pages/superMagic/stores/core"
import { toJS } from "mobx"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { useScheduledTasksModifyModal } from "@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduledTasksModifyModal"
import { superMagicStore } from "@/pages/superMagic/stores"
import { IconClockPlus, IconCopy, IconDownload } from "@tabler/icons-react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { ScheduledTask } from "@/types/scheduledTask"
import { ScheduledTaskApi, SuperMagicApi } from "@/apis"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { Editor } from "@/infrastructure/editors/tiptap/core"
import { Document } from "@/infrastructure/editors/tiptap/extension-document"
import { Paragraph } from "@/infrastructure/editors/tiptap/extension-paragraph"
import { Text as TiptapText } from "@/infrastructure/editors/tiptap/extension-text"
import {
	HardBlock,
	SuperPlaceholderExtension,
} from "@/pages/superMagic/components/MessageEditor/extensions"
import {
	InspectorDetailExtension,
	transformInspectorContent,
} from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail"
import { copyWithMetadata } from "@/utils/clipboard-helpers"
import { MessageStatus, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { observer } from "mobx-react-lite"
import MentionExtension from "@/components/business/MentionPanel/tiptap-plugin"
import { cn } from "@/utils/cn"
import { isEmpty } from "lodash-es"
import { MagicDropdown, MagicModal } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import { Ellipsis, Undo2, FileText } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { extractAllMarkersFromContent } from "@/pages/superMagic/components/MessageEditor/utils/markerContentUtils"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import AttachmentHoverButton from "./components/AttachmentHoverButton"
import OptimisticStatusIndicator from "./OptimisticStatusIndicator"
import { getCurrentConversationRound } from "./round-log"
import { createLogger } from "@/infrastructure/logger"
import {
	getClipboardHtml,
	getClipboardPlainText,
	prependPortableMentions,
} from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"
import { resolveClipboardFilePaths } from "@/pages/superMagic/components/MessageList/utils/resolveClipboardFilePaths"

const enum MenuKey {
	/** Create a scheduled task. */
	CreateTask = "1",
	/** Copy the message. */
	CopyMessage = "2",
	/** Export the conversation. */
	ExportConversation = "3",
	/** Report the conversation round. */
	ReportConversationRound = "4",
}

/** Base styles for undo/menu buttons (Antd Button overrides) */
const undoButtonBase =
	"!flex h-6 flex-none cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-normal leading-4 !bg-white shadow-sm !text-foreground dark:!bg-card hover:!bg-fill"

const UNDO_BUTTON_DEBOUNCE_MS = 300
const logger = createLogger("UserCard")

export function withUserNode<
	T extends {
		node: any
		selectedTopic: Topic | null
		className?: string
	},
>(WrapperComponent: ComponentType<T>) {
	const targetComponent = observer((props: T) => {
		const { node, selectedTopic, className } = props
		const messageNode = superMagicStore.getMessageNode(node?.super_message_id)
		const optimisticStatus = node?.optimisticMeta?.status as "sending" | "failed" | undefined
		const { t } = useTranslation("super")
		const superIdState = getSuperIdState()
		const {
			allowRevoke,
			allowScheduleTaskCreate,
			allowUserMessageCopy,
			allowExport,
			exportModeActive,
			onExportRequest,
			onRetryOptimisticMessage,
			projectFilesStore,
		} = useMessageListContext()
		const workspaceFiles = projectFilesStore?.workspaceFilesList ?? []
		const { openCreateModal, content } = useScheduledTasksModifyModal()

		const [isCheckUndoLoading, setIsCheckUndoLoading] = useState(false)
		const undoClickLockRef = useRef(false)
		const reportBusy = useRef(false)
		const reportTimer = useRef<ReturnType<typeof setTimeout>>()
		const mounted = useRef(true)
		useEffect(() => {
			mounted.current = true
			return () => {
				mounted.current = false
				clearTimeout(reportTimer.current)
			}
		}, [])

		const reportConversationRound = useMemoizedFn(async () => {
			const topicId = selectedTopic?.chat_topic_id
			const currentMessageId = node?.app_message_id
			if (!topicId || !currentMessageId || reportBusy.current) return

			const topicMessages = superMagicStore.messages.get(topicId) || []
			const roundMessages = getCurrentConversationRound(topicMessages, currentMessageId)
			if (roundMessages.length === 0) return

			reportBusy.current = true
			try {
				await superMagicStore.flushMessagePersistenceForReport(topicId)
				// IndexedDB/report codec stays outside the MessageList bundle until the user reports.
				const {
					queryConversationRoundLogs,
					compressConversationRoundLogs,
					getConversationRoundReportWriterId,
				} = await import("@/pages/superMagic/stores/conversation-round-report")
				const records = await queryConversationRoundLogs(topicId)
				const messages = compressConversationRoundLogs({
					records,
					roundMessages: toJS(roundMessages),
					preferredWriterId: getConversationRoundReportWriterId(),
				})

				if (!mounted.current) return
				logger.report("messages", {
					topic_id: selectedTopic?.id,
					chat_topic_id: topicId,
					message_id: currentMessageId,
					messages,
				})
				// Product feedback uses a fixed delay; it does not wait for a delivery receipt.
				reportTimer.current = setTimeout(() => {
					reportBusy.current = false
					magicToast.success(t("ui.reportConversationRoundSuccess"))
				}, 1000)
			} catch (error) {
				reportBusy.current = false
				if (!mounted.current) return
				logger.error({
					eventKey: "conversation_diagnostic_prepare_failed",
					errorKind: "unknown",
					error,
				})
				magicToast.error(t("ui.reportConversationRoundFailed"))
			}
		})

		const items = useMemo(() => {
			return [
				{
					key: MenuKey.CopyMessage,
					label: (
						<div className="flex w-full items-center gap-1.5 text-foreground">
							<IconCopy size={16} className="text-foreground" />
							<span>{t("common.copyMessage")}</span>
						</div>
					),
					visible: allowUserMessageCopy,
				},
				{
					key: MenuKey.CreateTask,
					label: (
						<div className="flex w-full items-center gap-1.5 text-foreground">
							<IconClockPlus size={16} className="text-foreground" />
							<span>{t("scheduleTask.createScheduleTask")}</span>
						</div>
					),
					visible: allowScheduleTaskCreate,
				},
				{
					key: MenuKey.ExportConversation,
					label: (
						<div className="flex w-full items-center gap-1.5 text-foreground">
							<IconDownload size={16} className="text-foreground" />
							<span>{t("export.entry", { defaultValue: "导出对话" })}</span>
						</div>
					),
					visible: allowExport && Boolean(onExportRequest),
				},
				{
					key: MenuKey.ReportConversationRound,
					label: (
						<div className="flex w-full items-center gap-1.5 text-foreground">
							<FileText size={16} className="text-foreground" />
							<span>{t("ui.reportConversationRound")}</span>
						</div>
					),
					"data-testid": "assistant-round-log-report-menu-item",
					visible: true,
				},
			].filter((o) => o.visible)
		}, [t, allowScheduleTaskCreate, allowUserMessageCopy, allowExport, onExportRequest])

		const onSaveTask = useMemoizedFn(
			async (taskData: ScheduledTask.UpdateTask, callback?: () => void) => {
				try {
					ScheduledTaskApi.createScheduledTask(taskData).then(() => {
						magicToast.success(t("hierarchicalWorkspacePopup.createSuccess"))
						// Trigger the task list update event.
						pubsub.publish(PubSubEvents.SCHEDULED_TASK_UPDATED)
						callback?.()
					})
				} catch (error) {
					console.error("创建定时任务失败:", error)
				}
			},
		)

		const onMenuClick = useMemoizedFn(async ({ key }: { key: string }) => {
			switch (key) {
				case MenuKey.CopyMessage: {
					let editor: Editor | undefined
					try {
						const richTextContent =
							messageNode?.content || messageNode?.rich_text?.content
						editor = new Editor({
							content: restoreWechatChatContent(
								transformInspectorContent(JSON.parse(richTextContent)),
							),
							extensions: [
								Document,
								Paragraph,
								TiptapText,
								HardBlock,
								MentionExtension,
								InspectorDetailExtension,
								WechatChatHistoryExtension,
								SuperPlaceholderExtension,
							],
						})

						// Extract complete marker data from the content.
						const fullMarkers = extractAllMarkersFromContent(richTextContent)
						const markerMentionItems: MentionListItem[] = fullMarkers.map(
							(markerData) => ({
								type: "mention" as const,
								attrs: {
									type: MentionItemType.DESIGN_MARKER,
									data: markerData,
								},
							}),
						)

						// Old messages keep attachment mentions outside rich_text; add them to the copied document.
						const originalMentions = messageNode?.extra?.super_agent?.mentions || []
						const currentProjectId =
							superIdState?.projectId ?? projectStore.selectedProject?.id
						const otherMentionItems: MentionListItem[] = originalMentions.filter(
							(mention: MentionListItem) =>
								mention.attrs?.type !== MentionItemType.DESIGN_MARKER,
						)
						const portableMentionAttrs = otherMentionItems.map(
							(mention) => mention.attrs,
						)
						const clipboardEditor = editor
						const preparedContent = resolveClipboardFilePaths(
							editor.getJSON(),
							portableMentionAttrs,
							workspaceFiles,
							currentProjectId,
						).then(({ content: resolvedContent, mentions: resolvedMentions }) => {
							const clipboardContent = prependPortableMentions(
								resolvedContent,
								resolvedMentions,
								workspaceFiles,
								currentProjectId,
							)
							clipboardEditor.commands.setContent(clipboardContent, {
								emitUpdate: false,
							})
							const contentText = getClipboardPlainText(
								clipboardContent,
								workspaceFiles,
								currentProjectId,
							)
							const htmlContent = getClipboardHtml(
								clipboardEditor.getHTML(),
								workspaceFiles,
								currentProjectId,
							)

							// Merge all mentions, prioritizing complete markers extracted from the content.
							const allMentions = [
								...markerMentionItems,
								...resolvedMentions.map((attrs, index) => ({
									...otherMentionItems[index],
									attrs,
								})),
							]

							return {
								plainText: contentText,
								metadata: {
									richText: JSON.stringify(clipboardContent),
									mentions: allMentions,
									type: messageNode?.type,
									messageId: messageNode?.id,
									sourceProjectId: currentProjectId,
								},
								htmlContent,
							}
						})
						// Use a mobile-compatible copy method.
						await copyWithMetadata(preparedContent)

						magicToast.success(t("common.copySuccess"))
					} catch (error) {
						console.error("❌ Copy message error:", error)
						magicToast.error(t("common.copyFailed"))
					} finally {
						editor?.destroy()
					}
					break
				}
				case MenuKey.CreateTask:
					openCreateModal(onSaveTask, {
						workspace_id:
							projectStore.selectedProject?.workspace_id ?? superIdState?.workspaceId,
						project_id: superIdState?.projectId,
						topic_id: superIdState?.topicId,
						message_content: messageNode,
					})
					break
				case MenuKey.ExportConversation:
					onExportRequest?.()
					break
				case MenuKey.ReportConversationRound:
					reportConversationRound()
					break
				default:
					break
			}
		})

		/** Undo the message after the user confirms the action. */
		const handleMessageUndoConfirmCore = useMemoizedFn(async (e) => {
			if (!selectedTopic?.id || !node?.seq_id) return
			if (isCheckUndoLoading || undoClickLockRef.current) return
			e.stopPropagation()
			e.preventDefault()

			try {
				undoClickLockRef.current = true
				setIsCheckUndoLoading(true)
				const res = await SuperMagicApi.checkCanUndoMessage({
					topic_id: selectedTopic.id,
					message_id: props?.node?.seq_id,
				})
				if (res) {
					if (res.can_rollback) {
						MagicModal.warning({
							title: t("warningCard.undoMessageTitle"),
							content: t("warningCard.undoMessageContent"),
							centered: true,
							okText: t("warningCard.undoMessageConfirm"),
							cancelText: t("common.cancel"),
							onOk: () =>
								pubsub.publish(
									PubSubEvents.Interrupt_And_Undo_Message,
									selectedTopic.id,
									node?.seq_id,
								),
						})
					} else {
						magicToast.warning(t("warningCard.undoMessageTip"))
					}
				}
			} catch (error) {
				console.error("handleMessageUndoConfirm error:", error)
			} finally {
				setIsCheckUndoLoading(false)
				undoClickLockRef.current = false
			}
		})
		const { run: handleMessageUndoConfirm } = useDebounceFn(handleMessageUndoConfirmCore, {
			wait: UNDO_BUTTON_DEBOUNCE_MS,
			leading: true,
			trailing: false,
		})

		/** Whether to show the undo button.
		 * Conditions:
		 * 1. The message has not been revoked (IM imStatus !== MessageStatus.REVOKED).
		 * 2. Undo is allowed (allowRevoke, configured by MessageListProvider).
		 * 3. The message does not reference another message (isEmpty(node?.refer_message_id)).
		 */
		const showUndo = useMemo(() => {
			return (
				!optimisticStatus &&
				(node?.imStatus ?? node?.status) !== MessageStatus.REVOKED &&
				allowRevoke &&
				!exportModeActive &&
				isEmpty(node?.refer_message_id)
			)
		}, [
			allowRevoke,
			exportModeActive,
			node?.refer_message_id,
			node?.imStatus,
			node?.status,
			optimisticStatus,
		])

		/** Get message attachments by filtering project_file and upload_file mentions. */
		const attachments = useMemo(() => {
			const mentions = messageNode?.extra?.super_agent?.mentions || []
			return mentions.filter(
				(mention: MentionListItem) =>
					mention.attrs?.type === MentionItemType.PROJECT_FILE ||
					mention.attrs?.type === MentionItemType.UPLOAD_FILE,
			)
		}, [messageNode?.extra?.super_agent?.mentions])

		const hasAttachments = attachments.length > 0

		const actionNode = exportModeActive ? null : (
			<div
				className={cn(
					"mt-1.5 flex w-full gap-1",
					hasAttachments ? "justify-between" : "justify-end",
				)}
			>
				{/* Left: attachment button. */}
				{hasAttachments && <AttachmentHoverButton attachments={attachments} t={t} />}

				{/* Right: undo and more buttons. */}
				<div className="flex gap-1">
					{showUndo && (
						<Button
							className={cn(undoButtonBase, "w-fit")}
							disabled={isCheckUndoLoading}
							onClick={handleMessageUndoConfirm}
						>
							{isCheckUndoLoading ? (
								<Spinner className="animate-spin" size={16} />
							) : (
								<Undo2 size={16} />
							)}
							<span>{t("common.undo")}</span>
						</Button>
					)}
					{items && items?.length > 0 && (
						<MagicDropdown menu={{ items, onClick: onMenuClick }} trigger={["click"]}>
							<span>
								<Button
									className={cn(
										undoButtonBase,
										"h-6 w-6 justify-center !p-0 text-foreground",
									)}
								>
									<Ellipsis size={16} className="text-foreground" />
								</Button>
							</span>
						</MagicDropdown>
					)}
				</div>
			</div>
		)

		const contentNode = (
			<div className={cn("mb-1.5 w-full", className)} data-id={node?.app_message_id}>
				<WrapperComponent {...props} />
				{actionNode}
				{content}
			</div>
		)

		if (!optimisticStatus) return contentNode

		return (
			<div className={cn("mb-1.5 w-full", className)} data-id={node?.app_message_id}>
				<div className="flex w-full gap-1.5">
					<div className="flex w-5 flex-none flex-col">
						<div aria-hidden="true" className="h-[22px]" />
						<div className="flex flex-1 items-center justify-center">
							<OptimisticStatusIndicator
								status={optimisticStatus}
								onRetry={() => onRetryOptimisticMessage?.(node)}
							/>
						</div>
					</div>
					<div className="min-w-0 flex-1">
						<WrapperComponent {...props} />
					</div>
				</div>
				{content}
			</div>
		)
	})
	return memo(targetComponent)
}
