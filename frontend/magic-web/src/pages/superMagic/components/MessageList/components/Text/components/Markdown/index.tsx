import XMarkdown, {
	type ComponentProps as XMarkdownComponentProps,
	type XMarkdownProps,
} from "@ant-design/x-markdown"
import { QRCode } from "antd"
import {
	memo,
	useMemo,
	useRef,
	type MutableRefObject,
	type ReactElement,
	type ReactNode,
} from "react"
import { preprocessMarkdown } from "@/pages/superMagic/utils/handleMarkDown"
import { prepareNoSendMarkdown } from "@/pages/superMagic/utils/noSend"
import type { CitationSource } from "@/pages/superMagic/utils/citations"
import HtmlCodeBlockPreview from "./components/HtmlCodeBlockPreview"
import type { HtmlCodeBlockPreviewStreamingScrollState } from "./components/HtmlCodeBlockPreview/types"
import {
	extractCodeBlockDomInfoFromDomNode,
	resolveHtmlPreviewCode,
} from "./components/HtmlCodeBlockPreview/markdown-fence"
import { FilePath } from "./parser/FilePath"
import { Image } from "./parser/Image"
import { NoSend } from "./parser/NoSend"
import { MarkdownLink, type MarkdownLinkProps } from "./parser/MarkdownLink"
import { normalizeInlineStyle } from "./normalizeInlineStyle"
import { cn } from "@/utils/cn"
import type { MarkdownComponentProps } from "./types"
import {
	resolveMarkdownRenderSource,
	shouldEnableStreamingTextAnimation,
} from "./streamingMarkdown"
import styles from "./index.module.css"
import { CitationBadge } from "../../../Citations"
import MarkdownCodeBlockToolbar from "./components/MarkdownCodeBlockToolbar"
import { useCodeBlockWrapPreference } from "@/services/markdown/codeBlockWrapPreference"
import { extractFilePathMentions } from "@/pages/superMagic/utils/filePathMention"
import { spacedFileLinkConfig } from "@/pages/superMagic/utils/markedSpacedFileLinks"
import { copySelectedFileReferences } from "@/pages/superMagic/components/MessageList/utils/fileReferenceClipboard"

const MARKDOWN_ALLOWED_URI_REGEXP =
	/^(?:(?:https?|ftps?|mailto|tel|callto|sms|cid|xmpp|matrix|oa|oa-view|open-action|openaction):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i

const MARKDOWN_DOMPURIFY_CONFIG = {
	ADD_ATTR: ["path", "index"],
	ALLOWED_URI_REGEXP: MARKDOWN_ALLOWED_URI_REGEXP,
	ADD_TAGS: ["citation", "references", "ref"],
}
// 规则：
// - allowRawHtml=true：HTML 直接渲染为 DOM（跳过预处理）
// - allowRawHtml=false：完整 HTML 文档包裹在代码块中显示源码；
//   混合内容中 fence 外的零散 HTML 标签转义为纯文本（白名单标签如 file-path 除外）
// - 以 ```html 开头的 fenced block 通过 pre handler 进入 HtmlCodeBlockPreview

// 匹配完整的 fenced code block，用来定位需要跳过的代码块区间。
const MARKDOWN_FENCE_BLOCK_PATTERN = /^\s*```[\w-]*\s*$[\s\S]*?^\s*```\s*$/gm
// 匹配普通 raw HTML 标签，用来识别 fence 外需要特殊处理的 HTML 片段。
const RAW_HTML_TAG_PATTERN = /<\/?([a-z][a-z0-9_-]*)((?:\s+[^>/]*)?)\s*\/?>/gi
// 匹配 DOCTYPE、注释等 HTML 声明节点。
const RAW_HTML_DECLARATION_PATTERN = /<![^>]*>/gi
// 允许保留的项目自定义标签，避免它们在预处理阶段被误转义。
const RAW_HTML_ALLOWED_CUSTOM_TAGS = new Set([
	"file-path",
	"citation",
	"references",
	"ref",
	"no-send",
])
const QRCODE_FENCE_LANGUAGE = "qrcode"

function renderLegacyFilePathCode(code: string): ReactNode {
	const matches = extractFilePathMentions(code)
	if (matches.length === 0) return code

	const nodes: ReactNode[] = []
	let lastIndex = 0
	for (const match of matches) {
		if (match.startIndex > lastIndex) {
			nodes.push(code.slice(lastIndex, match.startIndex))
		}
		nodes.push(<FilePath key={`${match.startIndex}-${match.endIndex}`} path={match.path} />)
		lastIndex = match.endIndex
	}
	if (lastIndex < code.length) nodes.push(code.slice(lastIndex))
	return nodes
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

function resolveCodeLanguage(className: string | undefined): string | undefined {
	if (!className) return undefined

	const languageToken = className
		.split(/\s+/)
		.find((token) => token.startsWith("language-") || token.startsWith("lang-"))

	return languageToken?.replace(/^(?:language-|lang-)/, "") || undefined
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

function getHtmlPreviewViewStateKey(domNode: unknown, code: string) {
	const positionOffset = (domNode as { position?: { start?: { offset?: unknown } } })?.position
		?.start?.offset
	if (typeof positionOffset === "number") return `html-preview-offset-${positionOffset}`

	// Position is normally present on the markdown AST. This compact fallback avoids retaining the
	// full HTML string in the view-state key for compatibility inputs without source positions.
	let hash = 2166136261
	for (let index = 0; index < code.length; index += 1) {
		hash ^= code.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return `html-preview-content-${hash >>> 0}`
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
	citation: (props: XMarkdownComponentProps) => ReactElement
	references: () => ReactElement
	ref: () => ReactElement
}

export function useMarkdownComponent({
	streamingScrollStateRef,
	isStreaming = false,
	enableHtmlCodeBlockPreview = true,
	citations,
	highlightedCitation,
	onCitationClick,
	isCodeWrapped,
	onToggleCodeWrap,
}: {
	streamingScrollStateRef: MutableRefObject<HtmlCodeBlockPreviewStreamingScrollState>
	isStreaming: boolean
	enableHtmlCodeBlockPreview?: boolean
	citations?: CitationSource[]
	highlightedCitation?: number | null
	onCitationClick?: (index: number | null) => void
	isCodeWrapped: boolean
	onToggleCodeWrap: () => void
}): UseMarkdownComponentResult {
	// 用 ref 持有随每个 chunk 变化的 citation 相关值，避免 components 对象随
	// 每个 chunk 重建——否则 components.pre 引用变化会导致 XMarkdown 重新挂载
	// HtmlCodeBlockPreview，造成视觉抖动。
	const citationsRef = useRef(citations)
	citationsRef.current = citations
	const highlightedCitationRef = useRef(highlightedCitation)
	highlightedCitationRef.current = highlightedCitation
	const onCitationClickRef = useRef(onCitationClick)
	onCitationClickRef.current = onCitationClick

	return useMemo(
		() => ({
			pre(props: XMarkdownComponentProps) {
				const { children, className: preClassName, style, title } = props
				const normalizedStyle = normalizeInlineStyle(style)
				const { domNode } = props as XMarkdownComponentProps & {
					domNode?: unknown
				}
				const codeBlockInfo = extractCodeBlockDomInfoFromDomNode(domNode)
				const previewCode = enableHtmlCodeBlockPreview
					? resolveHtmlPreviewCode(codeBlockInfo)
					: undefined
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

				if (!codeBlockInfo) {
					return (
						<pre
							className={typeof preClassName === "string" ? preClassName : undefined}
							style={normalizedStyle}
							title={typeof title === "string" ? title : undefined}
						>
							{children}
						</pre>
					)
				}

				if (!previewCode) {
					const codeBlockClassName = cn(
						styles.codeBlockPre,
						isCodeWrapped ? styles.codeBlockPreWrapped : styles.codeBlockPreUnwrapped,
					)

					return (
						<div className={styles.codeBlock}>
							<MarkdownCodeBlockToolbar
								language={resolveCodeLanguage(codeBlockInfo.className)}
								isWrapped={isCodeWrapped}
								onToggleWrap={onToggleCodeWrap}
								code={codeBlockInfo.code}
							/>
							<pre
								className={cn(
									typeof preClassName === "string" ? preClassName : undefined,
									codeBlockClassName,
								)}
								style={normalizedStyle}
								title={typeof title === "string" ? title : undefined}
							>
								{renderLegacyFilePathCode(codeBlockInfo.code)}
							</pre>
						</div>
					)
				}

				const isCodeBlockStreaming = isStreaming || codeBlockInfo.streamStatus === "loading"

				return (
					<HtmlCodeBlockPreview
						viewStateKey={getHtmlPreviewViewStateKey(domNode, codeBlockInfo.code)}
						className={typeof preClassName === "string" ? preClassName : undefined}
						style={normalizedStyle}
						title={typeof title === "string" ? title : undefined}
						isStreaming={isCodeBlockStreaming}
						// isSuspended={isSuspendedRef.current}
						codeBlockInfo={codeBlockInfo}
						previewCode={previewCode}
						fullCode={isCodeBlockStreaming ? undefined : previewCode}
						streamingScrollStateRef={streamingScrollStateRef}
						isCodeWrapped={isCodeWrapped}
						onToggleCodeWrap={onToggleCodeWrap}
					/>
				)
			},
			a: MarkdownLink,
			img(props: XMarkdownComponentProps) {
				return <Image alt={props.alt} src={props.src} title={props.title} />
			},
			"file-path"(props: XMarkdownComponentProps) {
				return <FilePath path={props.path} />
			},
			citation(props: XMarkdownComponentProps) {
				const index = Number(props.index)
				if (!index || index < 1) return <></>
				const hasCitationData = citationsRef.current?.some((c) => c.index === index)
				const highlighted = highlightedCitationRef.current
				return (
					<CitationBadge
						index={index}
						highlighted={highlighted === index}
						clickable={!!hasCitationData}
						onClick={(idx) =>
							onCitationClickRef.current?.(highlighted === idx ? null : idx)
						}
					/>
				)
			},
			references() {
				return <></>
			},
			ref() {
				return <></>
			},
		}),
		// citation 相关值通过 ref 读取，不加入 deps，保证 streaming 期间 components
		// 对象引用稳定，防止 HtmlCodeBlockPreview 因 pre 函数引用变化而重新挂载。
		[
			enableHtmlCodeBlockPreview,
			isCodeWrapped,
			isStreaming,
			onToggleCodeWrap,
			streamingScrollStateRef,
		],
	)
}

function MarkdownComponent({
	content = "",
	className,
	isStreaming = false,
	allowRawHtml = true,
	enableNoSend = false,
	enableHtmlCodeBlockPreview = true,
	citations,
	highlightedCitation,
	onCitationClick,
	onMouseEnter,
	onMouseLeave,
}: MarkdownComponentProps) {
	const noSend = useMemo(
		() =>
			enableNoSend
				? prepareNoSendMarkdown(
						resolveMarkdownRenderSource(content, { isStreaming }),
						isStreaming,
					)
				: { content, hasControls: false, hasBlock: false },
		[content, isStreaming, enableNoSend],
	)
	const markdownContent = useMemo(() => {
		const normalizedContent = noSend.content
		const shouldUseNormalizedStreamingContent = isStreaming && normalizedContent.includes("```")
		const nextMarkdownSource =
			shouldUseNormalizedStreamingContent || !isStreaming ? normalizedContent : noSend.content

		const fenceClosed = resolveMarkdownRenderSource(nextMarkdownSource, { isStreaming })
		const normalized = allowRawHtml ? fenceClosed : normalizeMarkdownHtmlFences(fenceClosed)
		// preprocessMarkdown 处理标签转义等；citation/references 作为自定义标签保留
		return preprocessMarkdown(normalized, enableNoSend)
	}, [noSend.content, isStreaming, allowRawHtml, enableNoSend])

	const shouldAnimateStreamingText = useMemo(
		() => shouldEnableStreamingTextAnimation(markdownContent, { isStreaming }),
		[isStreaming, markdownContent],
	)

	const streamingOptions = useMemo(
		() =>
			isStreaming
				? {
						hasNextChunk: true,
						enableAnimation: shouldAnimateStreamingText,
					}
				: undefined,
		[isStreaming, shouldAnimateStreamingText],
	)

	const streamingScrollStateRef = useRef<HtmlCodeBlockPreviewStreamingScrollState>({
		hasUserInteracted: false,
	})
	const { isWrapped: isCodeWrapped, toggle: onToggleCodeWrap } = useCodeBlockWrapPreference()

	const components = useMarkdownComponent({
		enableHtmlCodeBlockPreview,
		isStreaming,
		streamingScrollStateRef: streamingScrollStateRef,
		citations,
		highlightedCitation,
		onCitationClick,
		isCodeWrapped,
		onToggleCodeWrap,
	})
	const replyComponents = useMemo(
		() => (noSend.hasControls ? { ...components, "no-send": NoSend } : components),
		[components, noSend.hasControls],
	)
	const purifyConfig = useMemo(
		() =>
			noSend.hasControls
				? {
						...MARKDOWN_DOMPURIFY_CONFIG,
						ADD_TAGS: [...MARKDOWN_DOMPURIFY_CONFIG.ADD_TAGS, "no-send"],
					}
				: MARKDOWN_DOMPURIFY_CONFIG,
		[noSend.hasControls],
	)

	return (
		<div
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onCopy={copySelectedFileReferences}
			data-testid="on-mouse-enter"
		>
			<XMarkdown
				config={spacedFileLinkConfig}
				className={cn(
					"!dark:text-white !text-sidebar-foreground",
					styles.plainMarkdown,
					className,
				)}
				escapeRawHtml={false}
				protectCustomTagNewlines
				content={markdownContent}
				components={replyComponents as unknown as NonNullable<XMarkdownProps["components"]>}
				paragraphTag={noSend.hasBlock ? "div" : undefined}
				streaming={streamingOptions}
				openLinksInNewTab
				dompurifyConfig={purifyConfig}
			/>
		</div>
	)
}

export default memo(MarkdownComponent)
