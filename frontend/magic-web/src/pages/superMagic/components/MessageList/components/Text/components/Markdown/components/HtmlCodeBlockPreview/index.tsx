import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import {
	HTML_CODE_BLOCK_PREVIEW_PHONE_CARD_CHROME_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH,
} from "./constants"
import { HtmlPreviewSwitcher } from "./HtmlPreviewSwitcher"
import { HtmlCodeBlockPreviewCodeView } from "./components/HtmlCodeBlockPreviewCodeView"
import { HtmlCodeBlockPreviewHeader } from "./components/HtmlCodeBlockPreviewHeader"
import { useHtmlCodeBlockPreviewAvailableWidth } from "./hooks/useHtmlCodeBlockPreviewAvailableWidth"
import { useHtmlCodeBlockPreviewController } from "./hooks/useHtmlCodeBlockPreviewController"
import { useHtmlCodeBlockPreviewCopy } from "./hooks/useHtmlCodeBlockPreviewCopy"
import { useHtmlCodeBlockPreviewExpandAutoScroll } from "./hooks/useHtmlCodeBlockPreviewExpandAutoScroll"
import { useHtmlCodeBlockPreviewStreamingScroll } from "./hooks/useHtmlCodeBlockPreviewStreamingScroll"
import { hasVisibleHtmlPreviewContent } from "./shared"
import type { HtmlCodeBlockPreviewProps } from "./types"
import { resolveHtmlPreviewIntrinsicWidthHint } from "./preview-width"

function HtmlCodeBlockPreview(props: HtmlCodeBlockPreviewProps) {
	const {
		className: preClassName,
		isStreaming = false,
		isSuspended = false,
		codeBlockInfo,
		previewCode,
		fullCode,
		streamingScrollStateRef,
		...preProps
	} = props
	const { t } = useTranslation("super")
	const { t: tInterface } = useTranslation("interface")
	const isMobile = useIsMobile()
	const htmlIconId = useId()
	const phonePreviewSurfaceElementRef = useRef<HTMLDivElement | null>(null)
	const desktopPreviewSurfaceElementRef = useRef<HTMLDivElement | null>(null)
	const { setPreviewLayoutElement, previewAvailableWidth } =
		useHtmlCodeBlockPreviewAvailableWidth()
	const { isCopied, copyHtmlCode } = useHtmlCodeBlockPreviewCopy({
		onCopySuccess: () => magicToast.success(t("common.copySuccess")),
		onCopyFailed: () => magicToast.error(t("common.copyFailed")),
	})

	const resolvedCode = fullCode ?? previewCode ?? ""
	const latestCommittedStreamingCodeRef = useRef(resolvedCode)
	const [frozenResolvedCode, setFrozenResolvedCode] = useState<string | null>(null)
	const effectiveResolvedCode = frozenResolvedCode ?? resolvedCode
	const intrinsicPreviewWidthHint = useMemo(
		() => resolveHtmlPreviewIntrinsicWidthHint(effectiveResolvedCode),
		[effectiveResolvedCode],
	)
	const hasResolvedCode = effectiveResolvedCode.trim().length > 0
	const hasVisiblePreviewContent = useMemo(
		() =>
			// 这条可见性判断只影响完成态卡片的展示策略；
			// 流式阶段先沿用现有预览行为，避免每个 chunk 都重复做 DOMParser 解析。
			isStreaming ? true : hasVisibleHtmlPreviewContent(effectiveResolvedCode),
		[effectiveResolvedCode, isStreaming],
	)
	const hasCompletedFence = Boolean(fullCode)
	const codeDisplayContent = codeBlockInfo.code
	const { setScrollAreaElement } = useHtmlCodeBlockPreviewStreamingScroll({
		isStreaming,
		hasCompletedFence,
		codeContent: codeDisplayContent,
		streamingScrollStateRef,
	})
	const {
		viewMode,
		isExpanded,
		isPreviewLoading,
		shouldAnimatePreviewCardWidth,
		phonePreviewCardWidth,
		previewRenderKey,
		mountedPreviewLayouts,
		shouldRenderCodeView,
		shouldRenderPreview,
		activePreviewLayout,
		handlePreviewRenderReady,
		handleSuggestedCardWidthChange,
		handleViewModeChange,
		handleToggleExpanded,
	} = useHtmlCodeBlockPreviewController({
		isStreaming,
		hasResolvedCode,
		hasVisiblePreviewContent,
	})
	const getScrollTargetElement = useCallback(() => {
		if (viewMode === "desktop") return desktopPreviewSurfaceElementRef.current
		if (viewMode === "phone") return phonePreviewSurfaceElementRef.current

		return null
	}, [viewMode])
	const { setPreviewCardElement } = useHtmlCodeBlockPreviewExpandAutoScroll({
		isExpanded,
		viewMode,
		getScrollTargetElement,
	})

	const copyLabel = tInterface("chat.markdown.copy", "复制")
	const copySuccessLabel = t("common.copySuccess", "复制成功")
	const codeModeLabel = t("fileViewer.codeMode")
	const desktopModeLabel = t("fileViewer.desktopMode")
	const phoneModeLabel = t("fileViewer.phoneMode")
	const fullscreenLabel = t("fileViewer.fullscreen", "全屏")
	const htmlSnippetLabel = tInterface("chat.markdown.htmlSnippet", "HTML 片段")
	const shouldRenderCopyButton = !isStreaming && hasResolvedCode
	// 全屏按钮
	const shouldRenderFullscreenButton = !isStreaming && hasResolvedCode && hasVisiblePreviewContent
	const shouldRenderViewModeSwitcher = hasResolvedCode && hasVisiblePreviewContent
	// 非渲染标签场景下默认只保留 header；只有用户明确展开源码时，才展示下方内容区。
	const effectiveIsExpanded = hasVisiblePreviewContent || viewMode === "code" ? isExpanded : false

	async function handleCopy() {
		await copyHtmlCode(effectiveResolvedCode)
	}

	// 记录流式预览真正提交到 iframe 的最后一版内容，供暂停时冻结使用。
	const handleStreamingCommittedContentChange = useCallback((nextContent: string) => {
		latestCommittedStreamingCodeRef.current = nextContent
	}, [])

	useEffect(() => {
		if (!isSuspended) {
			setFrozenResolvedCode(null)
			return
		}

		// 服务端暂停后，冻结为“已经提交到预览 iframe 的最后一版内容”，
		// 避免父层退出流式态后又回退到上游仍在变化的 resolvedCode。
		setFrozenResolvedCode((previousCode) => {
			if (previousCode !== null) return previousCode
			return latestCommittedStreamingCodeRef.current || resolvedCode
		})
	}, [isSuspended, resolvedCode])

	// 将消息中的 HTML 片段包装成临时文件，直接复用右侧 FilesViewer 的打开链路。
	const previewFileId = useMemo(
		() => `message-html-preview-${htmlIconId.replaceAll(":", "")}`,
		[htmlIconId],
	)
	const previewFileName = `${htmlSnippetLabel}.html`

	// 全屏按钮不在消息列表内放大，而是打开右侧详情区的 HTML 预览。
	const handleOpenInFilesViewer = useCallback(() => {
		openMessageFile(
			{
				file_id: previewFileId,
				file_name: previewFileName,
				display_filename: previewFileName,
				file_extension: "html",
				content: effectiveResolvedCode,
				display_config: {
					type: "webapp",
					name: htmlSnippetLabel,
					previewPolicy: {
						temporary: true,
						persistTab: false,
						syncWithAttachments: false,
						keepLocalContent: true,
						restoreAsActive: false,
						readonly: true,
					},
				},
			},
			{ locateInTree: false },
		)
	}, [effectiveResolvedCode, htmlSnippetLabel, previewFileId, previewFileName])

	const isPhoneViewMode = viewMode === "phone"
	const phonePreviewViewportWidthHint =
		phonePreviewCardWidth ??
		(previewAvailableWidth > 0
			? Math.min(
					previewAvailableWidth,
					intrinsicPreviewWidthHint ?? HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH,
				)
			: HTML_CODE_BLOCK_PREVIEW_PHONE_VIEWPORT_WIDTH)
	// 手机预览卡片宽度始终受消息面板约束，避免通过 minWidth 把外层撑出横向滚动。
	const desiredPhoneCardWidth = isPhoneViewMode ? phonePreviewViewportWidthHint : null
	const desiredPhoneCardOuterWidth =
		isPhoneViewMode && desiredPhoneCardWidth
			? desiredPhoneCardWidth +
				Math.min(
					HTML_CODE_BLOCK_PREVIEW_PHONE_CARD_CHROME_WIDTH,
					Math.max(0, previewAvailableWidth - desiredPhoneCardWidth),
				)
			: null
	const effectivePhoneCardOuterWidth =
		isPhoneViewMode && desiredPhoneCardOuterWidth
			? previewAvailableWidth > 0
				? Math.min(desiredPhoneCardOuterWidth, previewAvailableWidth)
				: desiredPhoneCardOuterWidth
			: null

	return (
		<div
			ref={setPreviewLayoutElement}
			className="my-3 w-full min-w-0 self-stretch"
			data-testid="html-code-block-preview"
		>
			<div
				ref={setPreviewCardElement}
				className={cn(
					"overflow-hidden rounded-md border border-input/90 bg-background p-1.5 shadow-xs",
					shouldAnimatePreviewCardWidth && "transition-[width] duration-200 ease-out",
					"mr-auto",
				)}
				data-testid="html-code-block-preview-card"
				style={{
					width:
						isPhoneViewMode && effectivePhoneCardOuterWidth
							? `${effectivePhoneCardOuterWidth}px`
							: undefined,
					maxWidth: "100%",
				}}
			>
				<div>
					<HtmlCodeBlockPreviewHeader
						htmlIconId={htmlIconId}
						htmlSnippetLabel={htmlSnippetLabel}
						codeModeLabel={codeModeLabel}
						desktopModeLabel={desktopModeLabel}
						phoneModeLabel={phoneModeLabel}
						copyLabel={copyLabel}
						copySuccessLabel={copySuccessLabel}
						fullscreenLabel={fullscreenLabel}
						viewMode={viewMode}
						isExpanded={effectiveIsExpanded}
						isCopied={isCopied}
						shouldRenderCopyButton={shouldRenderCopyButton}
						shouldRenderFullscreenButton={shouldRenderFullscreenButton}
						shouldRenderViewModeSwitcher={shouldRenderViewModeSwitcher}
						// 移动端消息预览只保留手机视图入口，不再展示 PC 预览按钮。
						shouldRenderDesktopModeButton={!isStreaming && !isMobile}
						onCopy={handleCopy}
						onOpenFullscreen={handleOpenInFilesViewer}
						onToggleExpanded={handleToggleExpanded}
						onViewModeChange={handleViewModeChange}
					/>
				</div>

				<div
					className={cn(
						"grid transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out",
						effectiveIsExpanded
							? "mt-1.5 grid-rows-[1fr] opacity-100"
							: "mt-0 grid-rows-[0fr] opacity-0",
					)}
					data-testid="html-code-block-preview-collapse"
				>
					<div className="min-h-0 overflow-hidden">
						{effectiveIsExpanded && shouldRenderCodeView && (
							<HtmlCodeBlockPreviewCodeView
								preClassName={preClassName}
								preProps={preProps}
								codeClassName={codeBlockInfo.className}
								codeDisplayContent={codeDisplayContent}
								scrollAreaRef={setScrollAreaElement}
							/>
						)}
						{effectiveIsExpanded &&
							hasVisiblePreviewContent &&
							shouldRenderPreview &&
							(isStreaming ? (
								<div
									ref={phonePreviewSurfaceElementRef}
									data-testid="html-code-block-preview-phone-surface"
								>
									<HtmlPreviewSwitcher
										key={previewRenderKey}
										isStreaming
										isSuspended={isSuspended}
										resolvedCode={effectiveResolvedCode}
										isPreviewLoading={isPreviewLoading}
										onPreviewRenderReady={() =>
											handlePreviewRenderReady("phone")
										}
										onCommittedContentChange={
											handleStreamingCommittedContentChange
										}
										availableWidth={previewAvailableWidth}
										onSuggestedCardWidthChange={handleSuggestedCardWidthChange}
										previewLayout="phone"
									/>
								</div>
							) : (
								<div className="relative min-h-0">
									{mountedPreviewLayouts.phone && (
										<div
											ref={
												activePreviewLayout === "phone"
													? phonePreviewSurfaceElementRef
													: null
											}
											className={cn(
												activePreviewLayout === "phone"
													? "relative"
													: "pointer-events-none invisible absolute inset-0",
											)}
											aria-hidden={activePreviewLayout !== "phone"}
											data-testid="html-code-block-preview-phone-surface"
										>
											<HtmlPreviewSwitcher
												key={`phone-${previewRenderKey}`}
												isStreaming={false}
												resolvedCode={effectiveResolvedCode}
												isPreviewLoading={
													activePreviewLayout === "phone"
														? isPreviewLoading
														: false
												}
												onPreviewRenderReady={() =>
													handlePreviewRenderReady("phone")
												}
												availableWidth={previewAvailableWidth}
												onSuggestedCardWidthChange={
													handleSuggestedCardWidthChange
												}
												previewLayout="phone"
											/>
										</div>
									)}
									{mountedPreviewLayouts.desktop && (
										<div
											ref={
												activePreviewLayout === "desktop"
													? desktopPreviewSurfaceElementRef
													: null
											}
											className={cn(
												activePreviewLayout === "desktop"
													? "relative"
													: "pointer-events-none invisible absolute inset-0",
											)}
											aria-hidden={activePreviewLayout !== "desktop"}
											data-testid="html-code-block-preview-desktop-surface"
										>
											<HtmlPreviewSwitcher
												key={`desktop-${previewRenderKey}`}
												isStreaming={false}
												resolvedCode={effectiveResolvedCode}
												isPreviewLoading={
													activePreviewLayout === "desktop"
														? isPreviewLoading
														: false
												}
												onPreviewRenderReady={() =>
													handlePreviewRenderReady("desktop")
												}
												availableWidth={previewAvailableWidth}
												initialDesktopViewportWidth={
													phonePreviewViewportWidthHint
												}
												onSuggestedCardWidthChange={
													handleSuggestedCardWidthChange
												}
												previewLayout="desktop"
											/>
										</div>
									)}
								</div>
							))}
					</div>
				</div>
			</div>
		</div>
	)
}

export default memo(HtmlCodeBlockPreview)
