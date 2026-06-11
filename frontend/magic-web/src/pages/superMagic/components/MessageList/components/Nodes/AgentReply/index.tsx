import type { NodeProps } from "../types"
import { memo, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import MarkdownComponent from "../../Text/components/Markdown"
import { useStyles } from "./styles"
import { isEmpty } from "lodash-es"
import { cn } from "@/lib/utils"
import { extractCitations, trimIncompleteCitationTag } from "@/pages/superMagic/utils/citations"
import { CitationCard } from "../../Citations"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { hasKnowledgeBaseTabTarget } from "@/pages/superMagic/events/openFileTab"

interface AgentReplyNode {
	content?: string
	content_type?: string
}

function AgentReply(props: NodeProps) {
	const { onMouseEnter, onMouseLeave, classNames, selectedTopic } = props
	const { styles, cx } = useStyles()

	const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null)

	// 同时使用消息级和话题级两层信息来判断当前这条 agent reply 是否仍在流式中：让 HTML 预览增强组件在流式阶段锁定 code mode，避免过早进入 preview。
	// 1. `app_message_id` 用于从 store 中拿到这条消息节点的最新内容与事件类型，确保读取的是流式推进后的最新 node。
	// 2. `selectedTopic.chat_topic_id` 用于读取当前话题的流式状态，判断整个会话是否仍在流式阶段。
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		| AgentReplyNode
		| undefined

	const rawContent = node?.content || ""
	const topicId = props?.node?.topic_id || selectedTopic?.chat_topic_id || ""
	const correlationId = props?.node?.correlation_id || ""
	const messageId = props?.node?.app_message_id || ""
	const streamState =
		superMagicStore.getStreamState(topicId, correlationId)?.stage ||
		superMagicStore.getStreamState(topicId, messageId)?.stage
	const isContentStreaming = streamState === "content"

	// 解析引用数据；references/ref 标签由 Markdown 自定义组件隐藏
	const citations = useMemo(() => extractCitations(rawContent), [rawContent])

	// 流式阶段：截断末尾不完整的 <citation> 标签，避免原生 HTML 解析吞掉后续文本
	const displayContent = useMemo(
		() => (isContentStreaming ? trimIncompleteCitationTag(rawContent) : rawContent),
		[rawContent, isContentStreaming],
	)

	return (
		<div
			className={cn(
				"h-fit w-full flex-none overflow-hidden rounded-lg",
				!isEmpty(node?.content) &&
					"py-1 pl-1 pr-6 transition-[background-color,box-shadow] group-hover:bg-muted group-hover:shadow-[-2px_0_0_5px_rgb(var(--muted-rgb))]",
				node?.content_type === "reasoning" && "rounded-md p-2.5",
			)}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{/*<Text data={node} isUser={false} hideHeader onSelectDetail={() => {}} />*/}
			<div
				className={cx(
					styles.textContent,
					node?.content_type === "reasoning" && styles.reasoningTextContent,
				)}
			>
				<MarkdownComponent
					content={displayContent}
					className={cx(styles.githubMarkdown, classNames?.markdown, "text-foreground")}
					isStreaming={isContentStreaming}
					showCursor={false}
					citations={citations}
					highlightedCitation={highlightedCitation}
					onCitationClick={setHighlightedCitation}
				/>
			</div>
			{citations.length > 0 && (
				<CitationCard
					sources={citations}
					highlightedIndex={highlightedCitation}
					onHighlightChange={setHighlightedCitation}
					onFileClick={(citation) => {
						if (
							citation.type === "knowledge_base" &&
							hasKnowledgeBaseTabTarget({
								knowledgeBaseId: citation.knowledge_base_id || "",
								documentCode: citation.document_code,
								fileKey: citation.file_key,
							})
						) {
							pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
								knowledgeBaseId: citation.knowledge_base_id || "",
								documentCode: citation.document_code,
								fileKey: citation.file_key,
								title: citation.title,
								knowledgeBaseName: citation.knowledge_base_name,
								fileExtension: citation.file_extension,
							})
						}
					}}
				/>
			)}
		</div>
	)
}

export default memo(observer(AgentReply))
