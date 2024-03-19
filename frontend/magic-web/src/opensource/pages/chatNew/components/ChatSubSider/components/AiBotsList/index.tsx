import type Conversation from "@/opensource/models/chat/conversation"
import ConversationItem from "../ConversationItem"
import useStyles from "../../style"
import type { RenderedLists } from "../../types"
import { SegmentedKey } from "../../constants"

interface AiBotsListProps {
	aiGroupList: string[]
	renderedLists: RenderedLists
	activeSegmentedKey: SegmentedKey
	onConversationClick: (conversation: Conversation) => void
}

/**
 * AI bots list component
 */
function AiBotsList({
	aiGroupList,
	renderedLists,
	activeSegmentedKey,
	onConversationClick,
}: AiBotsListProps) {
	const { styles } = useStyles()

	if (!aiGroupList.length) return null

	const items = renderedLists.Ai ?? []
	if (!items.length) return null

	return (
		<div
			className={styles.list}
			style={{
				display: activeSegmentedKey === SegmentedKey.AiBots ? "flex" : "none",
				height: "auto",
			}}
		>
			{items.map((item) => (
				<div key={item} className={styles.virtualItem}>
					<ConversationItem conversationId={item} onClick={onConversationClick} />
				</div>
			))}
		</div>
	)
}

export default AiBotsList
