import { searchMarkdown, type MarkdownSearchResult } from "./largeMarkdownSearch"
import type { VirtualMarkdownChunk } from "../../largeMarkdown"

interface InitMessage {
	type: "init"
	content: string
	chunks: VirtualMarkdownChunk[]
}

interface SearchMessage {
	type: "search"
	requestId: number
	query: string
	caseSensitive: boolean
	useRegex: boolean
}

type WorkerMessage = InitMessage | SearchMessage

let content = ""
let chunks: VirtualMarkdownChunk[] = []

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const message = event.data
	if (message.type === "init") {
		content = message.content
		chunks = message.chunks
		return
	}

	const results: MarkdownSearchResult[] = searchMarkdown({
		content,
		chunks,
		query: message.query,
		caseSensitive: message.caseSensitive,
		useRegex: message.useRegex,
	})
	self.postMessage({ requestId: message.requestId, results })
}
