import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { memo, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, BookOpen, ChevronDown, Hash, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	getKnowledgeSearchDetailData,
	getKnowledgeSearchDocumentFileKey,
	inferKnowledgeSearchFileExtension,
	type KnowledgeSearchDetailData,
	type KnowledgeSearchDocument,
	type KnowledgeSearchSnippet,
} from "@/pages/superMagic/utils/knowledgeSearchDetail"
import { hasKnowledgeBaseTabTarget } from "@/pages/superMagic/events/openFileTab"

type ToolCardStatus = "running" | "success" | "error"

interface KnowledgeSearchToolData {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	detail?: {
		type?: string
		data?: KnowledgeSearchDetailData
	}
}

interface KnowledgeSearchHit {
	title: string
	snippet?: string
	source?: string
	score?: number
	tags?: string[]
	document: KnowledgeSearchDocument
	rawSnippet?: KnowledgeSearchSnippet
}

interface KnowledgeSearchToolProps {
	toolData?: KnowledgeSearchToolData
	loading?: boolean
	classNames?: string
	onClick?: () => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

function ToolCardShell({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"flex w-full shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
				className,
			)}
		>
			{children}
		</div>
	)
}

function ToolCardHeader({
	icon: Icon,
	action,
	remark,
	status = "success",
	duration,
	expanded,
	onClick,
	onToggle,
	toggleAriaLabel,
	collapsible = true,
}: {
	icon: LucideIcon
	action: string
	remark?: string
	status?: ToolCardStatus
	duration?: string
	expanded?: boolean
	onClick?: () => void
	onToggle?: () => void
	toggleAriaLabel?: string
	collapsible?: boolean
}) {
	const interactive = !!onClick || (collapsible && !!onToggle)
	const handleClick = () => {
		if (onClick) {
			onClick()
			return
		}
		if (collapsible) {
			onToggle?.()
		}
	}
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!interactive) return
		if (event.key !== "Enter" && event.key !== " ") return
		event.preventDefault()
		if (onClick) {
			onClick()
			return
		}
		if (collapsible) {
			onToggle?.()
		}
	}

	return (
		<div className="flex select-none items-center gap-1.5">
			<div
				className={cn(
					"flex min-w-0 flex-1 items-center gap-1.5",
					interactive && "cursor-pointer",
				)}
				onClick={interactive ? handleClick : undefined}
				role={interactive ? "button" : undefined}
				tabIndex={interactive ? 0 : undefined}
				onKeyDown={handleKeyDown}
			>
				<div className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-muted">
					{status === "running" ? (
						<Loader2
							className="size-2.5 animate-spin text-muted-foreground"
							aria-hidden
						/>
					) : status === "error" ? (
						<AlertCircle className="size-2.5 text-destructive" aria-hidden />
					) : (
						<Icon className="size-2.5 text-muted-foreground" aria-hidden />
					)}
				</div>
				<span className="shrink-0 text-[14px] leading-5 text-foreground">{action}</span>
				{remark ? (
					<span
						className={cn(
							"min-w-0 flex-1 truncate text-[14px] leading-5",
							status === "error" ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{remark}
					</span>
				) : (
					<span className="min-w-0 flex-1" />
				)}
				{duration ? (
					<span className="shrink-0 text-[12px] leading-4 text-muted-foreground tabular-nums">
						{duration}
					</span>
				) : null}
			</div>
			{collapsible ? (
				<ChevronDown
					className="size-4 shrink-0 cursor-pointer text-foreground transition-transform duration-200"
					style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
					role="button"
					tabIndex={0}
					aria-label={toggleAriaLabel}
					onClick={(event) => {
						event.stopPropagation()
						onToggle?.()
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") return
						event.preventDefault()
						event.stopPropagation()
						onToggle?.()
					}}
				/>
			) : null}
		</div>
	)
}

function ToolCardBody({ children }: { children: ReactNode }) {
	return (
		<div className="relative flex max-h-[320px] flex-col items-stretch gap-2 overflow-y-auto rounded-[6px] bg-muted p-2.5">
			{children}
		</div>
	)
}

function StatusBadge({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex h-[18px] items-center rounded border border-border bg-muted px-1.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
			{children}
		</span>
	)
}

function getKnowledgeSearchData(toolData?: KnowledgeSearchToolData) {
	return getKnowledgeSearchDetailData(toolData?.detail)
}

function formatScore(score?: number) {
	if (typeof score !== "number" || !Number.isFinite(score)) return undefined
	return score.toFixed(2)
}

function toHits(
	documents: KnowledgeSearchDocument[],
	untitledDocument: string,
	formatWordCount: (count: number) => string,
): KnowledgeSearchHit[] {
	return documents.flatMap((document) => {
		const title = document.document_name || untitledDocument
		const source = [document.knowledge_base_name, document.document_name]
			.filter(Boolean)
			.join(" / ")
		const snippets = document.snippets || []

		if (snippets.length === 0) {
			return [
				{
					title,
					source,
					document,
				},
			]
		}

		return snippets.map((snippet) => ({
			title,
			snippet: snippet.text,
			source,
			score: snippet.score,
			tags:
				typeof snippet.word_count === "number"
					? [formatWordCount(snippet.word_count)]
					: undefined,
			document,
			rawSnippet: snippet,
		}))
	})
}

function KnowledgeSearchTool({
	toolData,
	loading,
	classNames,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: KnowledgeSearchToolProps) {
	const { t } = useTranslation("super")
	const data = getKnowledgeSearchData(toolData)
	const status: ToolCardStatus = loading
		? "running"
		: data?.status === "error"
			? "error"
			: "success"
	const query = data?.query || ""
	const errorMessage =
		data?.error?.message || t("knowledgeSearch.error", "检索失败：知识库不可用。")
	const untitledDocument = t("knowledgeSearch.untitledDocument", "未命名文档")
	const hits = useMemo(
		() =>
			toHits(data?.documents || [], untitledDocument, (count) =>
				t("knowledgeSearch.wordCount", {
					count,
					defaultValue: "{{count}} 字",
				}),
			),
		[data?.documents, t, untitledDocument],
	)
	const [expanded, setExpanded] = useState(true)

	const action = t("knowledgeSearch.action", "检索知识库")
	const remark =
		status === "running"
			? query
				? `${query} · ${t("knowledgeSearch.running", "检索中…")}`
				: t("knowledgeSearch.running", "检索中…")
			: status === "error"
				? errorMessage
				: query
					? `${query} · ${hits.length} ${t("knowledgeSearch.hits", "命中")}`
					: data?.summary?.message ||
						toolData?.remark ||
						`${hits.length} ${t("knowledgeSearch.hits", "命中")}`

	const toggleExpanded = useCallback(() => {
		pubsub.publish(PubSubEvents.Message_Suppress_Auto_Scroll)
		setExpanded((value) => !value)
	}, [])

	const openHitSource = useCallback(
		(hit: KnowledgeSearchHit) => {
			const document = hit.document
			const knowledgeBaseId = document.knowledge_base_id || document.knowledge_code || ""
			const documentCode = document.document_code
			const fileKey = hit.rawSnippet?.file_key || getKnowledgeSearchDocumentFileKey(document)
			if (!hasKnowledgeBaseTabTarget({ knowledgeBaseId, documentCode, fileKey })) return

			pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
				knowledgeBaseId,
				documentCode,
				fileKey,
				title:
					document.document_name || t("knowledgeSearch.untitledDocument", "未命名文档"),
				knowledgeBaseName: document.knowledge_base_name,
				fileExtension: inferKnowledgeSearchFileExtension(document.document_name || fileKey),
			})
		},
		[t],
	)

	return (
		<div
			className={cn("h-fit w-full max-w-[720px] flex-none overflow-hidden", classNames)}
			data-tool={toolData?.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ToolCardShell>
				<ToolCardHeader
					icon={BookOpen}
					action={action}
					remark={remark}
					status={status}
					expanded={expanded}
					onClick={onClick}
					onToggle={toggleExpanded}
					toggleAriaLabel={t("knowledgeSearch.toggleResults", "展开或收起检索结果")}
				/>
				{expanded ? (
					<ToolCardBody>
						{query ? (
							<div className="flex items-center gap-1.5">
								<Sparkles
									className="size-3 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-4 text-foreground">
									{query}
								</span>
							</div>
						) : null}

						{status === "error" ? (
							<p className="m-0 text-[12px] leading-4 text-destructive">
								{errorMessage}
							</p>
						) : hits.length === 0 ? (
							<p className="m-0 text-[12px] leading-4 text-muted-foreground">
								{t("knowledgeSearch.empty", "未检索到相关条目")}
							</p>
						) : (
							<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
								{hits.map((hit, index) => {
									const score = formatScore(hit.score)
									return (
										<li
											key={`${hit.document.knowledge_base_id || hit.document.knowledge_code}-${hit.document.document_code || hit.document.file_key}-${index}`}
											className="flex cursor-pointer flex-col gap-0.5 rounded border border-border bg-background p-1.5"
											role="button"
											tabIndex={0}
											aria-label={t("knowledgeSearch.openSourceAria", {
												title: hit.title,
												defaultValue: "打开来源 {{title}}",
											})}
											onClick={() => openHitSource(hit)}
											onKeyDown={(event) => {
												if (event.key !== "Enter" && event.key !== " ")
													return
												event.preventDefault()
												openHitSource(hit)
											}}
										>
											<div className="flex items-center gap-1.5">
												<span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-4 text-foreground">
													{hit.title}
												</span>
												{score ? <StatusBadge>{score}</StatusBadge> : null}
											</div>
											{hit.snippet ? (
												<p className="m-0 line-clamp-2 text-[12px] leading-4 text-muted-foreground">
													{hit.snippet}
												</p>
											) : null}
											<div className="flex flex-wrap items-center gap-1.5">
												{hit.source ? (
													<span className="max-w-full truncate font-mono text-[11px] leading-4 text-muted-foreground">
														{hit.source}
													</span>
												) : null}
												{hit.tags?.map((tag) => (
													<span
														key={tag}
														className="inline-flex items-center gap-0.5 rounded bg-muted/50 px-1 py-0.5 text-[10px] leading-3 text-muted-foreground"
													>
														<Hash className="size-2.5" aria-hidden />
														{tag}
													</span>
												))}
											</div>
										</li>
									)
								})}
							</ul>
						)}
					</ToolCardBody>
				) : null}
			</ToolCardShell>
		</div>
	)
}

export default memo(KnowledgeSearchTool)
