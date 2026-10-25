import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	useMemo,
} from "react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/use-mobile"
import { FileText, Smartphone } from "lucide-react"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../../contents/HTML/IsolatedHTMLRenderer"
import { flattenAttachments } from "../../../../contents/HTML/utils"
import type { FileItem } from "../../../../contents/HTML/utils/fetchInterceptor"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import { CardActionStrip } from "../../components/CardActionStrip"
import WechatArticlePhonePreview from "./WechatArticlePhonePreview"
import { loadWechatArticleHtml } from "./wechatArticleHtml"
import {
	buildWechatClipboardHtmlFromIframe,
	buildWechatClipboardHtmlFromSource,
} from "./wechatClipboardHtml"
import { copyWechatArticleSelectionSynchronously } from "./wechatNativeClipboard"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

interface WechatArticleViewProps {
	post: SelfMediaPost
	attachments?: PlatformComponentProps["attachments"]
	attachmentList?: PlatformComponentProps["attachmentList"]
	selectedProject?: unknown
	/** Add article file to the current chat input */
	onAddToCurrentChat?: () => void
	/** Navigate to the edit view */
	onGoToEdit?: () => void
	/** Refresh the article content */
	onRefresh?: () => void
	/** Whether the user has permission to edit */
	allowEdit?: boolean
	onInspectorActiveChange?: (active: boolean) => void
}

export interface WechatArticleViewRef {
	getIframeElement: () => HTMLIFrameElement | null
	getArticleHtml: () => Promise<string | null>
	copyArticleRichContent: () => boolean
	startInspector: () => void
	startInspectorAppend: () => void
	stopInspector: () => void
}

type WechatArticleRenderMode = "desktop" | "phone"

function getSafeIframeWindow(iframe: HTMLIFrameElement | null) {
	try {
		return iframe?.contentWindow ?? null
	} catch {
		return null
	}
}

function getSafeIframeDocument(iframe: HTMLIFrameElement | null) {
	try {
		return iframe?.contentDocument ?? null
	} catch {
		return null
	}
}

function getIframeScrollTop(iframe: HTMLIFrameElement | null) {
	if (!iframe) return 0
	const win = getSafeIframeWindow(iframe)
	const doc = getSafeIframeDocument(iframe)
	let scrollTop = 0
	try {
		scrollTop = win?.scrollY ?? win?.pageYOffset ?? 0
	} catch {
		scrollTop = 0
	}
	if (!scrollTop) {
		try {
			scrollTop = doc?.documentElement?.scrollTop ?? doc?.body?.scrollTop ?? 0
		} catch {
			scrollTop = 0
		}
	}
	return Math.max(0, Math.round(scrollTop))
}

function restoreIframeScrollTop(iframe: HTMLIFrameElement | null, scrollTop: number) {
	if (!iframe || scrollTop <= 0) return
	const top = Math.max(0, Math.round(scrollTop))
	const win = getSafeIframeWindow(iframe)
	try {
		if (typeof win?.scrollTo === "function") {
			win.scrollTo({ top, left: 0, behavior: "auto" })
			return
		}
	} catch {
		// Cross-origin iframe windows can block named property reads.
	}
	const doc = getSafeIframeDocument(iframe)
	try {
		if (doc?.documentElement) doc.documentElement.scrollTop = top
		if (doc?.body) doc.body.scrollTop = top
	} catch {
		// Ignore cross-origin access; scroll restoration is best-effort.
	}
}

function escapeHtml(value: string | number | undefined) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

function appendWechatArticleCommentsHtml({
	html,
	post,
	commentsTitle,
	commentsSourceLabel,
	unknownAuthor,
}: {
	html: string
	post: SelfMediaPost
	commentsTitle: string
	commentsSourceLabel: string
	unknownAuthor: string
}) {
	const comments = post.meta.comments || []
	if (!comments.length) return html

	const items = comments
		.map((comment) => {
			const name = comment.name || unknownAuthor
			const avatar = comment.avatarChar || name[0] || unknownAuthor[0] || "评"
			const metaText = [
				comment.time,
				comment.location,
				comment.likes ? `♥ ${comment.likes}` : "",
			]
				.filter(Boolean)
				.join(" · ")
			return `
				<div style="display:flex;gap:12px;padding:16px 0;border-top:1px solid #f4f4f4;">
					<div style="width:32px;height:32px;flex:0 0 32px;border-radius:999px;background:${escapeHtml(comment.avatarColor || "#07c160")};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">${escapeHtml(avatar)}</div>
					<div style="min-width:0;flex:1;">
						<div style="font-size:13px;line-height:1.45;font-weight:500;color:#576b95;">${escapeHtml(name)}</div>
						<div style="margin-top:5px;font-size:14px;line-height:1.7;color:#2b2b2b;">${escapeHtml(comment.text)}</div>
						${
							metaText
								? `<div style="margin-top:5px;font-size:12px;line-height:1.4;color:#9a9a9a;">${escapeHtml(metaText)}</div>`
								: ""
						}
					</div>
				</div>
			`
		})
		.join("")

	const commentsHtml = `
		<section data-wechat-article-comments="true" style="box-sizing:border-box;max-width:760px;margin:56px auto 0;padding:24px 24px 34px;border-top:1px solid #eeeeee;background:#fff;color:#1f1f1f;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',Arial,sans-serif;user-select:none;-webkit-user-select:none;">
			<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:2px;">
				<h2 style="margin:0;font-size:16px;line-height:1.4;font-weight:600;color:#1f1f1f;">${escapeHtml(commentsTitle)}</h2>
				<span style="font-size:12px;line-height:1.4;color:#9a9a9a;white-space:nowrap;">${escapeHtml(commentsSourceLabel)}</span>
			</div>
			${items}
		</section>
	`

	if (/<\/body>/i.test(html)) {
		return html.replace(/<\/body>/i, `${commentsHtml}</body>`)
	}
	return `${html}${commentsHtml}`
}

function WechatArticleViewInner(
	{
		post,
		attachments,
		attachmentList,
		selectedProject,
		onAddToCurrentChat,
		onGoToEdit,
		onRefresh,
		allowEdit,
		onInspectorActiveChange,
	}: WechatArticleViewProps,
	ref: React.ForwardedRef<WechatArticleViewRef>,
) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const article = post.article
	const fileId = article?.fileId
	const isMobile = useIsMobile()
	const [content, setContent] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const [renderMode, setRenderMode] = useState<WechatArticleRenderMode>(() =>
		isMobile ? "phone" : "desktop",
	)
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const copyReadyPreviewRef = useRef<{
		content: string
		iframe: HTMLIFrameElement
	} | null>(null)
	const articleScrollTopsRef = useRef(new Map<string, number>())
	const userSelectedRenderModeRef = useRef(false)
	const renderedContent = useMemo(() => {
		if (!content) return null
		return appendWechatArticleCommentsHtml({
			html: content,
			post,
			commentsTitle: t("detail.selfMedia.platform.wechat-official-accounts.commentsTotal", {
				count: Number(post.meta.commentCount || post.meta.comments?.length || 0),
				defaultValue: "精选评论 {{count}}",
			}),
			commentsSourceLabel: t(
				"detail.selfMedia.platform.wechat-official-accounts.commentsFromPost",
				"来自评论区",
			),
			unknownAuthor: t("detail.selfMedia.common.unknownAuthor"),
		})
	}, [content, post, t])

	useImperativeHandle(
		ref,
		() => ({
			getIframeElement: () => rendererRef.current?.getIframeElement() ?? null,
			getArticleHtml: async () =>
				buildWechatClipboardHtmlFromIframe(rendererRef.current?.getIframeElement()) ||
				(content ? await buildWechatClipboardHtmlFromSource(content) : null),
			copyArticleRichContent: () => {
				const iframe = rendererRef.current?.getIframeElement() ?? null
				if (
					!renderedContent ||
					!iframe ||
					copyReadyPreviewRef.current?.content !== renderedContent ||
					copyReadyPreviewRef.current.iframe !== iframe
				) {
					return false
				}
				return copyWechatArticleSelectionSynchronously(iframe)
			},
			startInspector: () => rendererRef.current?.startInspectorAppend(),
			startInspectorAppend: () => rendererRef.current?.startInspectorAppend(),
			stopInspector: () => rendererRef.current?.stopInspector(),
		}),
		[content, renderedContent],
	)

	// Keep a ref so the effect can read the latest attachmentList without
	// treating reference changes as a reason to re-fetch the HTML content.
	const attachmentListRef = useRef(attachmentList)
	attachmentListRef.current = attachmentList
	const attachmentsRef = useRef(attachments)
	attachmentsRef.current = attachments

	// Derive a stable version key from the target file's updated_at so that
	// the effect re-runs when the file content actually changes (same fileId
	// but new content) without triggering on every attachmentList reference swap.
	const fileUpdatedAt = fileId
		? [attachmentList, attachments]
				.flatMap((source) => flattenAttachments(source ?? []))
				.find((item): item is FileItem => item?.file_id === fileId)?.updated_at
		: undefined
	const articleRenderToken = useMemo(
		() => [fileId, fileUpdatedAt, renderedContent, renderMode] as const,
		[fileId, fileUpdatedAt, renderedContent, renderMode],
	)
	const restoredRenderTokenRef = useRef<typeof articleRenderToken | null>(null)

	useEffect(() => {
		let cancelled = false
		if (!fileId) {
			setContent(null)
			setError(null)
			return
		}
		setLoading(true)
		setError(null)
		setContent(null)
		;(async () => {
			try {
				const result = await loadWechatArticleHtml({
					fileId,
					attachmentList: attachmentListRef.current,
					attachments: attachmentsRef.current,
					fileApi,
				})
				if (cancelled) return
				setContent(result.content)
				setFilePathMapping(result.filePathMapping)
			} catch (err) {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "unknownError")
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [fileApi, fileId, fileUpdatedAt]) // attachmentList intentionally omitted: reference changes on every file-tree update; fileUpdatedAt tracks actual content changes

	useEffect(() => {
		if (!fileId || !renderedContent || renderMode !== "desktop") return undefined
		const iframe = rendererRef.current?.getIframeElement() ?? null
		const win = getSafeIframeWindow(iframe)
		if (!iframe || !win) return undefined

		const rememberScrollTop = () => {
			articleScrollTopsRef.current.set(fileId, getIframeScrollTop(iframe))
		}
		let removeWindowScrollListener: (() => void) | undefined
		let removeDocumentScrollListener: (() => void) | undefined

		try {
			win.addEventListener("scroll", rememberScrollTop, { passive: true })
			removeWindowScrollListener = () => {
				try {
					win.removeEventListener("scroll", rememberScrollTop)
				} catch {
					// Iframe may have navigated cross-origin before React cleanup runs.
				}
			}
		} catch {
			removeWindowScrollListener = undefined
		}

		const doc = getSafeIframeDocument(iframe)
		try {
			doc?.addEventListener("scroll", rememberScrollTop, { passive: true })
			if (doc) {
				removeDocumentScrollListener = () => {
					try {
						doc.removeEventListener("scroll", rememberScrollTop)
					} catch {
						// Iframe document access is best-effort across sandbox modes.
					}
				}
			}
		} catch {
			removeDocumentScrollListener = undefined
		}

		if (!removeWindowScrollListener && !removeDocumentScrollListener) return undefined

		return () => {
			rememberScrollTop()
			removeWindowScrollListener?.()
			removeDocumentScrollListener?.()
		}
	}, [fileId, renderedContent, renderMode])

	const handleRenderReady = useCallback(() => {
		const iframe = rendererRef.current?.getIframeElement() ?? null
		copyReadyPreviewRef.current =
			renderedContent && iframe ? { content: renderedContent, iframe } : null
		if (!fileId || renderMode !== "desktop") return
		if (restoredRenderTokenRef.current === articleRenderToken) return
		restoredRenderTokenRef.current = articleRenderToken
		const scrollTop = articleScrollTopsRef.current.get(fileId) ?? 0
		if (scrollTop <= 0) return
		window.requestAnimationFrame(() => {
			restoreIframeScrollTop(rendererRef.current?.getIframeElement() ?? null, scrollTop)
		})
	}, [articleRenderToken, fileId, renderMode, renderedContent])

	const openNewTab = useCallback(() => {
		// No-op in read-only context
	}, [])
	const handleChangeRenderMode = useCallback((nextMode: WechatArticleRenderMode) => {
		userSelectedRenderModeRef.current = true
		setRenderMode(nextMode)
	}, [])

	useEffect(() => {
		if (!isMobile || userSelectedRenderModeRef.current) return
		setRenderMode("phone")
	}, [isMobile])

	if (!fileId) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-article-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-article-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="wechat-article-error"
			>
				{error}
			</div>
		)
	}
	if (!content || !renderedContent) return null

	const readOnly = allowEdit === false
	const hasActions = (!readOnly && onAddToCurrentChat) || (!readOnly && onGoToEdit) || onRefresh
	const modeActions = [
		{
			value: "desktop",
			label: t(
				"detail.selfMedia.platform.wechat-official-accounts.articleModes.desktop",
				"原文",
			),
			icon: FileText,
		},
		{
			value: "phone",
			label: t(
				"detail.selfMedia.platform.wechat-official-accounts.articleModes.phone",
				"手机预览",
			),
			icon: Smartphone,
		},
	]

	return (
		<div className="relative h-full w-full bg-white" data-testid="wechat-article-view">
			{renderMode === "desktop" ? (
				<div
					className="h-full w-full duration-300 ease-out animate-in fade-in-0 zoom-in-95"
					data-testid="wechat-article-desktop-frame"
				>
					<IsolatedHTMLRenderer
						ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
						content={renderedContent}
						sandboxType="iframe"
						fileId={fileId}
						filePathMapping={filePathMapping}
						openNewTab={openNewTab}
						selectedProject={selectedProject}
						attachmentList={attachmentList}
						isVisible
						className="h-full w-full"
						onInspectorActiveChange={onInspectorActiveChange}
						onRenderReady={handleRenderReady}
						enableInlineInspectorFallback
					/>
				</div>
			) : (
				<WechatArticlePhonePreview post={post} renderedContent={renderedContent} />
			)}
			{(modeActions.length || hasActions) && (
				<CardActionStrip
					className="absolute right-10 top-6 z-10"
					testId="wechat-article-floating-actions"
					testIdPrefix="wechat-article-action"
					tooltipSide="left"
					allowEdit={allowEdit}
					onAddToCurrentChat={onAddToCurrentChat}
					onGoToEdit={onGoToEdit}
					onRefresh={onRefresh}
					customActions={modeActions.map((option) => ({
						key: option.value,
						label: option.label,
						icon: option.icon,
						active: renderMode === option.value,
						onClick: () =>
							handleChangeRenderMode(option.value as WechatArticleRenderMode),
						testId: `wechat-article-mode-${option.value}`,
					}))}
					labels={{
						addToCurrentChat: t("detail.selfMedia.edit.addArticleFileToChat"),
						goToEdit: t("detail.selfMedia.edit.goToArticleEdit"),
						refresh: t("detail.selfMedia.edit.refreshArticle"),
					}}
				/>
			)}
		</div>
	)
}

const WechatArticleView = memo(
	forwardRef<WechatArticleViewRef, WechatArticleViewProps>(WechatArticleViewInner),
)
export default WechatArticleView
