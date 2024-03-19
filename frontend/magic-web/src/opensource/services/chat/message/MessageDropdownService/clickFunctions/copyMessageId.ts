import { clipboard } from "@/opensource/utils/clipboard-helpers"

const copyMessageId = (messageId: string) => {
	clipboard.writeText(messageId)
}

export default copyMessageId
