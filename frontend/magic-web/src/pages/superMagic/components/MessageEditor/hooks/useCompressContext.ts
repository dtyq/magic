import { useMemoizedFn } from "ahooks"
import type { JSONContent } from "@tiptap/react"

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
	updateContent: (content: JSONContent | undefined) => void
	handleSend: () => void
}

/** Fills editor with /compact and triggers the same send path as the send button */
export default function useCompressContext({
	updateContent,
	handleSend,
}: UseCompressContextParams) {
	const handleCompressContext = useMemoizedFn(() => {
		updateContent(COMPACT_CONTEXT_JSON)
		handleSend()
	})

	return { handleCompressContext }
}
