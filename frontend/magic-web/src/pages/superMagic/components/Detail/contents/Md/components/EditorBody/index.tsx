import type { AttachmentItem } from "../../../../../TopicFilesButton/hooks/types"
import { createMarkdownSourceLocation } from "./extensions/markdown-source-location"
import type { SourceReplacement } from "./source-location"
import { memo, useEffect, useMemo, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import EditorErrorBoundary from "./components/EditorErrorBoundary"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/types"
import { useProjectImageExtensions } from "@/components/tiptap-templates/simple/hooks"
import { useCustomLinkNode } from "./hooks/useCustomLinkNode"
import CodeSourceEditor from "./components/CodeSourceEditor"
import { formatLongCurlDataRawForPreview } from "./components/CodeSourceEditor/preview-content"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { isExternalUrl, type AttachmentFile } from "../../utils"
import { parseAnchorLink, scrollToAnchor } from "@/utils/slug"
import { Editor } from "@/infrastructure/editors/tiptap/react"
import type { ProjectImageUrlResolver } from "@/components/tiptap-node/project-image-node/project-image-node-extension"
import { SafeHtmlDiv, SafeHtmlSpan, SafeHtmlTextBlockStyles } from "./extensions/safe-html-style"
import { SafeVideo } from "./extensions/safe-video"
import LargeMarkdownPreview from "./components/LargeMarkdownPreview"
import { isLargeMarkdownContent } from "./largeMarkdown"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { isMarkdownFileLink } from "@/pages/superMagic/utils/markdownFileReference"
import { useMarkdownFileLinks } from "./hooks/useMarkdownFileLinks"
import { MarkdownFileLinkContext } from "./components/MarkdownFileLink"

interface EditorBodyProps {
	allowDownload?: boolean
	selectionRootRef?: React.Ref<HTMLDivElement>
	enableSourceLocation?: boolean
	isLoading: boolean
	/** Keeps pure-share loading in the page-level overlay instead of rendering a second spinner. */
	suppressLoadingIndicator?: boolean
	/** Lets the markdown editor contribute its full height to the page scroll range. */
	documentFlowFullscreen?: boolean
	/** Cached file tabs pass their visibility down so global search is active only on the visible tab. */
	isTabActive?: boolean
	/** Disable interactive search for temporary offscreen export renders. */
	enableSearch?: boolean
	viewMode: "code" | "desktop" | "phone" | "markdown"
	language?: string
	content: string
	processedContent?: string
	className?: string
	isEditMode?: boolean
	editContent?: string
	setEditContent?: (content: string) => void
	selectedProject?: ProjectListItem | null
	currentDocumentPath?: string
	urlResolver?: ProjectImageUrlResolver
	folderPath?: string
	onImageUploadSuccess?: (relativePath: string) => void | Promise<void>
	onImageUploadError?: (error: Error) => void
	editorRef?: React.RefObject<SimpleEditorRef>
	placeholder?: string
	attachments?: AttachmentFile[]
	onOpenFile?: (fileItem: { file_id: string }) => void
	resolveRelativeFile?: (href: string) => Promise<AttachmentItem | undefined>
	onSave?: (editor: Editor | null) => void
	"data-testid"?: string
	/**
	 * Async callback to resolve or create the images folder before upload.
	 * Should return the file_id of the images folder. Recording callers can set
	 * requireImagesFolderParentId to fail instead of falling back to the project root.
	 */
	resolveImagesFolderParentId?: (folderPath: string) => Promise<string | undefined>
	requireImagesFolderParentId?: boolean
}

function EditorBody({
	allowDownload,
	selectionRootRef,
	enableSourceLocation = false,
	isLoading,
	suppressLoadingIndicator = false,
	documentFlowFullscreen = false,
	isTabActive = true,
	enableSearch = true,
	viewMode,
	language = "text",
	content,
	processedContent,
	className = "",
	isEditMode,
	editContent,
	setEditContent,
	selectedProject,
	currentDocumentPath,
	folderPath,
	urlResolver,
	onImageUploadSuccess,
	onImageUploadError,
	editorRef,
	placeholder,
	attachments,
	onOpenFile,
	resolveRelativeFile,
	onSave,
	"data-testid": dataTestId,
	resolveImagesFolderParentId,
	requireImagesFolderParentId,
}: EditorBodyProps) {
	const { t } = useTranslation("super")
	const resolveLinkedFile = useMarkdownFileLinks({
		documentPath: currentDocumentPath,
		attachments,
		resolveRelativeFile,
		projectId: selectedProject?.id,
		enabled: isTabActive,
	})
	const fileLinkContext = useMemo(
		() => ({
			resolveLinkedFile,
			projectId: selectedProject?.id,
			active: isTabActive && !isEditMode,
			allowDownload,
		}),
		[resolveLinkedFile, selectedProject?.id, isTabActive, isEditMode, allowDownload],
	)
	const linkRequestRef = useRef(0)
	// 缓存标签切换、文档／空间变化和卸载后，旧异步结果不再打开文件或提示失败。
	useEffect(
		() => () => {
			linkRequestRef.current += 1
		},
		[
			currentDocumentPath,
			resolveRelativeFile,
			selectedProject?.id,
			isTabActive,
			resolveLinkedFile,
		],
	)
	const showLinkError = (href: string) =>
		magicToast.error(t("common.fileCannotOpen", { path: href }))
	// Use project image extensions hook
	const projectImageExtensions = useProjectImageExtensions({
		projectId: selectedProject?.id,
		documentPath: currentDocumentPath,
		folderPath,
		urlResolver,
		onSuccess: onImageUploadSuccess,
		onError: onImageUploadError,
		resolveImagesFolderParentId,
		requireImagesFolderParentId,
	})

	// Handle link click: open external URLs in new tab, or open relative files in tab
	// Also supports anchor navigation within documents
	const handleLinkClick = useMemoizedFn(
		(_event: MouseEvent, href: string, _element: HTMLAnchorElement, anchor?: string) => {
			// Parse anchor from href if not provided
			const { filePath, anchor: parsedAnchor } = parseAnchorLink(href)
			const anchorId = anchor || parsedAnchor

			// Handle pure anchor link (e.g., #heading)
			if (!filePath && anchorId) {
				// Scroll to anchor in current document
				scrollToAnchor(anchorId, 80) // 80px offset for fixed headers
				return true
			}

			// Check if it's an external URL
			if (isExternalUrl(filePath)) {
				// Open external URL in new tab
				// Browser will handle anchor navigation automatically
				window.open(href, "_blank", "noopener,noreferrer")
				return true
			}

			// 网页路由与应用协议保持原语义；文件未匹配不能借此退回网页。
			if (!isMarkdownFileLink(href)) return !href.trim()
			if (!isTabActive) return true
			const requestId = ++linkRequestRef.current

			if (onOpenFile) {
				void resolveLinkedFile(filePath)
					.then((file) => {
						if (requestId !== linkRequestRef.current) return
						if (!file?.file_id) {
							showLinkError(href)
							return
						}
						// Open file in tab
						onOpenFile({ ...file, file_id: file.file_id })
						// If there's an anchor, scroll to it after document loads
						if (!resolveRelativeFile && anchorId) {
							// Wait for document to render before scrolling
							setTimeout(() => {
								scrollToAnchor(anchorId, 80)
							}, 1000) // Adjust delay as needed
						}
					})
					.catch((error: unknown) => {
						if (requestId !== linkRequestRef.current) return
						if (error instanceof Error && error.name === "AbortError") return
						showLinkError(href)
					})
				return true
			}

			// If file not found or no handler, prevent default
			showLinkError(href)
			return true
		},
	)

	// Use custom link node extension hook
	// Drag data handling is built-in: relative path as href, filename as title
	const customLinkNode = useCustomLinkNode({
		documentPath: currentDocumentPath,
		onLinkClick: handleLinkClick,
	})

	const isMobile = useIsMobile()
	const previewCodeContent = useMemo(() => {
		// Edit mode normalizes once when Monaco mounts. Keeping editContent out of this
		// dependency list prevents a full-document scan on every Monaco keystroke.
		if (viewMode !== "code" || isEditMode) return content
		return formatLongCurlDataRawForPreview(content)
	}, [content, isEditMode, viewMode])
	const isLargeMarkdown = useMemo(() => isLargeMarkdownContent(content), [content])
	const shouldUseCodeSourceEditor = viewMode === "code" || (isLargeMarkdown && isEditMode)

	const parseSourceRef = useRef({ content: "", replacements: [] as SourceReplacement[] })
	const handleFrontmatterSourceMap = useMemoizedFn(
		(replacements: SourceReplacement[], content: string) => {
			parseSourceRef.current = { content, replacements }
		},
	)
	const sourceLocationExtension = useMemo(
		() => createMarkdownSourceLocation(() => parseSourceRef.current),
		[],
	)

	// Combine all extensions
	const allExtensions = [
		...projectImageExtensions,
		customLinkNode,
		SafeHtmlDiv,
		SafeHtmlSpan,
		SafeHtmlTextBlockStyles,
		SafeVideo,
		...(enableSourceLocation && !isEditMode ? [sourceLocationExtension] : []),
	]

	// 创建内部的 editorRef（如果外部没有传入）
	const internalEditorRef = useRef<SimpleEditorRef>(null)
	const actualEditorRef = editorRef || internalEditorRef
	// 当 isEditMode 为 true 且 editContent 变化时，手动更新编辑器内容
	// 因为 SimpleEditor 在 isEditable=true 时不会自动响应 content prop 的变化
	useEffect(() => {
		if (
			isEditMode &&
			editContent !== undefined &&
			actualEditorRef?.current?.editor &&
			viewMode !== "code"
		) {
			const editor = actualEditorRef.current.editor
			// 确保编辑器已经初始化完成
			if (!editor.isDestroyed && editor.view) {
				// @ts-expect-error - markdown storage may not exist on all editor instances
				const currentContent = editor.storage.markdown?.getMarkdown() || ""
				// 只有当内容不同时才更新，避免不必要的更新
				if (currentContent !== editContent) {
					console.log(
						"[MdEditor] Manually updating editor content:",
						JSON.stringify({
							currentContentLength: currentContent.length,
							editContentLength: editContent.length,
						}),
					)
					actualEditorRef.current.setContent(editContent)
				}
			}
		}
	}, [isEditMode, editContent, actualEditorRef, viewMode])

	return (
		<EditorErrorBoundary
			fallbackMode="simple"
			inputData={{
				contentLength: content.length,
				processedContentLength: processedContent?.length ?? 0,
				viewMode,
				isLoading,
				isEditMode,
				editContentLength: editContent?.length ?? 0,
				language,
				className,
			}}
		>
			<MarkdownFileLinkContext.Provider value={fileLinkContext}>
				<div
					ref={selectionRootRef}
					className={`${enableSourceLocation ? "relative " : ""}${className}`}
					data-testid={dataTestId}
				>
					{isLoading ? (
						suppressLoadingIndicator ? (
							<div className="min-h-dvh" />
						) : (
							<div
								data-testid="editor-body-loading"
								className="flex min-h-0 flex-1 items-center justify-center"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									minHeight: 120,
								}}
							>
								<MagicSpin spinning />
							</div>
						)
					) : shouldUseCodeSourceEditor ? (
						<CodeSourceEditor
							key={isEditMode ? "edit" : "preview"}
							language={language}
							isEditMode={isEditMode}
							isLargeFile={isLargeMarkdown}
							content={isEditMode ? (editContent ?? content) : previewCodeContent}
							onChange={setEditContent}
						/>
					) : isLargeMarkdown ? (
						<LargeMarkdownPreview
							enableSourceLocation={enableSourceLocation}
							content={processedContent || content}
							documentFlow={documentFlowFullscreen}
							isTabActive={isTabActive}
							enableSearch={enableSearch}
							urlResolver={urlResolver}
							onLinkClick={handleLinkClick}
						/>
					) : (
						<SimpleEditor
							key={`${!!isEditMode}-${enableSourceLocation}`}
							onFrontmatterSourceMap={
								enableSourceLocation && !isEditMode
									? handleFrontmatterSourceMap
									: undefined
							}
							ref={actualEditorRef}
							content={
								isEditMode ? (editContent ?? content) : processedContent || content
							}
							enableCodeBlockWrap
							enableReadonlySearch={enableSearch}
							isTabActive={isTabActive}
							onUpdate={({ editor: _editor }) => {
								const content =
									(
										_editor.storage as {
											markdown?: { getMarkdown: () => string }
										}
									).markdown?.getMarkdown() || ""
								setEditContent?.(content)
							}}
							additionalExtensions={allExtensions}
							isEditable={isEditMode}
							isMobile={isMobile || viewMode === "phone"}
							documentFlow={documentFlowFullscreen}
							placeholder={placeholder}
							onSave={onSave}
						/>
					)}
				</div>
			</MarkdownFileLinkContext.Provider>
		</EditorErrorBoundary>
	)
}

export default memo(EditorBody)

export type { EditorBodyProps }
