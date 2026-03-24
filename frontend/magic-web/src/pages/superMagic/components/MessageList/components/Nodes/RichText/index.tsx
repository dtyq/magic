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

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const mentions = node?.extra?.super_agent?.mentions || []
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
			<div className="flex h-4 w-full items-center justify-end gap-2.5">
				<span className={cn("text-xs leading-4 text-muted-foreground")}>
					{formatTimestamp(props?.node?.send_time)}
				</span>
			</div>
			<div className="ml-auto w-full self-end whitespace-pre-wrap rounded-[12px] border border-border bg-white p-2.5 text-sm font-normal leading-[1.4] text-foreground shadow-sm dark:bg-card [&_p]:mb-0">
				{/* {mentions?.length > 0 && (
					<FlexBox gap={4} wrap align="center" className="mb-1.5">
						{mentions?.map((mention: any) => (
							<AtItem
								data={mention.attrs}
								key={getMentionUniqueId(mention.attrs as TiptapMentionAttributes)}
								onFileClick={onFileClick}
								messageContent={node?.content}
								markerClickScene="messageList"
							/>
						))}
					</FlexBox>
				)} */}
				<Attachment
					attachments={node?.attachments || []}
					onSelectDetail={onFileClick}
					onFileClick={handleFileClick}
				/>
				<UserMessageCollapsibleRichText
					clampFadeFromClass="from-white dark:from-card"
					content={node?.content}
					onFileClick={onFileClick}
					mentions={mentions}
				/>
				{/* 重新编辑按钮 */}
				{props?.node?.status === MessageStatus.REVOKED && !props?.isShare && (
					<div className="relative z-[3] flex w-full justify-end">
						<Button
							className="!mt-2.5 !flex !h-[22px] !w-fit flex-none !cursor-pointer !items-center !gap-1 !rounded-md !border !border-border !bg-background !px-1.5 !py-0 !text-[10px] !font-normal !leading-[13px] !text-muted-foreground hover:!bg-fill hover:!text-muted-foreground"
							onClick={handleReEdit}
						>
							<IconEdit className="text-muted-foreground" size={16} />
							<div className="text-foreground/80">{t("common.reEditMessage")}</div>
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(observer(RichText))
