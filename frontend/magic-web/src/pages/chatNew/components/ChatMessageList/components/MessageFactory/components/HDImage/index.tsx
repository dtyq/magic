import { ConversationMessageType } from "@/types/chat/conversation_message"
import type { MagicAiImagesProps } from "../AiImageBase"
import AiImageBase from "../AiImageBase"

export default function HDImage(props: Omit<MagicAiImagesProps, "type">) {
	return <AiImageBase type={ConversationMessageType.HDImage} {...props} />
}
