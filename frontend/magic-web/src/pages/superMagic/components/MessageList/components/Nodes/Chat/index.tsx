import { useMemoizedFn } from "ahooks"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import pubsub from "@/utils/pubsub"
import { useTranslation } from "react-i18next"
import type { NodeProps } from "../types"
import { Attachment } from "@/pages/superMagic/components/MessageList/components/MessageAttachment"
import { superMagicStore } from "@/pages/superMagic/stores"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { UserMessageCollapsibleRichText } from "../../UserMessageCollapsibleRichText"
import AtItem from "@/pages/superMagic/components/MessageEditor/components/AtItem"
import {
	getMentionUniqueId,
	type MentionListItem,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { cn } from "@/lib/utils"

function Chat(props: NodeProps) {
	const { onSelectDetail, onFileClick: handleFileClick } = props

	const { t } = useTranslation("super")

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const mentions = node?.extra?.super_agent?.mentions || []

	const onFileClick = useMemoizedFn((item?: TiptapMentionAttributes) => {
		pubsub.publish("super_magic_switch_detail_mode", "files")

		// 发布文件选择事件，传递文件信息用于打开对应的tab
		// 根据MessageAttachment传递的数据结构，file_id可能在detail.data.file_id或detail.currentFileId中
		// @ts-expect-error - TiptapMentionAttributes does not expose all file id shapes
		const fileId = item?.data?.file_id || item?.currentFileId || item?.file_id || item?.id
		if (item && fileId) {
			pubsub.publish("super_magic_open_file_tab", {
				fileId,
				fileData: item,
			})
		}

		onSelectDetail?.(item)
	})

	const onAtItemFileClick = useMemoizedFn((item?: TiptapMentionAttributes["data"]) => {
		const result = handleProjectFileMention(
			item as ProjectFileMentionData,
			t,
		) as TiptapMentionAttributes

		onFileClick?.(result)
	})

	const contentVisible = node?.content && node?.status !== "finished"
	const mentionsVisible = mentions?.length > 0
	const attachmentsVisible = node?.attachments?.length > 0

	if (props?.node?.status === "suspended" || node?.status === "suspended") {
		// 兼容历史数据
		return node?.content || node?.raw_content?.rich_text
	}
	return (
		<div
			className={cn(
				"flex w-full flex-col gap-1",
				(contentVisible || mentionsVisible || attachmentsVisible) && "pt-2.5",
			)}
		>
			{(contentVisible || mentionsVisible) && (
				<div
					className={cn(
						"ml-auto w-full self-end rounded-[12px] border border-border p-2.5",
						"bg-card text-card-foreground dark:bg-card dark:text-card-foreground",
						"whitespace-pre-wrap text-sm font-normal leading-[1.4] [&_p]:mb-0",
					)}
				>
					{mentionsVisible && (
						<div className="mb-1.5 flex flex-wrap items-center gap-1">
							{mentions?.map((mention: MentionListItem) => (
								<AtItem
									data={mention.attrs}
									key={getMentionUniqueId(mention.attrs)}
									onFileClick={onAtItemFileClick}
								/>
							))}
						</div>
					)}
					{contentVisible && (
						<UserMessageCollapsibleRichText
							content={node?.raw_content?.rich_text?.content || node?.content || ""}
							mentions={mentions}
							onFileClick={onAtItemFileClick}
						/>
					)}
				</div>
			)}
			{attachmentsVisible && (
				<Attachment
					attachments={node.attachments}
					onSelectDetail={onFileClick}
					onFileClick={handleFileClick}
				/>
			)}
		</div>
	)
}

export default memo(observer(Chat))
