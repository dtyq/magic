import { superMagicStore } from "@/pages/superMagic/stores"
import type { NodeProps } from "../types"
import { useEffect, useState } from "react"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { useScrollAreaAutoScroll } from "../shared/hooks/useScrollAreaAutoScroll"
import { useTranslation } from "react-i18next"
import { ReasoningPanel } from "../shared/ReasoningPanel"
import { observer } from "mobx-react-lite"
import { ToolCall } from "./ToolCall"
import { cn } from "@/lib/utils"
import MarkdownComponent from "../../Text/components/Markdown"
import { Attachment } from "@/pages/superMagic/components/MessageList/components/MessageAttachment"
import type { AttachmentProps } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/type"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

const markdownBaseClassName = cn(
	"w-full break-words leading-relaxed text-foreground",
	"[&_h1]:mb-2.5 [&_h1]:mt-2.5 [&_h1]:pb-1.5 [&_h1]:text-[2em] [&_h1]:font-semibold [&_h1]:leading-tight",
	"[&_h2]:mb-2.5 [&_h2]:mt-2.5 [&_h2]:pb-1.5 [&_h2]:text-[1.5em] [&_h2]:font-semibold [&_h2]:leading-tight",
	"[&_h3]:mb-2.5 [&_h3]:mt-2.5 [&_h3]:text-[1.25em] [&_h3]:font-semibold [&_h3]:leading-tight",
	"[&_h4]:mb-2.5 [&_h4]:mt-2.5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-tight",
	"[&_h5]:mb-2.5 [&_h5]:mt-2.5 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:leading-tight",
	"[&_h6]:mb-2.5 [&_h6]:mt-2.5 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:leading-tight",
	"[&_blockquote]:mt-0 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_p:has(+p)]:!mb-1 [&_p]:!mb-0 [&_p]:!mt-0 [&_p]:whitespace-pre-wrap",
	"[&_ul]:m-0 [&_ul]:list-outside [&_ul]:p-0 [&_ul]:pl-5",
	"[&_ol]:m-0 [&_ol]:list-outside [&_ol]:p-0 [&_ol]:pl-5",
	"[&>ul]:!mb-1 [&>ul]:!mt-1",
	"[&>ol]:!mb-1 [&>ol]:!mt-1",
	"[&_li]:!m-0 [&_li]:p-0 [&_li]:pl-1 [&_li]:align-top [&_li]:!leading-[2em] [&_li]:leading-normal",
	"[&_li_ul]:m-0 [&_li_ul]:p-0 [&_li_ul]:pl-5",
	"[&_li_ol]:m-0 [&_li_ol]:p-0 [&_li_ol]:pl-5",
	"[&_table]:mt-0 [&_table]:block [&_table]:w-full [&_table]:border-collapse [&_table]:border-spacing-0 [&_table]:overflow-auto",
	"[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left",
	"[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5",
	"[&_tr:nth-child(2n)]:bg-muted/40 [&_tr]:border-t [&_tr]:border-border [&_tr]:bg-background",
	"[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
	"[&_pre]:mt-0 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-[85%] [&_pre]:leading-[1.45]",
	"[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[85%]",
	"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[100%]",
	"[&_img]:max-w-full",
)

const reasoningMarkdownClassName = cn(
	markdownBaseClassName,
	"text-xs leading-5 text-muted-foreground",
)

const MessageNode = observer(function MessageNode(props: NodeProps) {
	const {
		onMouseEnter,
		onMouseLeave,
		onFileClick: handleFileClick,
		onSelectDetail,
		selectedTopic,
	} = props

	const { t } = useTranslation("super")

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| Record<string, unknown>
		| undefined
	const topicId = props?.node?.topic_id || ""
	const correlationId = props?.node?.correlation_id || ""
	const messageId = props?.node?.app_message_id || ""

	const reasoningContent =
		typeof node?.reasoning_content === "string" ? node.reasoning_content : ""
	const hasReasoningContent = !/^\s*$/.test(reasoningContent)
	const content = typeof node?.content === "string" ? node.content : ""
	const hasContent = !/^\s*$/.test(content)
	const hasAssistantContent = node?.role === "assistant" && hasContent

	const [openReasoning, setOpenReasoning] = useState(false)
	// const hasToolCall = Boolean(node?.tool_calls)
	const hasToolCall = (node?.tool_calls as any[])?.length > 0

	// 兼容话题分享场景下，数据清洗不彻底导致附件在props.node中
	const attachments = Array.isArray(node?.attachments)
		? (node.attachments as AttachmentProps[])
		: Array.isArray(props?.node?.attachments)
			? (props?.node?.attachments as AttachmentProps[])
			: []
	const streamState =
		superMagicStore.getStreamState(topicId, correlationId)?.stage ||
		superMagicStore.getStreamState(topicId, messageId)?.stage

	const { viewportRef: reasoningViewportRef } = useScrollAreaAutoScroll({
		isStreaming: streamState === "reasoning_content",
	})

	const onFileClick = useMemoizedFn((item?: unknown) => {
		openMessageFile(item)

		onSelectDetail?.(item)
	})

	useEffect(() => {
		setOpenReasoning(streamState === "reasoning_content")
	}, [messageId, streamState])

	// console.log("@=======>", JSON.parse(JSON.stringify(node || {})), props?.node)
	if (node?.role === "tool") {
		return (
			<div className="mb-3">
				{attachments.length > 0 && (
					<Attachment
						attachments={attachments}
						onSelectDetail={onFileClick}
						onFileClick={handleFileClick}
					/>
				)}
			</div>
		)
	}
	return (
		<div
			className={cn(
				"flex w-full flex-col gap-2",
				hasAssistantContent &&
					"rounded-lg transition-[background-color,box-shadow] group-hover:bg-muted group-hover:shadow-[-2px_0_0_5px_rgb(var(--muted-rgb))]",
			)}
		>
			{hasReasoningContent && (
				<ReasoningPanel
					classNames="p-0"
					open={openReasoning}
					loading={streamState === "reasoning_content"}
					title={
						streamState === "reasoning_content"
							? t("agentThink.thinking")
							: t("agentThink.thinkDone")
					}
					onToggle={() => {
						pubsub.publish(PubSubEvents.Message_Suppress_Auto_Scroll)
						setOpenReasoning((open) => !open)
					}}
				>
					<ScrollArea
						viewportRef={reasoningViewportRef}
						className="mx-[6px] mb-1 rounded-lg border-black/[0.08] bg-[#f5f6f7] dark:bg-white/10 [&_[data-radix-scroll-area-viewport]]:max-h-60"
					>
						<MarkdownComponent
							className={cn(
								reasoningMarkdownClassName,
								"w-full px-3 pb-1 pt-2 text-muted-foreground/50",
							)}
							onMouseEnter={onMouseEnter}
							onMouseLeave={onMouseLeave}
							isStreaming={streamState === "reasoning_content"}
							content={reasoningContent}
						/>
						<ScrollBar orientation="vertical" />
					</ScrollArea>
				</ReasoningPanel>
			)}
			{hasContent && (
				<MarkdownComponent
					className={markdownBaseClassName}
					isStreaming={streamState === "content"}
					content={content}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			)}

			{hasToolCall &&
				(node?.tool_calls as any[])?.map((o) => {
					if (o?.function?.name === "run_sdk_snippet") {
						return null
					}
					return (
						<ToolCall
							key={o?.id}
							toolCall={o}
							topicId={topicId}
							selectedTopic={selectedTopic}
							isShare={props.isShare}
							correlationId={correlationId || messageId}
							onSelectDetail={onSelectDetail}
							onMouseEnter={onMouseEnter}
							onMouseLeave={onMouseLeave}
						/>
					)
				})}
			{attachments.length > 0 && (
				<Attachment
					attachments={attachments}
					onSelectDetail={onFileClick}
					onFileClick={handleFileClick}
				/>
			)}
		</div>
	)
})

MessageNode.displayName = "MessageNode"

export default MessageNode
