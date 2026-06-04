import { cx } from "antd-style"
import type { KeyboardEvent } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	getKnowledgeSearchDetailData,
	getKnowledgeSearchDocumentFileKey,
	inferKnowledgeSearchFileExtension,
	type KnowledgeSearchDetailData,
	type KnowledgeSearchDocument,
	type KnowledgeSearchStatus,
} from "@/pages/superMagic/utils/knowledgeSearchDetail"
import { hasKnowledgeBaseTabTarget } from "@/pages/superMagic/events/openFileTab"

interface KnowledgeSearchContentProps {
	data?: KnowledgeSearchDetailData | { content?: unknown; display_config?: { data?: unknown } }
}

function KnowledgeSearch({ data }: KnowledgeSearchContentProps) {
	const { t } = useTranslation("super")
	const content = getRecordValue(data, "content")
	const displayConfig = getRecordValue(data, "display_config")
	const displayConfigData =
		displayConfig && typeof displayConfig === "object"
			? (displayConfig as Record<string, unknown>).data
			: undefined
	const detailData =
		getKnowledgeSearchDetailData(data) ||
		getKnowledgeSearchDetailData(content) ||
		getKnowledgeSearchDetailData(displayConfigData)
	const documents = Array.isArray(detailData?.documents) ? detailData.documents : []
	const summary = detailData?.summary || {}

	if (!detailData) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("knowledgeSearch.detailEmpty", "暂无知识库检索详情")}
			</div>
		)
	}

	return (
		<div className="h-full overflow-auto bg-background px-6 py-5">
			<div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
				<div className="rounded-lg border border-border bg-white p-4 shadow-sm dark:bg-card">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="min-w-0">
							<div className="text-base font-semibold text-foreground">
								{t("knowledgeSearch.detailTitle", "知识库检索详情")}
							</div>
							<div className="mt-1 break-words text-sm text-muted-foreground">
								{t("knowledgeSearch.queryLabel", {
									query: detailData.query || "-",
									defaultValue: "查询：{{query}}",
								})}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span
								className={cx(
									"rounded px-2 py-1",
									statusClassName(detailData.status),
								)}
							>
								{statusText(detailData.status, t)}
							</span>
							<span className="rounded bg-muted px-2 py-1 text-muted-foreground">
								{t("knowledgeSearch.documentCount", {
									shown: summary.shown_document_count ?? documents.length,
									total: summary.document_count ?? documents.length,
									defaultValue: "文档 {{shown}}/{{total}}",
								})}
							</span>
							<span className="rounded bg-muted px-2 py-1 text-muted-foreground">
								{t("knowledgeSearch.snippetCount", {
									shown: summary.shown_snippet_count ?? 0,
									total: summary.snippet_count ?? 0,
									defaultValue: "片段 {{shown}}/{{total}}",
								})}
							</span>
						</div>
					</div>
					{summary.message && (
						<div className="mt-3 text-sm text-muted-foreground">{summary.message}</div>
					)}
				</div>

				{detailData.truncated && (
					<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
						{t("knowledgeSearch.detailTruncated", "结果已截断，仅展示部分召回内容")}
					</div>
				)}

				{detailData.status === "error" && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{detailData.error?.message ||
							summary.message ||
							t("knowledgeSearch.detailErrorFallback", "知识库检索失败")}
					</div>
				)}

				{detailData.status === "empty" && (
					<div className="rounded-lg border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground dark:bg-card">
						{summary.message ||
							t("knowledgeSearch.detailEmptyFallback", "没有检索到相关知识库内容")}
					</div>
				)}

				{documents.map((document, index) => (
					<KnowledgeSearchDocumentItem
						key={`${document.knowledge_code || ""}:${document.document_code || ""}:${index}`}
						document={document}
					/>
				))}
			</div>
		</div>
	)
}

function KnowledgeSearchDocumentItem({ document }: { document: KnowledgeSearchDocument }) {
	const { t } = useTranslation("super")
	const snippets = Array.isArray(document.snippets) ? document.snippets : []
	const title =
		document.document_name ||
		document.document_code ||
		t("knowledgeSearch.untitledDocument", "未命名文档")
	const knowledgeBaseId = document.knowledge_base_id || document.knowledge_code || ""
	const documentCode = document.document_code
	const fileKey = getKnowledgeSearchDocumentFileKey(document)
	const canOpenDocument = hasKnowledgeBaseTabTarget({ knowledgeBaseId, documentCode, fileKey })
	const openDocument = () => {
		if (!canOpenDocument) return

		pubsub.publish(PubSubEvents.Open_Knowledge_Base_Tab, {
			knowledgeBaseId,
			documentCode,
			fileKey,
			title,
			knowledgeBaseName: document.knowledge_base_name,
			fileExtension: inferKnowledgeSearchFileExtension(fileKey || title),
		})
	}
	const handleDocumentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return
		event.preventDefault()
		openDocument()
	}

	return (
		<div
			className={cx(
				"rounded-lg border border-border bg-white p-4 shadow-sm dark:bg-card",
				canOpenDocument && "cursor-pointer transition-colors hover:bg-muted/20",
			)}
			role={canOpenDocument ? "button" : undefined}
			tabIndex={canOpenDocument ? 0 : undefined}
			aria-label={
				canOpenDocument
					? t("knowledgeSearch.openSourceAria", {
							title,
							defaultValue: "打开来源 {{title}}",
						})
					: undefined
			}
			onClick={openDocument}
			onKeyDown={handleDocumentKeyDown}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="break-words text-base font-semibold text-foreground">
						{title}
					</div>
					<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
						<span>
							{document.knowledge_base_name || document.knowledge_code || "-"}
						</span>
						{document.document_code && (
							<span>
								{t("knowledgeSearch.documentCodeLabel", {
									code: document.document_code,
									defaultValue: "document_code: {{code}}",
								})}
							</span>
						)}
						{document.file_key && (
							<span className="min-w-0 max-w-full break-all">
								{t("knowledgeSearch.fileKeyLabel", {
									fileKey: document.file_key,
									defaultValue: "file_key: {{fileKey}}",
								})}
							</span>
						)}
					</div>
				</div>
				<div className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
					#{document.rank ?? "-"}
				</div>
			</div>

			{snippets.length === 0 ? (
				<div className="mt-4 rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
					{t("knowledgeSearch.noSnippet", "该文档没有返回片段详情")}
				</div>
			) : (
				<div className="mt-4 flex flex-col gap-3">
					{snippets.map((snippet, index) => (
						<div
							key={`${snippet.rank || index}:${snippet.score || 0}`}
							className="rounded-lg border border-border bg-muted/30 p-3"
						>
							<div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span>
									{t("knowledgeSearch.snippetRank", {
										rank: snippet.rank ?? index + 1,
										defaultValue: "片段 #{{rank}}",
									})}
								</span>
								<span>
									{t("knowledgeSearch.scoreLabel", {
										score: formatScore(snippet.score),
										defaultValue: "Score {{score}}",
									})}
								</span>
								<span>
									{t("knowledgeSearch.wordCount", {
										count: snippet.word_count ?? 0,
										defaultValue: "{{count}} 字",
									})}
								</span>
								{snippet.truncated && (
									<span>{t("knowledgeSearch.truncatedTag", "已截断")}</span>
								)}
							</div>
							<div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
								{snippet.text || "-"}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function statusText(
	status: KnowledgeSearchStatus | undefined,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	switch (status) {
		case "success":
			return t("knowledgeSearch.statusSuccess", "检索成功")
		case "empty":
			return t("knowledgeSearch.statusEmpty", "未检索到结果")
		case "error":
			return t("knowledgeSearch.statusError", "检索失败")
		default:
			return t("knowledgeSearch.statusFallback", "详情")
	}
}

function statusClassName(status?: KnowledgeSearchStatus): string {
	switch (status) {
		case "success":
			return "bg-emerald-50 text-emerald-700"
		case "empty":
			return "bg-slate-100 text-slate-600"
		case "error":
			return "bg-red-50 text-red-700"
		default:
			return "bg-muted text-muted-foreground"
	}
}

function formatScore(score?: number): string {
	if (typeof score !== "number" || Number.isNaN(score)) return "-"
	return score.toFixed(2)
}

function getRecordValue(value: unknown, key: string): unknown {
	if (!value || typeof value !== "object") return undefined
	return (value as Record<string, unknown>)[key]
}

export default memo(KnowledgeSearch)
