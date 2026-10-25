import * as React from "react"
import { EditorContent, EditorContext, useEditor } from "@/infrastructure/editors/tiptap/react"
import type { Node as ProseMirrorNode, Slice } from "@/infrastructure/editors/tiptap/pm-model"
import { useTranslation } from "react-i18next"
import { cx } from "antd-style"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { TaskItem, TaskList } from "@/infrastructure/editors/tiptap/extension-list"
import { TextAlign } from "@/infrastructure/editors/tiptap/extension-text-align"
import { Typography } from "@/infrastructure/editors/tiptap/extension-typography"
import { Highlight } from "@/infrastructure/editors/tiptap/extension-highlight"
import { Subscript } from "@/infrastructure/editors/tiptap/extension-subscript"
import { Superscript } from "@/infrastructure/editors/tiptap/extension-superscript"
import { CharacterCount, Selection } from "@/infrastructure/editors/tiptap/extensions"
import { Markdown } from "@/infrastructure/editors/tiptap/markdown"
import { SlashCommandExtension } from "@/components/tiptap-ui-primitive/SlashDropdownMenu"
import { TableRow, TableCell, TableHeader } from "@/infrastructure/editors/tiptap/extension-table"
import { DragHandle } from "@/infrastructure/editors/tiptap/extension-drag-handle-react"

// --- UI Primitives ---
import { Toolbar } from "@/components/tiptap-ui-primitive/toolbar"

// --- Styles ---
// Shared with LargeMarkdownPreview; see simple-editor-styles.ts for why the markup owner
// does not import the stylesheets directly.
import "./simple-editor-styles"

// --- Tiptap Node Extensions ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { CodeBlockNode } from "@/components/tiptap-node/code-block-node"
import { LinkNode } from "@/components/tiptap-node/link-node"
import { HeadingNode } from "@/components/tiptap-node/heading-node"
import {
	MarkdownFrontmatterNode,
	preprocessMarkdownFrontmatter,
} from "@/components/tiptap-node/frontmatter-node"
import { Placeholder } from "@/pages/superMagic/components/MessageEditor/extensions/placeholder"
import { TableWithWrapper } from "@/components/tiptap-node/table-node/table-node-extension"
import { SearchAndReplace as SearchAndReplaceExtension } from "@/components/tiptap-node/search-and-replace-node/search-and-replace-extension"

// --- Hooks ---
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"
import { usePasteCursorPosition } from "./hooks"

// --- Components ---
import FlexBox from "@/components/base/FlexBox"
import { DragHandleButton } from "./components/DragHandleButton"
import { SlashCommandTriggerButton } from "./components/SlashCommandTriggerButton"
import { MainToolbarContent } from "./components/MainToolbarContent"
import { MobileToolbarContent } from "./components/MobileToolbarContent"
import { TableMenu } from "./components/TableMenu"
import { SearchAndReplace } from "./components/SearchAndReplace"

// --- Types ---
import type { SimpleEditorProps, SimpleEditorRef } from "./types"
import type { EditorEvents } from "@/infrastructure/editors/tiptap/react"

import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useTheme } from "@/models/config/hooks"

// Re-export types for convenience
export type { SimpleEditorProps, SimpleEditorRef } from "./types"

export const SimpleEditor = React.forwardRef<SimpleEditorRef, SimpleEditorProps>(function (
	{
		content,
		showToolbar = true,
		characterCountConfig,
		onUpdate,
		onContentChange,
		onSave,
		slashConfig,
		placeholder,
		className,
		additionalExtensions,
		enableDragHandle = true,
		enableSearchReplace = true,
		enableReadonlySearch = false,
		isTabActive = true,
		enableCodeBlockWrap = false,
		isEditable = true,
		isMobile = false,
		documentFlow = false,
		onFrontmatterSourceMap,
	},
	ref,
) {
	const [mobileView, setMobileView] = React.useState<"main" | "highlighter" | "link">("main")
	const [showSearchPanel, setShowSearchPanel] = React.useState(false)
	const enableSearchReplaceRef = React.useRef(enableSearchReplace)
	const enableReadonlySearchRef = React.useRef(enableReadonlySearch)
	const isTabActiveRef = React.useRef(isTabActive)
	const editorRootRef = React.useRef<HTMLDivElement>(null)

	const toolbarRef = React.useRef<HTMLDivElement>(null)
	const { t } = useTranslation("tiptap")
	const { prefersColorScheme } = useTheme()
	const isDark = prefersColorScheme === "dark"
	const preprocessContent = React.useCallback(
		(value: string) => {
			let ranges: Parameters<NonNullable<SimpleEditorProps["onFrontmatterSourceMap"]>>[0] = []
			const processed = preprocessMarkdownFrontmatter(
				value,
				onFrontmatterSourceMap
					? (nextRanges) => {
							ranges = nextRanges
						}
					: undefined,
			)
			onFrontmatterSourceMap?.(ranges, processed)
			return processed
		},
		[onFrontmatterSourceMap],
	)
	const processedContent = React.useMemo(
		() => (typeof content === "string" ? preprocessContent(content) : content),
		[content, preprocessContent],
	)

	// Enhanced slash config with internationalization
	const enhancedSlashConfig = React.useMemo(
		() => ({
			...slashConfig,
			// Add internationalization to empty placeholder if not provided
			emptyPlaceholder:
				slashConfig?.emptyPlaceholder || t("editor.slashMenu.emptyPlaceholder"),
		}),
		[slashConfig, t],
	)

	// Handle paste cursor positioning
	// Note: We need to create handlers before editor creation, but they depend on editor
	// So we'll create them with a ref pattern
	const pasteHandlersRef = React.useRef<{
		handleOnPaste: ((event: ClipboardEvent, slice: Slice) => void) | null
		handleEditorUpdate: ((update: EditorEvents["update"]) => void) | null
	}>({ handleOnPaste: null, handleEditorUpdate: null })

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: {
				autocomplete: "off",
				autocorrect: "off",
				autocapitalize: "off",
				"aria-label": "Main content area, start typing to enter text.",
				class: "simple-editor",
			},
			handleKeyDown: (_view, event) => {
				const key = event.key?.toLowerCase()
				const isSearchKey = key === "f" && (event.metaKey || event.ctrlKey) && !event.altKey

				const canSearch = _view.editable
					? enableSearchReplaceRef.current
					: enableReadonlySearchRef.current && isTabActiveRef.current
				if (!canSearch || !isSearchKey) {
					return false
				}

				event.preventDefault()
				event.stopPropagation()
				setShowSearchPanel(true)
				return true
			},
		},
		editable: isEditable,
		extensions: [
			StarterKit.configure({
				horizontalRule: false,
				codeBlock: false,
				heading: false, // Disable default heading extension, use custom HeadingNode instead
				hardBreak: {
					keepMarks: true,
				},
				link: false, // Disable default link extension, use custom LinkNode instead
				undoRedo: {
					depth: 200,
					newGroupDelay: 300,
				},
			}),
			HeadingNode.configure({
				levels: [1, 2, 3, 4, 5, 6],
			}),
			LinkNode.configure({
				openOnClick: false,
				enableClickSelection: true,
			}),
			Placeholder.configure({
				placeholder,
				// showOnlyWhenEditable: true,
				// showOnlyCurrent: true,
			}),
			MarkdownFrontmatterNode,
			HorizontalRule,
			CodeBlockNode.configure({
				enableWrapToggle: enableCodeBlockWrap,
			}),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			TaskList,
			TaskItem.configure({ nested: true }),
			Highlight.configure({ multicolor: true }),
			Typography,
			Superscript,
			Subscript,
			Selection,
			CharacterCount.configure(characterCountConfig),
			Markdown.configure({
				html: true,
				tightLists: false,
				breaks: true, // Enable hard line breaks (converts \n to <br>)
				linkify: true,
				transformPastedText: true,
				transformCopiedText: false,
			}),
			SlashCommandExtension.configure({ config: enhancedSlashConfig }),
			TableWithWrapper,
			TableRow,
			TableCell,
			TableHeader,
			...(enableSearchReplace
				? [
						SearchAndReplaceExtension.configure({
							searchResultClass: "search-result",
						}),
					]
				: []),
			...(additionalExtensions ?? []),
		],
		content: processedContent,
		onPaste: (...args) => pasteHandlersRef.current.handleOnPaste?.(...args),
		onUpdate: (...args) => pasteHandlersRef.current.handleEditorUpdate?.(...args),
	})

	// 可编辑状态变化时，更新编辑器可编辑状态
	useUpdateEffect(() => {
		if (!editor) return
		editor.setEditable(isEditable)
	}, [isEditable])

	// 内容变化时，如果不可编辑，则更新编辑器内容
	useUpdateEffect(() => {
		if (!isEditable) {
			runActiveEditor(editor, (activeEditor) => {
				activeEditor.commands.setContent(processedContent ?? [])
			})
		}
	}, [processedContent])

	// Handle dynamic placeholder updates
	React.useEffect(() => {
		if (!editor || editor.isDestroyed || !placeholder) {
			return
		}

		// Ensure editor view is ready before updating placeholder
		if (!editor.view) {
			return
		}

		// Use requestAnimationFrame to ensure the editor is fully initialized
		// and avoid race conditions with other state updates
		const timeoutId = requestAnimationFrame(() => {
			if (editor.isDestroyed || !editor.view) {
				return
			}

			runActiveEditor(editor, (activeEditor) => {
				activeEditor.commands.updatePlaceholder(placeholder)
			})
		})

		return () => {
			cancelAnimationFrame(timeoutId)
		}
	}, [editor, placeholder])

	// Create paste handlers after editor is created
	const { handleOnPaste, handleEditorUpdate } = usePasteCursorPosition({
		editor,
		onUpdate,
		onContentChange,
	})

	// Update handlers ref
	React.useEffect(() => {
		pasteHandlersRef.current.handleOnPaste = handleOnPaste
		pasteHandlersRef.current.handleEditorUpdate = handleEditorUpdate
	}, [handleOnPaste, handleEditorUpdate])

	React.useEffect(() => {
		enableSearchReplaceRef.current = enableSearchReplace
	}, [enableSearchReplace])

	React.useEffect(() => {
		enableReadonlySearchRef.current = enableReadonlySearch
	}, [enableReadonlySearch])

	React.useEffect(() => {
		isTabActiveRef.current = isTabActive
	}, [isTabActive])

	React.useEffect(() => {
		if (isEditable || !enableReadonlySearch || !isTabActive) return

		const handleReadonlySearchShortcut = (event: KeyboardEvent) => {
			if (
				event.key.toLowerCase() !== "f" ||
				(!event.metaKey && !event.ctrlKey) ||
				event.altKey
			) {
				return
			}

			const activeElement = document.activeElement
			const isTextInput =
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				(activeElement instanceof HTMLElement && activeElement.isContentEditable)
			if (isTextInput && !editorRootRef.current?.contains(activeElement)) return

			event.preventDefault()
			event.stopPropagation()
			setShowSearchPanel(true)
		}

		window.addEventListener("keydown", handleReadonlySearchShortcut)
		return () => window.removeEventListener("keydown", handleReadonlySearchShortcut)
	}, [enableReadonlySearch, isEditable, isTabActive])

	React.useImperativeHandle(
		ref,
		() => ({
			editor,
			setContent: (content: string) => {
				runActiveEditor(editor, (activeEditor) => {
					activeEditor.commands.setContent(preprocessContent(content))
				})
			},
		}),
		[editor, preprocessContent],
	)

	// Ensure cursor visibility when typing (side effect hook, return value not used)
	useCursorVisibility({
		editor,
		overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
	})

	// Intercept Cmd/Ctrl+S to block default save and run custom handler
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const key = event.key?.toLowerCase()
			const isSaveKey = key === "s" && (event.metaKey || event.ctrlKey)
			if (!isSaveKey) return
			if (!editor?.view?.hasFocus()) return

			event.preventDefault()
			event.stopPropagation()
			onSave?.(editor ?? null)
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [editor, onSave])

	React.useEffect(() => {
		if (!isMobile && mobileView !== "main") {
			setMobileView("main")
		}
	}, [isMobile, mobileView])

	// Sync isEditable prop changes to editor
	React.useEffect(() => {
		if (!editor) return
		editor.setEditable(isEditable)
	}, [editor, isEditable])

	const lastDragHandleTargetPos = React.useRef<number | null>(null)
	const lastDragHandleTargetNode = React.useRef<ProseMirrorNode | null>(null)
	const handleDragHandleNodeChange = useMemoizedFn(
		({ node, pos }: { node: ProseMirrorNode | null; pos: number }) => {
			if (!node) return
			lastDragHandleTargetPos.current = pos
			lastDragHandleTargetNode.current = node
		},
	)
	const [selectedNode, setSelectedNode] = React.useState<ProseMirrorNode | null>(null)
	const [selectedNodePos, setSelectedNodePos] = React.useState<number | null>(null)

	const handleToggleSearch = useMemoizedFn(() => {
		setShowSearchPanel((prev) => !prev)
	})
	const onClickSlashCommandTriggerButton = useMemoizedFn(() => {
		setSelectedNode(lastDragHandleTargetNode.current)
		setSelectedNodePos(lastDragHandleTargetPos.current)
	})

	const toolbar = (show: boolean) => (
		<Toolbar
			ref={toolbarRef}
			style={{
				...(isMobile ? {} : { flexWrap: "wrap" }),
				...(!show && {
					display: "none",
				}),
			}}
		>
			{mobileView === "main" ? (
				<MainToolbarContent
					editor={editor}
					onHighlighterClick={() => setMobileView("highlighter")}
					onLinkClick={() => setMobileView("link")}
					isMobile={isMobile}
					isEditable={isEditable}
					enableSearchReplace={enableSearchReplace}
					onSearchClick={handleToggleSearch}
				/>
			) : (
				<MobileToolbarContent
					type={mobileView === "highlighter" ? "highlighter" : "link"}
					onBack={() => setMobileView("main")}
					isEditable={isEditable}
				/>
			)}
		</Toolbar>
	)

	return (
		<div
			ref={editorRootRef}
			className={cx(
				"simple-editor-wrapper",
				"tiptap-editor-root",
				{ dark: isDark, "simple-editor-document-flow": documentFlow },
				className,
			)}
		>
			<EditorContext.Provider value={{ editor }}>
				{showToolbar && toolbar(!isMobile && isEditable)}
				{enableDragHandle && editor && (
					<DragHandle
						editor={editor}
						onNodeChange={handleDragHandleNodeChange}
						className={cx({ "simple-editor-drag-handle-hidden": !isEditable })}
					>
						{!isMobile && (
							<FlexBox align="center">
								<SlashCommandTriggerButton
									editor={editor}
									targetPos={selectedNodePos}
									targetNode={selectedNode}
									config={slashConfig}
									onClick={onClickSlashCommandTriggerButton}
								/>
								<DragHandleButton
									editor={editor}
									targetPos={selectedNodePos}
									targetNode={selectedNode}
									onClick={onClickSlashCommandTriggerButton}
								/>
							</FlexBox>
						)}
					</DragHandle>
				)}

				{enableSearchReplace && (
					<SearchAndReplace
						editor={editor}
						visible={showSearchPanel}
						documentFlow={documentFlow}
						onClose={() => setShowSearchPanel(false)}
					/>
				)}

				<EditorContent
					editor={editor}
					role="presentation"
					className="simple-editor-content"
				/>
				{isEditable && <TableMenu editor={editor} isEditable={isEditable} />}
				{showToolbar && toolbar(isMobile && isEditable)}
			</EditorContext.Provider>
		</div>
	)
})

export default SimpleEditor
