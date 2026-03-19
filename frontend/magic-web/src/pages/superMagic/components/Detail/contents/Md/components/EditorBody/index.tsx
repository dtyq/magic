import { memo, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import EditorErrorBoundary from "./components/EditorErrorBoundary"
import {
	SimpleEditor,
	SimpleEditorRef,
} from "@/components/tiptap-templates/simple/simple-editor"
import { useProjectImageExtensions } from "@/components/tiptap-templates/simple/hooks"
import { useCustomLinkNode } from "./hooks/useCustomLinkNode"
import CodeSourceEditor from "./components/CodeSourceEditor"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/use-mobile"
import {
	isExternalUrl,
	findFileByPath,
	resolveRelativePath,
	type AttachmentFile,
} from "../../utils"
import { parseAnchorLink, scrollToAnchor } from "@/utils/slug"
import { Editor } from "@tiptap/react"

interface EditorBodyProps {
	isLoading: boolean
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
	urlResolver?: (relativePath: string) => string | Promise<string>
	folderPath?: string
	onImageUploadSuccess?: (relativePath: string) => void
	editorRef?: React.RefObject<SimpleEditorRef>
	placeholder?: string
	attachments?: AttachmentFile[]
	onOpenFile?: (fileItem: { file_id: string }) => void
	onSave?: (editor: Editor | null) => void
}

function EditorBody({
	isLoading,
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
	editorRef,
	placeholder,
	attachments,
	onOpenFile,
	onSave,
}: EditorBodyProps) {
	// Use project image extensions hook
	const projectImageExtensions = useProjectImageExtensions({
		projectId: selectedProject?.id,
		documentPath: currentDocumentPath,
		folderPath,
		urlResolver,
		onSuccess: onImageUploadSuccess,
	})

	// Handle link click: open external URLs in new tab, or open relative files in tab
	// Also supports anchor navigation within documents
	const handleLinkClick = useMemoizedFn(
		(_event: MouseEvent, href: string, _element: HTMLAnchorElement, anchor?: string) => {
			// Parse anchor from href if not provided
			const { filePath, anchor: parsedAnchor } = parseAnchorLink(href)
			const anchorId = anchor || parsedAnchor

			console.log("handleLinkClick", filePath, anchorId)

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

			// Handle relative path (with or without anchor)
			if (currentDocumentPath && attachments && onOpenFile) {
				// Get document directory path
				const documentDir = currentDocumentPath.substring(
					0,
					currentDocumentPath.lastIndexOf("/"),
				)

				// Resolve relative path to project root path
				const resolvedPath = documentDir
					? resolveRelativePath(documentDir, filePath)
					: filePath

				// Find file by path
				const matchedFile = findFileByPath(attachments, resolvedPath)

				if (matchedFile?.file_id) {
					// Open file in tab
					onOpenFile({ file_id: matchedFile.file_id })

					// If there's an anchor, scroll to it after document loads
					if (anchorId) {
						// Wait for document to render before scrolling
						setTimeout(() => {
							scrollToAnchor(anchorId, 80)
						}, 1000) // Adjust delay as needed
					}

					return true
				}
			}

			// If file not found or no handler, prevent default
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

	// Combine all extensions
	const allExtensions = [...projectImageExtensions, customLinkNode]

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
				content,
				processedContent,
				viewMode,
				isLoading,
				isEditMode,
				editContent,
				language,
				className,
			}}
		>
			<div className={className}>
				{isLoading ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							minHeight: 120,
						}}
					>
						<MagicSpin spinning />
					</div>
				) : viewMode === "code" ? (
					<CodeSourceEditor
						language={language}
						isEditMode={isEditMode}
						content={isEditMode ? editContent || content : content}
						onChange={setEditContent}
					/>
				) : (
					<SimpleEditor
						ref={actualEditorRef}
						content={isEditMode ? editContent || content : processedContent || content}
						onUpdate={({ editor: _editor }) => {
							const content =
								(
									_editor.storage as { markdown?: { getMarkdown: () => string } }
								).markdown?.getMarkdown() || ""
							setEditContent?.(content)
						}}
						additionalExtensions={allExtensions}
						isEditable={isEditMode}
						isMobile={isMobile || viewMode === "phone"}
						placeholder={placeholder}
						onSave={onSave}
					/>
				)}
			</div>
		</EditorErrorBoundary>
	)
}

export default memo(EditorBody)

export type { EditorBodyProps }
