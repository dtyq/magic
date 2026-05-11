import { useMemoizedFn, useResponsive } from "ahooks"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useTranslation } from "react-i18next"
import type { NodeProps } from "../types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { UserMessageCollapsibleRichText } from "../../UserMessageCollapsibleRichText"
import { Attachment } from "@/pages/superMagic/components/MessageList/components/MessageAttachment"
import { MessageStatus } from "@/pages/superMagic/pages/Workspace/types"
import { Button } from "antd"
import { IconEdit } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import MentionList from "@/pages/superMagic/components/MessageEditor/components/MentionList"
import SourceTag from "../SourceTag"
import type { SuperMagicNode } from "@/types/chat/conversation_message"
import type { AttachmentProps as MessageAttachmentProps } from "../../MessageAttachment/type"
import type { RichTextProps as MessageRichTextProps } from "../../Text/components/RichText/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"

interface RichTextMessageNode extends SuperMagicNode {
	content?: string
	rich_text?: {
		content?: string
	}
	raw_content?: {
		rich_text?: {
			content?: string
		}
	}
}

const formatTimestamp = (timestamp: string) => {
	const date = new Date(+`${timestamp}000`)
	const month = (date.getMonth() + 1).toString().padStart(2, "0")
	const day = date.getDate().toString().padStart(2, "0")
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	return `${month}/${day} ${hours}:${minutes}`
}

function RichText(props: NodeProps) {
	const { onSelectDetail, onFileClick: handleFileClick } = props

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| RichTextMessageNode
		| undefined
	const mentions: NonNullable<MessageRichTextProps["mentions"]> =
		((node?.extra?.super_agent?.mentions || []) as MessageRichTextProps["mentions"]) || []
	const mentionItems: MentionListItem[] = mentions.map((mention) => ({
		type: "mention",
		attrs: mention.attrs,
	}))
	const attachments = (node?.attachments || []) as unknown as MessageAttachmentProps[]
	const isMobile = !useResponsive().md

	const { t } = useTranslation("super")

	const onFileClick = useMemoizedFn((item?: TiptapMentionAttributes["data"]) => {
		const result = handleProjectFileMention(item as ProjectFileMentionData, t)
		openMessageFile(result)

		if (isMobile) {
			onSelectDetail?.(result)
		}
	})

	const handleReEdit = useMemoizedFn(() => {
		pubsub.publish(PubSubEvents.Re_Edit_Message, node)
	})

	return (
		<div className="flex w-full flex-col gap-1.5">
			<div className="flex h-5 w-full items-center justify-end gap-2.5">
				<SourceTag source={node} />
				<span className={cn("text-xs leading-4 text-muted-foreground")}>
					{formatTimestamp(props?.node?.send_time)}
				</span>
			</div>
			<div className="ml-auto w-full self-end whitespace-pre-wrap rounded-[12px] border border-border bg-white p-2.5 text-sm font-normal leading-[1.4] text-foreground shadow-sm dark:bg-card [&_p]:mb-0">
				{mentions && mentions.length > 0 && (
					<div className="mb-1.5">
						<MentionList
							mentionItems={mentionItems}
							onFileClick={onFileClick}
							messageContent={node?.content}
							markerClickScene="messageList"
							iconSize={16}
						/>
					</div>
				)}
				<Attachment
					attachments={attachments}
					onSelectDetail={onFileClick}
					onFileClick={handleFileClick}
				/>
				<UserMessageCollapsibleRichText
					clampFadeFromClass="from-white dark:from-card"
					content={node?.content}
					onFileClick={onFileClick}
					mentions={mentions}
				/>
				{/* 重新编辑按钮，只在移动端显示 */}
				{isMobile &&
					props?.node?.status === MessageStatus.REVOKED &&
					!props?.isShare &&
					props?.isFirstRevokedUserMessage && (
						<div className="relative z-[3] flex w-full justify-end">
							<Button
								className="!mt-2.5 !flex !h-[22px] !w-fit flex-none !cursor-pointer !items-center !gap-1 !rounded-md !border !border-border !bg-background !px-1.5 !py-0 !text-[10px] !font-normal !leading-[13px] !text-muted-foreground hover:!bg-fill hover:!text-muted-foreground"
								onClick={handleReEdit}
							>
								<IconEdit className="text-muted-foreground" size={16} />
								<div className="text-foreground/80">
									{t("common.reEditMessage")}
								</div>
							</Button>
						</div>
					)}
			</div>
		</div>
	)
}

export default memo(observer(RichText))
