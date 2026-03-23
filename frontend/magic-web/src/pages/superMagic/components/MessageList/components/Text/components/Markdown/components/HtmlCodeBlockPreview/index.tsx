import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/utils"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "./constants"
import { HtmlCodeBlockDesktopPreview } from "./components/HtmlCodeBlockDesktopPreview"
import { HtmlCodeBlockPreviewCodeView } from "./components/HtmlCodeBlockPreviewCodeView"
import { HtmlCodeBlockPreviewHeader } from "./components/HtmlCodeBlockPreviewHeader"
import { useHtmlCodeBlockPreviewAvailableWidth } from "./hooks/useHtmlCodeBlockPreviewAvailableWidth"
import { useHtmlCodeBlockPreviewCopy } from "./hooks/useHtmlCodeBlockPreviewCopy"
import { useHtmlCodeBlockPreviewStreamingScroll } from "./hooks/useHtmlCodeBlockPreviewStreamingScroll"
import type { HtmlCodeBlockPreviewMode, HtmlCodeBlockPreviewProps } from "./types"
import { extractCodeBlockInfo, isHtmlCodeLanguage, resolveHtmlPreviewCode } from "./utils"

function HtmlCodeBlockPreview(props: HtmlCodeBlockPreviewProps) {
	const {
		children,
		className: preClassName,
		isStreaming = false,
		fullCode,
		streamingScrollStateRef,
		...preProps
	} = props
	const { t } = useTranslation("super")
	const { t: tInterface } = useTranslation("interface")
	const htmlIconId = useId()
	const [viewMode, setViewMode] = useState<HtmlCodeBlockPreviewMode>("code")
	const [isExpanded, setIsExpanded] = useState(true)
	const [isPreviewLoading, setIsPreviewLoading] = useState(false)
	const [previewCardWidth, setPreviewCardWidth] = useState<number | null>(null)
	const [hasOpenedDesktopPreview, setHasOpenedDesktopPreview] = useState(false)
	const [hasDesktopPreviewRendered, setHasDesktopPreviewRendered] = useState(false)
	const previewLoadingStartedAtRef = useRef(0)
	const previewLoadingTimerRef = useRef<number | null>(null)
	const { setPreviewLayoutElement, previewAvailableWidth } =
		useHtmlCodeBlockPreviewAvailableWidth()
	const { isCopied, copyHtmlCode } = useHtmlCodeBlockPreviewCopy({
		onCopySuccess: () => magicToast.success(t("common.copySuccess")),
		onCopyFailed: () => magicToast.error(t("common.copyFailed")),
	})

	const codeBlockInfo = useMemo(() => {
		try {
			return extractCodeBlockInfo(children)
		} catch {
			return null
		}
	}, [children])

	const previewCode = useMemo(() => {
		try {
			return resolveHtmlPreviewCode(codeBlockInfo)
		} catch {
			return undefined
		}
	}, [codeBlockInfo])

	const isHtmlCodeBlock = Boolean(previewCode)
	const resolvedCode = fullCode ?? previewCode ?? ""
	const hasResolvedCode = resolvedCode.trim().length > 0
	const hasCompletedFence = Boolean(fullCode)
	const codeDisplayContent =
		codeBlockInfo && isHtmlCodeLanguage(codeBlockInfo.className)
			? codeBlockInfo.code
			: (previewCode ?? codeBlockInfo?.code ?? "")
	const { setScrollAreaElement } = useHtmlCodeBlockPreviewStreamingScroll({
		isStreaming,
		hasCompletedFence,
		codeContent: codeDisplayContent,
		streamingScrollStateRef,
	})

	useEffect(() => {
		return () => {
			if (previewLoadingTimerRef.current) window.clearTimeout(previewLoadingTimerRef.current)
		}
	}, [])

	useEffect(() => {
		if (isStreaming) {
			setViewMode("code")
			setPreviewCardWidth(null)
			setIsPreviewLoading(false)

			if (previewLoadingTimerRef.current) {
				window.clearTimeout(previewLoadingTimerRef.current)
				previewLoadingTimerRef.current = null
			}
		}
	}, [isStreaming])

	useEffect(() => {
		if (viewMode !== "desktop") setPreviewCardWidth(null)
	}, [viewMode, resolvedCode])

	useEffect(() => {
		setHasDesktopPreviewRendered(false)
	}, [resolvedCode])

	useEffect(() => {
		if (viewMode === "desktop") {
			if (hasDesktopPreviewRendered) {
				setIsPreviewLoading(false)
				return
			}

			if (previewLoadingTimerRef.current) {
				window.clearTimeout(previewLoadingTimerRef.current)
				previewLoadingTimerRef.current = null
			}

			previewLoadingStartedAtRef.current = Date.now()
			setIsPreviewLoading(true)
			return
		}

		if (previewLoadingTimerRef.current) {
			window.clearTimeout(previewLoadingTimerRef.current)
			previewLoadingTimerRef.current = null
		}

		setIsPreviewLoading(false)
	}, [hasDesktopPreviewRendered, resolvedCode, viewMode])

	const handlePreviewRenderReady = useCallback(() => {
		const elapsed = Date.now() - previewLoadingStartedAtRef.current
		const remainingDuration = Math.max(
			0,
			HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION - elapsed,
		)

		if (previewLoadingTimerRef.current) {
			window.clearTimeout(previewLoadingTimerRef.current)
			previewLoadingTimerRef.current = null
		}

		if (remainingDuration === 0) {
			setHasDesktopPreviewRendered(true)
			setIsPreviewLoading(false)
			return
		}

		previewLoadingTimerRef.current = window.setTimeout(() => {
			setHasDesktopPreviewRendered(true)
			setIsPreviewLoading(false)
			previewLoadingTimerRef.current = null
		}, remainingDuration)
	}, [])

	const handleSuggestedCardWidthChange = useCallback((nextWidth: number | null) => {
		setPreviewCardWidth((previousWidth) => {
			if (typeof nextWidth === "number" && Number.isFinite(nextWidth) && nextWidth > 0) {
				return previousWidth === nextWidth ? previousWidth : nextWidth
			}

			return previousWidth === null ? previousWidth : null
		})
	}, [])

	if (!codeBlockInfo || !isHtmlCodeBlock) {
		return (
			<pre className={preClassName} {...preProps}>
				{children}
			</pre>
		)
	}

	const copyLabel = tInterface("chat.markdown.copy", "复制")
	const copySuccessLabel = t("common.copySuccess", "复制成功")
	const codeModeLabel = t("fileViewer.codeMode")
	const previewModeLabel = t("ui.preview")
	const htmlSnippetLabel = tInterface("chat.markdown.htmlSnippet", "HTML 片段")
	const shouldRenderCopyButton = !isStreaming && hasResolvedCode
	const shouldRenderViewModeSwitcher = !isStreaming && hasResolvedCode

	async function handleCopy() {
		await copyHtmlCode(resolvedCode)
	}

	function handleViewModeChange(mode: string) {
		if (mode === "code" || mode === "desktop") {
			if (mode === "desktop") setHasOpenedDesktopPreview(true)
			setViewMode(mode)
			setIsExpanded(true)
		}
	}

	function handleToggleExpanded() {
		setIsExpanded((currentExpanded) => !currentExpanded)
	}

	const shouldRenderCodeView = isStreaming || viewMode === "code"
	const shouldKeepDesktopPreviewMounted =
		!isStreaming && (viewMode === "desktop" || hasOpenedDesktopPreview)

	return (
		<div
			ref={setPreviewLayoutElement}
			className="my-3 w-full min-w-0 self-stretch"
			data-testid="html-code-block-preview"
		>
			<div
				className="overflow-hidden rounded-md border border-input/90 bg-background p-1.5 shadow-xs transition-[width] duration-200 ease-out"
				style={{
					width:
						viewMode === "desktop" && previewCardWidth
							? `${previewCardWidth}px`
							: "100%",
				}}
			>
				<HtmlCodeBlockPreviewHeader
					htmlIconId={htmlIconId}
					htmlSnippetLabel={htmlSnippetLabel}
					codeModeLabel={codeModeLabel}
					previewModeLabel={previewModeLabel}
					copyLabel={copyLabel}
					copySuccessLabel={copySuccessLabel}
					viewMode={viewMode}
					isExpanded={isExpanded}
					isCopied={isCopied}
					shouldRenderCopyButton={shouldRenderCopyButton}
					shouldRenderViewModeSwitcher={shouldRenderViewModeSwitcher}
					onCopy={handleCopy}
					onToggleExpanded={handleToggleExpanded}
					onViewModeChange={handleViewModeChange}
				/>

				<div
					className={cn(
						"grid transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out",
						isExpanded
							? "mt-1.5 grid-rows-[1fr] opacity-100"
							: "mt-0 grid-rows-[0fr] opacity-0",
					)}
					data-testid="html-code-block-preview-collapse"
				>
					<div className="min-h-0 overflow-hidden">
						{shouldRenderCodeView && (
							<HtmlCodeBlockPreviewCodeView
								preClassName={preClassName}
								preProps={preProps}
								codeClassName={codeBlockInfo.className}
								codeDisplayContent={codeDisplayContent}
								scrollAreaRef={setScrollAreaElement}
							/>
						)}
						{shouldKeepDesktopPreviewMounted && (
							<div className={cn(viewMode === "desktop" ? "block" : "hidden")}>
								<HtmlCodeBlockDesktopPreview
									resolvedCode={resolvedCode}
									isPreviewLoading={isPreviewLoading}
									onPreviewRenderReady={handlePreviewRenderReady}
									availableWidth={previewAvailableWidth}
									onSuggestedCardWidthChange={handleSuggestedCardWidthChange}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default memo(HtmlCodeBlockPreview)
