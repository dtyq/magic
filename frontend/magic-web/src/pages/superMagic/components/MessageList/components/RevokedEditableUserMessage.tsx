import { useMemoizedFn } from "ahooks"
import { memo, useMemo, useState, type ReactNode } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { observer } from "mobx-react-lite"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import ModelSwitchContainer from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/ModelSwitchContainer"
import SourceTag from "@/pages/superMagic/components/MessageList/components/Nodes/SourceTag"
import {
	getMentionUniqueId,
	type MentionListItem,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { DataService, ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import { isAllowedMention as defaultIsAllowedMention } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { UserMessageCollapsibleRichText } from "@/pages/superMagic/components/MessageList/components/UserMessageCollapsibleRichText"
import MentionList from "@/pages/superMagic/components/MessageEditor/components/MentionList"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import { useTranslation } from "react-i18next"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import type { RevokedMessageEditorContext } from "@/pages/superMagic/components/MessageList/revoked-editor-context"

interface RevokedEditableUserMessageProps {
	node: SuperMagicMessageItem
	selectedTopic: Topic | null
	showLoading?: boolean
	messagesLength: number
	/** 撤回进入编辑态时临时隐藏的 failed optimistic 消息；发送成功后据此做真正清理。 */
	hiddenOptimisticMessageIds?: string[]
	onFileClick?: (fileItem: unknown) => void
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
	editorContext?: RevokedMessageEditorContext
	fallbackContent: ReactNode
	onPendingSendChange?: (isPending: boolean) => void
}

interface PendingSendSnapshot {
	content: JSONContent | undefined
	mentionItems: MentionListItem[]
}

function RevokedEditableUserMessage({
	node,
	selectedTopic,
	showLoading = false,
	messagesLength,
	hiddenOptimisticMessageIds = [],
	onFileClick,
	topicModelStore,
	editorContext: editorContextOverride,
	fallbackContent,
	onPendingSendChange,
}: RevokedEditableUserMessageProps) {
	const { projectFilesStore: messageListProjectFilesStore } = useMessageListContext()
	const resolvedProjectFilesStore =
		editorContextOverride?.projectFilesStore ?? messageListProjectFilesStore
	const resolvedSelectedProject =
		editorContextOverride?.selectedProject !== undefined
			? editorContextOverride.selectedProject
			: projectStore.selectedProject
	const [isPendingSend, setIsPendingSend] = useState(false)
	const [pendingSendSnapshot, setPendingSendSnapshot] = useState<PendingSendSnapshot | null>(null)
	const { t } = useTranslation("super")
	const messageNode = superMagicStore.getMessageNode(node?.super_message_id) as
		| {
				content?: string
				rich_text?: {
					content?: string
				}
				raw_content?: {
					rich_text?: {
						content?: string
					}
				}
				extra?: {
					super_agent?: {
						mentions?: MentionListItem[]
					}
				}
		  }
		| undefined

	const initialMentionItems = useMemo(
		() => messageNode?.extra?.super_agent?.mentions || [],
		[messageNode?.extra?.super_agent?.mentions],
	)
	const initialMentionKeys = useMemo(
		() => new Set(initialMentionItems.map((item) => getMentionUniqueId(item.attrs))),
		[initialMentionItems],
	)

	const initialContent = useMemo(() => {
		const rawContent =
			messageNode?.content ||
			messageNode?.rich_text?.content ||
			messageNode?.raw_content?.rich_text?.content

		if (!rawContent) return null

		try {
			if (typeof rawContent === "string") {
				return JSON.parse(rawContent) as JSONContent
			}

			return rawContent as JSONContent
		} catch (error) {
			console.error("Failed to parse revoked message content:", error)
			return null
		}
	}, [
		messageNode?.content,
		messageNode?.rich_text?.content,
		messageNode?.raw_content?.rich_text?.content,
	])
	const isAllowedMention = useMemo(() => {
		return (attrs: TiptapMentionAttributes, dataService: DataService) => {
			const mentionKey = getMentionUniqueId(attrs)
			if (initialMentionKeys.has(mentionKey)) return true

			return defaultIsAllowedMention(attrs, dataService)
		}
	}, [initialMentionKeys])
	const handleMentionFileClick = useMemoizedFn((item?: TiptapMentionAttributes["data"]) => {
		const result = handleProjectFileMention(item as ProjectFileMentionData, t)
		openMessageFile(result)
	})
	const pendingContent = pendingSendSnapshot?.content
	const pendingMentionItems = pendingSendSnapshot?.mentionItems ?? initialMentionItems
	const pendingMessageContent = useMemo(() => {
		if (!pendingContent) return null

		return (
			<div
				className="flex w-full flex-col gap-1.5"
				data-testid="revoked-message-pending-node"
			>
				<div className="flex h-5 w-full items-center justify-end gap-2.5">
					<SourceTag source={messageNode} />
					<span className="text-xs leading-4 text-muted-foreground">
						{formatTimestamp(node?.send_time)}
					</span>
				</div>
				<div className="ml-auto w-full self-end whitespace-pre-wrap rounded-[12px] border border-border bg-white p-2.5 text-sm font-normal leading-[1.4] text-foreground shadow-sm dark:bg-card [&_p]:mb-0">
					{pendingMentionItems.length > 0 && (
						<div className="mb-1.5">
							<MentionList
								mentionItems={pendingMentionItems}
								onFileClick={handleMentionFileClick}
								messageContent={pendingContent}
								markerClickScene="messageList"
								iconSize={16}
								projectFilesStore={resolvedProjectFilesStore}
							/>
						</div>
					)}
					<UserMessageCollapsibleRichText
						clampFadeFromClass="from-white dark:from-card"
						content={pendingContent}
						onFileClick={handleMentionFileClick}
						mentions={pendingMentionItems}
					/>
				</div>
			</div>
		)
	}, [
		handleMentionFileClick,
		messageNode,
		node?.send_time,
		pendingContent,
		pendingMentionItems,
		resolvedProjectFilesStore,
	])

	const editorContext = useMemo<SceneEditorContext | null>(() => {
		if (!selectedTopic || !initialContent) return null
		const topicMode = editorContextOverride?.topicMode ?? selectedTopic.topic_mode

		return {
			selectedProject: resolvedSelectedProject,
			selectedTopic,
			selectedWorkspace:
				editorContextOverride?.selectedWorkspace ??
				workspaceStore.selectedWorkspace ??
				workspaceStore.firstWorkspace,
			setSelectedTopic:
				editorContextOverride?.setSelectedTopic ?? topicStore.setSelectedTopic,
			setSelectedWorkspace: editorContextOverride?.setSelectedWorkspace,
			topicMode,
			modelTopicMode: editorContextOverride?.modelTopicMode,
			topicStore: editorContextOverride?.topicStore,
			mentionPanelStore: editorContextOverride?.mentionPanelStore,
			topicModelStore: editorContextOverride?.topicModelStore ?? topicModelStore,
			mergeSendParams: editorContextOverride?.mergeSendParams,
			size: "small",
			showLoading,
			messagesLength,
			initialContent,
			autoFocus: true,
			onFileClick,
			attachments: resolvedProjectFilesStore?.workspaceFileTree ?? [],
			projectFilesStore: resolvedProjectFilesStore,
			isAllowedMention,
			onSendStart: ({ content, mentionItems }) => {
				setPendingSendSnapshot({
					content,
					mentionItems,
				})
				setIsPendingSend(true)
				onPendingSendChange?.(true)
			},
			onSendComplete: ({ success }) => {
				if (!success) {
					setIsPendingSend(false)
					setPendingSendSnapshot(null)
					onPendingSendChange?.(false)
				}
			},
			onSendSuccess: () => {
				if (!selectedTopic?.chat_topic_id) return

				optimisticMessageStore.clearActiveRevokedAnchor(selectedTopic.chat_topic_id)
				hiddenOptimisticMessageIds.forEach((appMessageId) => {
					optimisticMessageStore.remove({
						chat_topic_id: selectedTopic.chat_topic_id,
						app_message_id: appMessageId,
					})
					superMagicStore.removeUserMessage(selectedTopic.chat_topic_id, appMessageId)
				})
				optimisticMessageStore.clearHiddenRevokedOptimisticMessageIds(
					selectedTopic.chat_topic_id,
				)
			},
			modules: {
				mention: { enabled: true },
				aiCompletion: { enabled: false },
				voiceInput: { enabled: false },
			},
			modelSwitch: (
				<ModelSwitchContainer
					size="small"
					selectedTopic={selectedTopic}
					selectedProject={resolvedSelectedProject}
					topicMode={editorContextOverride?.modelTopicMode ?? topicMode}
					showName
					showLabel={false}
					showBorder={false}
					placement="top"
				/>
			),
			layoutConfig: {
				topBarLeft: [],
				topBarRight: [],
				bottomLeft: [ToolbarButton.MODEL_SWITCH],
				bottomRight: [
					ToolbarButton.INTERNET_SEARCH,
					ToolbarButton.MCP,
					ToolbarButton.UPLOAD,
					ToolbarButton.DIVIDER,
					ToolbarButton.EDITOR_MODE_SWITCH,
					ToolbarButton.SEND_BUTTON,
				],
				outsideTop: [],
				outsideBottom: [],
			},
			className: "text-sm",
			containerClassName: "min-h-[140px] rounded-[12px] bg-white shadow-sm dark:bg-card",
		}
	}, [
		initialContent,
		editorContextOverride,
		hiddenOptimisticMessageIds,
		isAllowedMention,
		messagesLength,
		onFileClick,
		onPendingSendChange,
		resolvedProjectFilesStore,
		resolvedSelectedProject,
		selectedTopic,
		showLoading,
		topicModelStore,
	])

	if (isPendingSend) return pendingMessageContent ?? fallbackContent
	if (!editorContext) return fallbackContent

	return (
		<div className="flex w-full flex-col gap-1.5" data-testid="revoked-message-reedit-editor">
			<div className="flex h-5 w-full items-center justify-end gap-2.5">
				<SourceTag source={messageNode} />
				<span className="text-xs leading-4 text-muted-foreground">
					{formatTimestamp(node?.send_time)}
				</span>
			</div>
			<DefaultMessageEditorContainer editorContext={editorContext} />
		</div>
	)
}

function formatTimestamp(timestamp?: string | number) {
	if (!timestamp) return ""

	const date = new Date(+`${timestamp}000`)
	const month = (date.getMonth() + 1).toString().padStart(2, "0")
	const day = date.getDate().toString().padStart(2, "0")
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")

	return `${month}/${day} ${hours}:${minutes}`
}

export default memo(observer(RevokedEditableUserMessage))
