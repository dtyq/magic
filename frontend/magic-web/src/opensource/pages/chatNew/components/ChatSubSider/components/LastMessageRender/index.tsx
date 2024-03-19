import type { LastReceiveMessage } from "@/opensource/models/chat/conversation/types"
import { ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import { memo } from "react"
import RichText from "../../../ChatMessageList/components/MessageFactory/components/RichText"
import { createStyles } from "antd-style"
import { jsonParse } from "@/opensource/utils/string"

interface LastMessageRenderProps {
	message?: LastReceiveMessage
	className?: string
	style?: React.CSSProperties
}

const useStyles = createStyles(({ css }) => ({
	richText: css`
		p {
			margin: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	`,
}))

const LastMessageRender = memo(
	function LastMessageRender(props: LastMessageRenderProps) {
		const { message, className, style } = props
		const { styles, cx } = useStyles()

		if (!message) {
			return null
		}

		switch (message.type) {
			case ConversationMessageType.RichText:
				return (
					<RichText
						style={style}
						className={cx(styles.richText, className)}
						emojiSize={13}
						content={jsonParse(message.text, {
							doc: [
								{
									type: "paragraph",
									content: [{ type: "text", text: message.text }],
								},
							],
						})}
						messageId={message.seq_id}
						hiddenDetail
					/>
				)
			default:
				return (
					<div style={style} className={className}>
						{message.text}
					</div>
				)
		}
	},
	(prevProps, nextProps) => {
		return (
			prevProps.message?.seq_id === nextProps.message?.seq_id &&
			prevProps.message?.type === nextProps.message?.type &&
			prevProps.message?.text === nextProps.message?.text
		)
	},
)

export default LastMessageRender
