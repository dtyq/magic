import { Node } from "@/pages/superMagic/components/MessageList/components/Nodes"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { memo, type MutableRefObject, type RefObject, useCallback, useMemo } from "react"
import { useStyles } from "./style"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import {
	messagesConverter,
	createCheckIsLastMessage,
} from "@/pages/superMagic/components/MessageList/helpers"
import { MessageListProvider } from "@/pages/superMagic/components/MessageList/context"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { buildVirtualMessageProjection } from "@/pages/superMagic/components/MessageList/virtual-message-items"
import { VirtualMessageList } from "@/pages/superMagic/components/MessageList/components/VirtualMessageList"
import { MessageViewStateProvider } from "@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext"
import type { MessageListScrollAdapter } from "@/pages/superMagic/components/MessageList/message-list-scroll-adapter"

import { useFileBundleDownload } from "@/pages/superMagic/hooks/useFileBundleDownload"

function MessageList({
	topicId,
	messageList,
	onSelectDetail,
	currentTopicStatus,
	stickyMessageClassName,
	projectFilesStore,
	allowDownload = false,
	scrollContainerRef,
	virtualizerRef,
	onVirtualizerChange,
}: {
	topicId: string
	messageList: any[]
	onSelectDetail: (detail: any) => void
	currentTopicStatus: TaskStatus
	/**
	 * Sticky user-turn mask. Default uses sidebar rgb. Override via:
	 * `[--sticky-message-mask-bg:rgb(var(--background-rgb))]
	 *  [--sticky-message-mask-fade-from:rgb(var(--background-rgb))]`
	 */
	stickyMessageClassName?: string
	projectFilesStore: ProjectFilesStore
	allowDownload?: boolean
	/** Scroll owner supplied by the share shell; virtualization does not create a nested viewport. */
	scrollContainerRef: RefObject<HTMLDivElement | null>
	/**
	 * Handed to the shell so its own scroll writes can address rows instead of guessing at
	 * `scrollHeight`, which stays an estimate until virtua has measured every row it projects.
	 */
	virtualizerRef?: MutableRefObject<MessageListScrollAdapter | null>
	/**
	 * Fires once the virtualizer is addressable and again on every canvas resize. The shell
	 * commits its scroll element after this subtree, so the list mounts a render later than the
	 * shell's own effects run: a scroll asked for in that window reaches nothing and needs
	 * re-issuing here.
	 */
	onVirtualizerChange?: (virtualizer: MessageListScrollAdapter) => void
}) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const fileBundleDownload = useFileBundleDownload(topicId, projectFilesStore, allowDownload)

	const messages = messageList

	const convertedMessages = useMemo(
		() => messagesConverter(messages) as Array<SuperMagicMessageItem>,
		[messages],
	)

	const virtualProjection = useMemo(
		() => buildVirtualMessageProjection(convertedMessages),
		[convertedMessages],
	)

	const checkIsLastMessage = useMemoizedFn(createCheckIsLastMessage(convertedMessages))

	const value = useMemo(() => {
		return {
			allowRevoke: false,
			projectFilesStore,
			fileBundleDownload,
		}
	}, [projectFilesStore, fileBundleDownload])
	const getScrollElement = useCallback(() => scrollContainerRef.current, [scrollContainerRef])
	// Stable identity so the memoized list is not rebuilt on every shell render.
	const handleVirtualizerChange = useMemoizedFn((virtualizer: MessageListScrollAdapter) =>
		onVirtualizerChange?.(virtualizer),
	)

	return (
		<MessageListProvider value={value}>
			<MessageViewStateProvider topicKey={topicId}>
				{fileBundleDownload.agreementModal}
				<div className="relative flex flex-col gap-2">
					<VirtualMessageList
						items={virtualProjection.items}
						userIndices={virtualProjection.userIndices}
						getScrollElement={getScrollElement}
						virtualizerRef={virtualizerRef}
						onVirtualizerChange={handleVirtualizerChange}
						allowResizeStickySync={false}
						stickyMessageClassName={stickyMessageClassName}
						renderNode={({ item }) => {
							const index = item.sourceIndex
							const node = item.node
							return (
								<Node
									node={node}
									onSelectDetail={onSelectDetail}
									isSelected
									currentTopicStatus={TaskStatus.FINISHED}
									role={node?.role || "user"}
									isFirst={
										convertedMessages?.[index - 1]?.role === "user" &&
										convertedMessages?.[index]?.role === "assistant"
									}
									checkIsLastMessage={checkIsLastMessage}
									selectedTopic={null}
									isShare={true}
								/>
							)
						}}
					/>
					{messageList.length > 0 && currentTopicStatus !== TaskStatus.RUNNING && (
						<div className={styles.aiGeneratedTip}>{t("ui.aiGeneratedTip")}</div>
					)}
				</div>
			</MessageViewStateProvider>
		</MessageListProvider>
	)
}

export default memo(MessageList)
