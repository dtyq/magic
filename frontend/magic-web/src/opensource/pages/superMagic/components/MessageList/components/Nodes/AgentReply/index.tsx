import type { NodeProps } from "../types"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import MarkdownComponent from "../../Text/components/Markdown"
import { useStyles } from "./styles"
import { isEmpty } from "lodash-es"
import { cn } from "@/opensource/lib/utils"

function AgentReply(props: NodeProps) {
	const { onMouseEnter, onMouseLeave, selectedTopic, classNames } = props
	const { styles, cx } = useStyles()

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const isStreamLoading = superMagicStore.getTopicMetadata(
		selectedTopic?.chat_topic_id || "",
	)?.isStreamLoading

	let content = node?.content
	if (node?.event === "before_agent_reply" && content && content !== "" && isStreamLoading) {
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
				/>
			</div>
		</div>
	)
}

export default memo(observer(AgentReply))
