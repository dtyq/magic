import type { NodeProps } from "../types"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import MarkdownComponent from "../../Text/components/Markdown"
import { useStyles } from "./styles"
import { isEmpty } from "lodash-es"
import { cn } from "@/lib/utils"

function AgentReply(props: NodeProps) {
	const { onMouseEnter, onMouseLeave, selectedTopic, classNames } = props
	const { styles, cx } = useStyles()

	// 同时使用消息级和话题级两层信息来判断当前这条 agent reply 是否仍在流式中：让 HTML 预览增强组件在流式阶段锁定 code mode，避免过早进入 preview。
	// 1. `app_message_id` 用于从 store 中拿到这条消息节点的最新内容与事件类型，确保读取的是流式推进后的最新 node。
	// 2. `selectedTopic.chat_topic_id` 用于读取当前话题的流式状态，判断整个会话是否仍在流式阶段。
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const isStreamLoading = superMagicStore.getTopicMetadata(
		selectedTopic?.chat_topic_id || "",
	)?.isStreamLoading
	const isStreamingReply = node?.event === "before_agent_reply" && isStreamLoading

	let content = node?.content
	if (isStreamingReply && content && content !== "") {
		content = node?.content + `<cursor/>`
	}

	return (
		<div
			className={cn(
				"h-fit w-full flex-none overflow-hidden rounded-lg",
				!isEmpty(node?.content) && "py-1 pl-1 pr-6 group-hover/message:bg-muted",
			)}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{/*<Text data={node} isUser={false} hideHeader onSelectDetail={() => {}} />*/}
			<div className={styles.textContent}>
				<MarkdownComponent
					content={content}
					className={cx(styles.githubMarkdown, classNames?.markdown, "text-foreground")}
					isStreaming={isStreamingReply}
				/>
			</div>
		</div>
	)
}

export default memo(observer(AgentReply))
