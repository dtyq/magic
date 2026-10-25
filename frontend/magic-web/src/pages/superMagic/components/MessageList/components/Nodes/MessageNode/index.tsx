import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { NodeProps } from "../types"
import { AttachmentSection } from "./sections/AttachmentSection"
import { ContentSection } from "./sections/ContentSection"
import { ReasoningSection } from "./sections/ReasoningSection"
import { ToolCallContainer } from "./tool-call/ToolCallContainer"
import { isRenderableToolCall } from "./tool-call/types"

const MessageNode = observer(function MessageNode(props: NodeProps) {
	const node = (superMagicStore.getRenderedMessageNode?.(
		props.node?.super_message_id,
		props.node?.topic_id,
	) ?? superMagicStore.getMessageNode(props.node?.super_message_id)) as
		Record<string, unknown> | undefined
	const topicId = props.node?.topic_id || ""
	const correlationId = props.node?.correlation_id || ""
	const messageId = props.node?.app_message_id || ""
	const ownerSuperMessageId = String(node?.super_message_id || props.node?.super_message_id || "")
	// Final transport removes StreamState immediately; the Store render phase keeps the row's
	// reasoning/content animation observable until the canonical snapshot is visibly consumed.
	const streamState = superMagicStore.getAssistantRenderPhase(
		topicId,
		ownerSuperMessageId,
		correlationId,
		messageId,
	)
	const rawContent = typeof node?.content === "string" ? node.content : ""
	const hasAssistantContent = node?.role === "assistant" && !/^\s*$/.test(rawContent)
	const renderableToolCalls = (Array.isArray(node?.tool_calls) ? node.tool_calls : []).filter(
		isRenderableToolCall,
	)

	if (node?.role === "tool") {
		// AttachmentSection is this role's only visible output, so the spacing has to travel with
		// it. A wrapper here would keep emitting a 12px gap for every result that renders nothing.
		return (
			<AttachmentSection
				// 仅实际渲染的附件列表带此标记，供完成提示的布局样式判断间距。
				className="message-attachments mb-3"
				node={node}
				fallbackNode={props.node}
				prevSuperMessageId={props.prevNode?.super_message_id}
				onFileClick={props.onFileClick}
				onSelectDetail={props.onSelectDetail}
			/>
		)
	}

	return (
		<div
			className={cn(
				"flex w-full flex-col gap-2",
				hasAssistantContent &&
					props.contentMode !== "process" &&
					"rounded-lg transition-[background-color,box-shadow] group-hover:bg-muted group-hover:shadow-[-2px_0_0_5px_rgb(var(--muted-rgb))]",
			)}
		>
			{props.contentMode !== "answer" && (
				<ReasoningSection
					node={node}
					messageId={messageId}
					streamState={streamState}
					onMouseEnter={props.onMouseEnter}
					onMouseLeave={props.onMouseLeave}
				/>
			)}
			{props.contentMode !== "process" && (
				<ContentSection
					node={node}
					streamState={streamState}
					onMouseEnter={props.onMouseEnter}
					onMouseLeave={props.onMouseLeave}
				/>
			)}
			{props.contentMode !== "answer" &&
				renderableToolCalls.map((toolCall) =>
					toolCall.function.name === "run_sdk_snippet" ? null : (
						<ToolCallContainer
							key={toolCall.id}
							toolCall={toolCall}
							topicId={topicId}
							ownerSuperMessageId={ownerSuperMessageId}
							selectedTopic={props.selectedTopic}
							isShare={props.isShare}
							correlationId={correlationId || messageId}
							onSelectDetail={props.onSelectDetail}
							onMouseEnter={props.onMouseEnter}
							onMouseLeave={props.onMouseLeave}
						/>
					),
				)}
			{props.contentMode !== "process" && (
				<AttachmentSection
					className="message-attachments"
					node={node}
					fallbackNode={props.node}
					prevSuperMessageId={props.prevNode?.super_message_id}
					onFileClick={props.onFileClick}
					onSelectDetail={props.onSelectDetail}
				/>
			)}
		</div>
	)
})

MessageNode.displayName = "MessageNode"

export default MessageNode
