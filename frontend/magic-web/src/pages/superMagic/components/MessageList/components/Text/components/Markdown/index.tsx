import XMarkdown, {
	type ComponentProps as XMarkdownComponentProps,
	type XMarkdownProps,
} from "@ant-design/x-markdown"
import { QRCode } from "antd"
import {
	memo,
	useMemo,
	useRef,
	type ComponentProps as ReactComponentProps,
	type MutableRefObject,
	type ReactElement,
} from "react"
import { preprocessMarkdown } from "@/pages/superMagic/utils/handleMarkDown"
import { CITE_MARKER_PATTERN } from "@/pages/superMagic/utils/parseCitations"
import type { CitationSource } from "@/pages/superMagic/utils/parseCitations"
import HtmlCodeBlockPreview from "./components/HtmlCodeBlockPreview"
import type { HtmlCodeBlockPreviewStreamingScrollState } from "./components/HtmlCodeBlockPreview/types"
import {
	extractCodeBlockDomInfoFromDomNode,
	resolveHtmlPreviewCode,
} from "./components/HtmlCodeBlockPreview/markdown-fence"
import { FilePath } from "./parser/FilePath"
import { Image } from "./parser/Image"
import { MarkdownLink, type MarkdownLinkProps } from "./parser/MarkdownLink"
import { cn } from "@/lib/utils"
import type { MarkdownComponentProps } from "./types"
import styles from "./index.module.css"
import { CitationBadge } from "../../../Citations"

const MARKDOWN_DOMPURIFY_CONFIG = {
	ADD_ATTR: ["path", "index"],
	ADD_TAGS: ["cite-badge"],
}
// 规则：
// - allowRawHtml=true：HTML 直接渲染为 DOM（跳过预处理）
// - allowRawHtml=false：完整 HTML 文档包裹在代码块中显示源码；
//   混合内容中 fence 外的零散 HTML 标签转义为纯文本（白名单标签如 file-path 除外）
// - 以 ```html 开头的 fenced block 通过 pre handler 进入 HtmlCodeBlockPreview

// 匹配单行 fenced code 标记，用来统计 ``` 是否成对闭合。
const MARKDOWN_FENCE_LINE_PATTERN = /^\s*```[\w-]*\s*$/gm
// 匹配完整的 fenced code block，用来定位需要跳过的代码块区间。
const MARKDOWN_FENCE_BLOCK_PATTERN = /^\s*```[\w-]*\s*$[\s\S]*?^\s*```\s*$/gm
// 匹配普通 raw HTML 标签，用来识别 fence 外需要特殊处理的 HTML 片段。
const RAW_HTML_TAG_PATTERN = /<\/?([a-z][a-z0-9_-]*)((?:\s+[^>/]*)?)\s*\/?>/gi
// 匹配 DOCTYPE、注释等 HTML 声明节点。
const RAW_HTML_DECLARATION_PATTERN = /<![^>]*>/gi
// 允许保留的项目自定义标签，避免它们在预处理阶段被误转义。
const RAW_HTML_ALLOWED_CUSTOM_TAGS = new Set(["file-path", "cite-badge"])
const QRCODE_FENCE_LANGUAGE = "qrcode"

/** 匹配完整或未闭合的 <references> 块，用于从 Markdown 内容中移除 */
const REFERENCES_STRIP_PATTERN = /<references>[\s\S]*?(<\/references>|$)/

/**
 * 从内容中移除 <references>...</references> 块。
 * 必须在 preprocessMarkdown 之前调用，否则 <references>/<ref> 会被转义为 backtick 代码。
 */
function stripReferencesBlock(content: string): string {
	if (!content.includes("<references>")) return content
	return content.replace(REFERENCES_STRIP_PATTERN, "").trimEnd()
}

/** 将 {{cite:N}} 标记转换为 <cite-badge index="N"></cite-badge> 自定义标签 */
function preprocessCiteMarkers(content: string): string {
	if (!content.includes("{{cite:")) return content
	return content.replace(CITE_MARKER_PATTERN, (_match, index) => {
		return `<cite-badge index="${index}"></cite-badge>`
	})
}

function isCodeLanguage(className: string | undefined, language: string): boolean {
	if (!className) return false

	const tokens = className
		.split(/\s+/)
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean)

	return tokens.some(
		(token) =>
			token === language || token === `lang-${language}` || token === `language-${language}`,
	)
}

function resolveQRCodeValue(props: {
	codeBlockInfo: ReturnType<typeof extractCodeBlockDomInfoFromDomNode>
	isStreaming: boolean
}): string | undefined {
	const { codeBlockInfo, isStreaming } = props
	if (!codeBlockInfo) return undefined
	if (!isCodeLanguage(codeBlockInfo.className, QRCODE_FENCE_LANGUAGE)) return undefined

	const trimmedCode = codeBlockInfo.code.trim()
	if (!trimmedCode) return undefined
	if (isStreaming && codeBlockInfo.streamStatus === "loading") return undefined

	return trimmedCode
}

function escapeHtmlLiteral(raw: string) {
	return raw.replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// 流式消息中用户可能手动结束任务或者大模型偶发漏掉结尾的 ```，这里对为闭合的 fence 做兜底补全
function ensureClosedMarkdownFence(markdown: string) {
	if (!markdown.includes("```")) {
		return markdown
	}

	const fenceCount = markdown.match(MARKDOWN_FENCE_LINE_PATTERN)?.length ?? 0

	if (fenceCount % 2 === 0) {
		return markdown
	}

	return `${markdown.replace(/\s*$/, "")}\n\`\`\``
}

// 只转义 fence 外的裸 HTML，避免 XMarkdown 把普通文本里的 HTML 片段当成原生节点直接渲染。
// 转义后在相邻标签间插入换行、为每行末尾追加两个空格（markdown hard break），保留源码结构。
function escapeRawHtmlSegment(rawSegment: string) {
	if (!rawSegment.includes("<")) {
		return rawSegment
	}

	const escaped = rawSegment
		.replace(RAW_HTML_DECLARATION_PATTERN, escapeHtmlLiteral)
		.replace(RAW_HTML_TAG_PATTERN, (match, tagName: string) => {
			if (RAW_HTML_ALLOWED_CUSTOM_TAGS.has(tagName.toLowerCase())) {
				return match
			}
			return escapeHtmlLiteral(match)
		})

	if (escaped === rawSegment) return escaped

	return escaped.replace(/(&gt;)\s*(&lt;)/g, "$1\n$2").replace(/\n/g, "  \n")
}

// 只允许标准 markdown fenced block 保留原样，其余区段里的裸 HTML 一律转义成文本。解决两类问题：
// 1. fence 外的 HTML 误被 XMarkdown 当成原生 HTML 渲染；导致流式过程中用户可以看到预览容器、流式消息结束后预览容器消失
/**
 * <div style="color:red">这是普通文本里的 HTML 片段</div>
 * 后面是一段正常说明文案
 */
//XMarkdown 可能会把这段 <div> 当成原生 HTML 节点直接渲染，

// 2. 流式过程中 fenced html 和普通文本混排时，预览结果与完成态不一致。
/**
 * 这是说明文字
 * ```html
 * <div style="padding:16px;background:#fff">卡片内容</div>
 * ```
 * 这是一段补充说明
 */
//把 fence 外的这类内容转成普通文本，只保留 ```html 里的 HTML 进入预览。
function normalizeMarkdownHtmlFences(markdown: string) {
	if (!markdown.includes("<")) {
		return markdown
	}

	// 完整的 HTML 文档：包裹在纯代码块中显示源码（不指定 html 语言，避免触发预览）
	const trimmed = markdown.trimStart()
	if (/^<!doctype\s/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
		return "```\n" + markdown + "\n```"
	}

	// 混合内容（markdown + 零散 HTML）：转义 fence 外的裸 HTML 标签
	let normalizedMarkdown = ""
	let lastIndex = 0

	for (const match of Array.from(markdown.matchAll(MARKDOWN_FENCE_BLOCK_PATTERN))) {
		const block = match[0]
		const index = match.index ?? 0
		normalizedMarkdown += escapeRawHtmlSegment(markdown.slice(lastIndex, index))
		normalizedMarkdown += block
		lastIndex = index + block.length
	}

	if (lastIndex === 0) {
		return escapeRawHtmlSegment(markdown)
	}

	normalizedMarkdown += escapeRawHtmlSegment(markdown.slice(lastIndex))
	return normalizedMarkdown
}

export interface UseMarkdownComponentResult {
	pre: (props: XMarkdownComponentProps) => ReactElement
	a: (props: MarkdownLinkProps) => ReactElement
	img: (props: XMarkdownComponentProps) => ReactElement
	"file-path": (props: XMarkdownComponentProps) => ReactElement
	"cite-badge": (props: XMarkdownComponentProps) => ReactElement
}

export function useMarkdownComponent({
	streamingScrollStateRef,
	isStreaming = false,
	citations,
	highlightedCitation,
	onCitationClick,
}: {
	streamingScrollStateRef: MutableRefObject<HtmlCodeBlockPreviewStreamingScrollState>
	isStreaming: boolean
	citations?: CitationSource[]
	highlightedCitation?: number | null
	onCitationClick?: (index: number | null) => void
}): UseMarkdownComponentResult {
	return useMemo(
		() => ({
			pre(props: XMarkdownComponentProps) {
				const { children, className: preClassName, style, title } = props
				const { domNode } = props as XMarkdownComponentProps & {
					domNode?: unknown
				}
				const codeBlockInfo = extractCodeBlockDomInfoFromDomNode(domNode)
				const previewCode = resolveHtmlPreviewCode(codeBlockInfo)
				const qrCodeValue = resolveQRCodeValue({
					codeBlockInfo,
					isStreaming,
				})

				if (qrCodeValue) {
					return (
						<div className={styles.qrCodeBlock} data-testid="markdown-qrcode-block">
							<QRCode
								value={qrCodeValue}
								size={180}
								bordered={false}
								bgColor="#FFFFFF"
							/>
						</div>
					)
				}

				if (!codeBlockInfo || !previewCode) {
					return (
						<pre
							className={typeof preClassName === "string" ? preClassName : undefined}
							style={style}
							title={typeof title === "string" ? title : undefined}
						>
							{children}
						</pre>
					)
				}

				const isCodeBlockStreaming = isStreaming || codeBlockInfo.streamStatus === "loading"

				return (
					<HtmlCodeBlockPreview
						className={typeof preClassName === "string" ? preClassName : undefined}
						style={style}
						title={typeof title === "string" ? title : undefined}
						isStreaming={isCodeBlockStreaming}
						// isSuspended={isSuspendedRef.current}
						codeBlockInfo={codeBlockInfo}
						previewCode={previewCode}
						fullCode={isCodeBlockStreaming ? undefined : previewCode}
						streamingScrollStateRef={streamingScrollStateRef}
					/>
				)
			},
			a: MarkdownLink,
			img(props: XMarkdownComponentProps) {
				return <Image alt={props.alt} src={props.src} />
			},
			"file-path"(props: XMarkdownComponentProps) {
				return <FilePath path={props.path} />
			},
			"cite-badge"(props: XMarkdownComponentProps) {
				const index = Number(props.index)
				if (!index || index < 1) return <></>
				const hasCitationData = citations?.some((c) => c.index === index)
				return (
					<CitationBadge
						index={index}
						highlighted={highlightedCitation === index}
						clickable={!!hasCitationData}
						onClick={(idx) =>
							onCitationClick?.(highlightedCitation === idx ? null : idx)
						}
					/>
				)
			},
		}),
		[isStreaming, streamingScrollStateRef, citations, highlightedCitation, onCitationClick],
	)
}

function MarkdownComponent({
	content = "",
	className,
	isStreaming = false,
	allowRawHtml = true,
	citations,
	highlightedCitation,
	onCitationClick,
	onMouseEnter,
	onMouseLeave,
}: MarkdownComponentProps) {
	const markdownContent = useMemo(() => {
		const normalizedContent = content
		const shouldUseNormalizedStreamingContent = isStreaming && normalizedContent.includes("```")
		const nextMarkdownSource =
			shouldUseNormalizedStreamingContent || !isStreaming ? normalizedContent : content

		const fenceClosed = ensureClosedMarkdownFence(nextMarkdownSource)
		const normalized = allowRawHtml ? fenceClosed : normalizeMarkdownHtmlFences(fenceClosed)
		// 1. 先移除 <references> 块（在 preprocessMarkdown 之前，避免被转义为 backtick 代码）
		const refsStripped = stripReferencesBlock(normalized)
		// 2. preprocessMarkdown 处理标签转义等（{{cite:N}} 是纯文本，不受影响）
		const preprocessed = preprocessMarkdown(refsStripped)
		// 3. 最后将 {{cite:N}} 转为 <cite-badge> 标签（在 preprocessMarkdown 之后，和原逻辑一致）
		return preprocessCiteMarkers(preprocessed)
	}, [content, isStreaming, allowRawHtml])

	const streamingScrollStateRef = useRef<HtmlCodeBlockPreviewStreamingScrollState>({
		hasUserInteracted: false,
	})

	const components = useMarkdownComponent({
		isStreaming,
		streamingScrollStateRef: streamingScrollStateRef,
		citations,
		highlightedCitation,
		onCitationClick,
	})

	return (
		<div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<XMarkdown
				className={cn(
					"!dark:text-white !text-sidebar-foreground",
					styles.plainMarkdown,
					className,
				)}
				escapeRawHtml={false}
				protectCustomTagNewlines
				content={markdownContent}
				components={components as unknown as NonNullable<XMarkdownProps["components"]>}
				streaming={isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined}
				openLinksInNewTab
				dompurifyConfig={MARKDOWN_DOMPURIFY_CONFIG}
			/>
		</div>
	)
}

export default memo(MarkdownComponent)
