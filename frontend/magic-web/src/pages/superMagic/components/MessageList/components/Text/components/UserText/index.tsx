import { ConversationMessageType } from "@/types/chat/conversation_message"
import { memo } from "react"
import RichText from "../RichText"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"

const UserText = ({
	node,
	onFileClick,
}: {
	node: any
	onFileClick?: (fileId: string, item: TiptapMentionAttributes) => void
}) => {
	if (node.raw_content) {
		switch (node.raw_content.type) {
			case ConversationMessageType.RichText:
				return (
					<RichText
						content={node?.raw_content?.rich_text?.content}
						onFileClick={onFileClick}
					/>
				)
			default:
				return node?.raw_content?.content
		}
	}

	switch (node?.type) {
		case ConversationMessageType.RichText:
			return (
				<RichText
					content={node?.content || node?.rich_text?.content}
					onFileClick={onFileClick}
				/>
			)
		default:
			return node?.content || node?.[node?.type]?.content
	}
}

export default memo(UserText)
