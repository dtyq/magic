import { useMemoizedFn } from "ahooks"
import type { JSONContent } from "@tiptap/react"
import type { SendMessageByContentPayload } from "../types"

/** TipTap JSON for /compact command in current topic */
const COMPACT_CONTEXT_JSON: JSONContent = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [{ type: "text", text: "/compact" }],
		},
	],
}

interface UseCompressContextParams {
	handleSendMessageByContent: (data: SendMessageByContentPayload) => void
}

/** Sends /compact via the same path as Send_Message_by_Content (avoids stale editor value) */
export default function useCompressContext({
	handleSendMessageByContent,
}: UseCompressContextParams) {
	const handleCompressContext = useMemoizedFn(() => {
		handleSendMessageByContent({
			jsonContent: COMPACT_CONTEXT_JSON,
			shouldClearEditorAfterSend: false,
		})
	})

	return { handleCompressContext }
}
