import { useMemo, type MouseEvent } from "react"
import MarkdownComponent from "../../../Text/components/Markdown"
import { CitationCard } from "../../../Citations"
import { cn } from "@/utils/cn"
import { extractCitations, trimIncompleteCitationTag } from "@/pages/superMagic/utils/citations"
import { hasKnowledgeBaseTabTarget } from "@/pages/superMagic/events/openFileTab"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMessageViewState } from "@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext"
import { getModelRecoveryMessage } from "@/pages/superMagic/utils/model-error-recovery"
import { ModelErrorRecovery } from "../../../Card/components/ModelErrorRecovery"

export const messageMarkdownBaseClassName = cn(
	"w-full break-words leading-relaxed text-foreground",
	"[&_h1]:mb-2.5 [&_h1]:mt-2.5 [&_h1]:pb-1.5 [&_h1]:text-[2em] [&_h1]:font-semibold [&_h1]:leading-tight",
	"[&_h2]:mb-2.5 [&_h2]:mt-2.5 [&_h2]:pb-1.5 [&_h2]:text-[1.5em] [&_h2]:font-semibold [&_h2]:leading-tight",
	"[&_h3]:mb-2.5 [&_h3]:mt-2.5 [&_h3]:text-[1.25em] [&_h3]:font-semibold [&_h3]:leading-tight",
	"[&_h4]:mb-2.5 [&_h4]:mt-2.5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-tight",
	"[&_h5]:mb-2.5 [&_h5]:mt-2.5 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:leading-tight",
	"[&_h6]:mb-2.5 [&_h6]:mt-2.5 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:leading-tight",
	"[&_blockquote]:mt-0 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_p:has(+p)]:!mb-1 [&_p]:!mb-0 [&_p]:!mt-0 [&_p]:whitespace-pre-wrap",
	"[&_ul]:m-0 [&_ul]:list-outside [&_ul]:p-0 [&_ul]:pl-5",
	"[&_ol]:m-0 [&_ol]:list-outside [&_ol]:p-0 [&_ol]:pl-5",
	"[&>ul]:!mb-1 [&>ul]:!mt-1",
	"[&>ol]:!mb-1 [&>ol]:!mt-1",
	"[&_li]:!m-0 [&_li]:p-0 [&_li]:pl-1 [&_li]:align-top [&_li]:!leading-[1.6em] [&_li]:leading-normal",
	"[&_li_ul]:m-0 [&_li_ul]:p-0 [&_li_ul]:pl-5",
	"[&_li_ol]:m-0 [&_li_ol]:p-0 [&_li_ol]:pl-5",
	"[&_table]:mt-0 [&_table]:block [&_table]:w-full [&_table]:border-collapse [&_table]:border-spacing-0 [&_table]:overflow-auto",
	"[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left",
	"[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5",
	"[&_tr:nth-child(2n)]:bg-muted/40 [&_tr]:border-t [&_tr]:border-border [&_tr]:bg-background",
	"[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
	"[&_pre]:mt-0 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-[85%] [&_pre]:leading-[1.45]",
	"[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[85%]",
	"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[100%]",
	"[&_img]:max-w-full",
)

interface ContentSectionProps {
	node?: Record<string, unknown>
	streamState?: string
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

export function ContentSection({
	node,
	streamState,
	onMouseEnter,
	onMouseLeave,
}: ContentSectionProps) {
	const rawContent = typeof node?.content === "string" ? node.content : ""
	const hasContent = !/^\s*$/.test(rawContent)
	const hasAssistantContent = node?.role === "assistant" && hasContent
	const isContentStreaming = streamState === "content"
	const [highlightedCitation, setHighlightedCitation] = useMessageViewState<number | null>(
		"highlighted-citation",
		null,
	)
	const citations = useMemo(
		() => (hasAssistantContent ? extractCitations(rawContent) : []),
		[hasAssistantContent, rawContent],
	)
	const displayContent = useMemo(
		() => (isContentStreaming ? trimIncompleteCitationTag(rawContent) : rawContent),
		[isContentStreaming, rawContent],
	)

	if (!hasContent) return null

	// Markdown 原样保留内容；恢复提示统一为 12px，其他消息继续使用原阅读字号。
	const recovery = getModelRecoveryMessage(node)
	const content = (
		<>
			<MarkdownComponent
				enableNoSend={node?.role === "assistant"}
				className={cn(
					messageMarkdownBaseClassName,
					recovery && "!text-xs !leading-5 ![--font-size:12px]",
				)}
				isStreaming={isContentStreaming}
				content={displayContent}
				citations={citations}
				highlightedCitation={highlightedCitation}
				onCitationClick={setHighlightedCitation}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
			{citations.length > 0 && (
				<CitationCard
					sources={citations}
					highlightedIndex={highlightedCitation}
					onHighlightChange={setHighlightedCitation}
					onFileClick={(citation) => {
						if (
							citation.type === "knowledge_base" &&
							hasKnowledgeBaseTabTarget({
								knowledgeBaseId: citation.knowledge_base_id || "",
								documentCode: citation.document_code,
								fileKey: citation.file_key,
							})
						) {
							pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
								knowledgeBaseId: citation.knowledge_base_id || "",
								documentCode: citation.document_code,
								fileKey: citation.file_key,
								title: citation.title,
								knowledgeBaseName: citation.knowledge_base_name,
								fileExtension: citation.file_extension,
							})
						}
					}}
				/>
			)}
		</>
	)
	return recovery ? (
		<ModelErrorRecovery message={recovery}>{content}</ModelErrorRecovery>
	) : (
		content
	)
}
