import { useMemo, useState, memo, ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { getSuperIdState } from "@/opensource/pages/superMagic/utils/query"
import { projectStore } from "@/opensource/pages/superMagic/stores/core"
import { useMessageListContext } from "@/opensource/pages/superMagic/components/MessageList/context"
import { useScheduledTasksModifyModal } from "@/opensource/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduledTasksModifyModal"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { IconClockPlus, IconCopy } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { ScheduledTask } from "@/opensource/types/scheduledTask"
import { ScheduledTaskApi, SuperMagicApi } from "@/opensource/apis"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { Editor } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text as TiptapText } from "@tiptap/extension-text"
import { HardBlock } from "@/opensource/pages/superMagic/components/MessageEditor/extensions"
import { copyWithMetadata } from "@/opensource/utils/clipboard-helpers"
import { MessageStatus, Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { observer } from "mobx-react-lite"
import MentionExtension from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import { cn } from "@/opensource/lib/utils"
import { isEmpty } from "lodash-es"
import { MagicDropdown, MagicModal } from "@/opensource/components/base"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { Ellipsis, Undo2 } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Spinner } from "@/opensource/components/shadcn-ui/spinner"
import { extractAllMarkersFromContent } from "@/opensource/pages/superMagic/components/MessageEditor/utils/markerContentUtils"
import { MentionItemType } from "@/opensource/components/business/MentionPanel/types"
import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import AttachmentHoverButton from "./components/AttachmentHoverButton"

const enum MenuKey {
	/** 创建定时任务 */
	CreateTask = "1",
	/** 复制消息 */
	CopyMessage = "2",
}

/** Base styles for undo/menu buttons (Antd Button overrides) */
const undoButtonBase =
	"!flex h-6 flex-none cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-normal leading-4 !bg-white shadow-sm !text-foreground dark:!bg-card hover:!bg-fill"

export function withUserNode<
	T extends {
		node: any
		selectedTopic: Topic | null
		className?: string
	},
>(WrapperComponent: ComponentType<T>) {
	const targetComponent = observer((props: T) => {
		const { node, selectedTopic, className } = props
		const messageNode = superMagicStore.getMessageNode(node?.app_message_id)

		const { t } = useTranslation("super")
		const superIdState = getSuperIdState()
		const { allowRevoke, allowScheduleTaskCreate, allowUserMessageCopy } =
			useMessageListContext()
		const { openCreateModal, content } = useScheduledTasksModifyModal()

		const [isCheckUndoLoading, setIsCheckUndoLoading] = useState(false)

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
			].filter((o) => o.visible)
		}, [t, allowScheduleTaskCreate, allowUserMessageCopy])

		const onSaveTask = useMemoizedFn(
			async (taskData: ScheduledTask.UpdateTask, callback?: () => void) => {
				try {
					ScheduledTaskApi.createScheduledTask(taskData).then(() => {
						magicToast.success(t("hierarchicalWorkspacePopup.createSuccess"))
						// 触发任务列表更新事件
						pubsub.publish(PubSubEvents.SCHEDULED_TASK_UPDATED)
						callback?.()
					})
				} catch (error) {
					console.error("创建定时任务失败:", error)
				}
			},
		)

		const onMenuClick = useMemoizedFn(({ key }: { key: string }) => {
			switch (key) {
				case MenuKey.CopyMessage:
					try {
						let contentText = ""
						const richTextContent =
							messageNode?.content || messageNode?.rich_text?.content
						const editor = new Editor({
							content: JSON.parse(richTextContent),
							extensions: [
								Document,
								Paragraph,
								TiptapText,
								HardBlock,
								MentionExtension,
							],
						})
						contentText = editor.getText()

						// 从 content 中提取完整的 marker 数据
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

						// 获取其他类型的 mentions（非 marker 类型）
						const originalMentions = messageNode?.extra?.super_agent?.mentions || []
						const otherMentionItems: MentionListItem[] = originalMentions.filter(
							(mention: MentionListItem) =>
								mention.attrs?.type !== MentionItemType.DESIGN_MARKER,
						)

						// 合并所有 mentions：优先使用从 content 提取的完整 marker 数据，然后添加其他类型的 mentions
						const allMentions = [...markerMentionItems, ...otherMentionItems]

						// 使用兼容移动端的方案复制
						copyWithMetadata(contentText, {
							richText: richTextContent,
							mentions: allMentions,
							type: messageNode?.type,
							messageId: messageNode?.id,
						})

						magicToast.success(t("common.copySuccess"))
					} catch (error) {
						console.error("❌ Copy message error:", error)
						magicToast.error(t("common.copyFailed"))
					}
					break
				case MenuKey.CreateTask:
					openCreateModal(onSaveTask, {
						workspace_id:
							projectStore.selectedProject?.workspace_id ?? superIdState?.workspaceId,
						project_id: superIdState?.projectId,
						topic_id: superIdState?.topicId,
						message_content: messageNode,
					})
					break
				default:
					break
			}
		})

		/** 撤销操作 - 点击确认撤销按钮 */
		const handleMessageUndoConfirm = useMemoizedFn(async (e) => {
			if (!selectedTopic?.id || !node?.seq_id) return
			e.stopPropagation()
			e.preventDefault()

			try {
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
			}
		})

		/** 是否显示撤销按钮
		 * 显示条件：
		 * 1. 消息未被撤销 (node?.status !== MessageStatus.REVOKED)
		 * 2. 允许撤回 (allowRevoke，由 MessageListProvider 设置)
		 * 3. 消息没有引用其他消息 (isEmpty(node?.refer_message_id))
		 */
		const showUndo = useMemo(() => {
			return (
				node?.status !== MessageStatus.REVOKED &&
				allowRevoke &&
				isEmpty(node?.refer_message_id)
			)
		}, [node?.status, allowRevoke, node?.refer_message_id])

		/** 获取消息附件列表 - 从 mentions 中过滤 project_file 和 upload_file 类型 */
		const attachments = useMemo(() => {
			const mentions = messageNode?.extra?.super_agent?.mentions || []
			return mentions.filter(
				(mention: MentionListItem) =>
					mention.attrs?.type === MentionItemType.PROJECT_FILE ||
					mention.attrs?.type === MentionItemType.UPLOAD_FILE,
			)
		}, [messageNode?.extra?.super_agent?.mentions])

		const hasAttachments = attachments.length > 0

		return (
			<div className={cn("mb-1.5", className)} data-id={node?.app_message_id}>
				<WrapperComponent {...props} />
				<div
					className={cn(
						"mt-1.5 flex w-full gap-1",
						hasAttachments ? "justify-between" : "justify-end",
					)}
				>
					{/* 左侧：附件按钮 */}
					{hasAttachments && <AttachmentHoverButton attachments={attachments} t={t} />}

					{/* 右侧：撤回和更多按钮 */}
					<div className="flex gap-1">
						{showUndo && (
							<Button
								className={cn(undoButtonBase, "w-fit")}
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
							<MagicDropdown
								menu={{ items, onClick: onMenuClick }}
								trigger={["click"]}
							>
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
				{content}
			</div>
		)
	})
	return memo(targetComponent)
}
