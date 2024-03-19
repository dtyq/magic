"use client"

import * as React from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import type { Node as ProseMirrorNode, Slice } from "@tiptap/pm/model"
import { useTranslation } from "react-i18next"
import { cx } from "antd-style"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { CharacterCount, Selection } from "@tiptap/extensions"
import { Markdown } from "tiptap-markdown"
import { SlashCommandExtension } from "@/opensource/components/tiptap-ui-primitive/SlashDropdownMenu"
import { TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import { DragHandle } from "@tiptap/extension-drag-handle-react"

// --- UI Primitives ---
import { Toolbar } from "@/opensource/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node Styles ---
import "@/opensource/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/opensource/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/opensource/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/opensource/components/tiptap-node/list-node/list-node.scss"
import "@/opensource/components/tiptap-node/image-node/image-node.scss"
import "@/opensource/components/tiptap-node/heading-node/heading-node.scss"
import "@/opensource/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/opensource/components/tiptap-node/table-node/table-node.scss"

// --- Tiptap Node Extensions ---
import { HorizontalRule } from "@/opensource/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { CodeBlockNode } from "@/opensource/components/tiptap-node/code-block-node"
import { LinkNode } from "@/opensource/components/tiptap-node/link-node"
import { HeadingNode } from "@/opensource/components/tiptap-node/heading-node"
import { Placeholder } from "@/opensource/pages/superMagic/components/MessageEditor/extensions/placeholder"
import { TableWithWrapper } from "@/opensource/components/tiptap-node/table-node/table-node-extension"

// --- Hooks ---
import { useCursorVisibility } from "@/opensource/hooks/use-cursor-visibility"
import { usePasteCursorPosition } from "./hooks"

// --- Components ---
import FlexBox from "@/opensource/components/base/FlexBox"
import { DragHandleButton } from "./components/DragHandleButton"
import { SlashCommandTriggerButton } from "./components/SlashCommandTriggerButton"
import { MainToolbarContent } from "./components/MainToolbarContent"
import { MobileToolbarContent } from "./components/MobileToolbarContent"
import { TableMenu } from "./components/TableMenu"

// --- Types ---
import type { SimpleEditorProps, SimpleEditorRef } from "./types"
import type { EditorEvents } from "@tiptap/react"

// --- Styles ---
import "@/opensource/components/tiptap-templates/simple/simple-editor.scss"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useTheme } from "@/opensource/models/config/hooks"

// Re-export types for convenience
export type { SimpleEditorProps, SimpleEditorRef } from "./types"

export const SimpleEditor = React.forwardRef<SimpleEditorRef, SimpleEditorProps>(function (
	{
		content,
		characterCountConfig,
		onUpdate,
		onContentChange,
		onSave,
		slashConfig,
		placeholder,
		className,
		additionalExtensions,
		enableDragHandle = true,
		isEditable = true,
		isMobile = false,
	},
	ref,
) {
	const [mobileView, setMobileView] = React.useState<"main" | "highlighter" | "link">("main")

	const toolbarRef = React.useRef<HTMLDivElement>(null)
	const { t } = useTranslation("tiptap")
	const { prefersColorScheme } = useTheme()
	const isDark = prefersColorScheme === "dark"

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
			HorizontalRule,
			CodeBlockNode,
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
			...(additionalExtensions ?? []),
		],
		content,
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
			editor?.commands?.setContent?.(content ?? [])
		}
	}, [content])

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

			try {
				editor.commands.updatePlaceholder(placeholder)
			} catch (error) {
				console.warn("Failed to update placeholder:", error)
			}
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

	React.useImperativeHandle(
		ref,
		() => ({
			editor,
			setContent: (content: string) => {
				if (!editor) return
				editor.commands.setContent(content)
			},
		}),
		[editor],
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
			className={cx(
				"simple-editor-wrapper",
				"tiptap-editor-root",
				{ dark: isDark },
				className,
			)}
		>
			<EditorContext.Provider value={{ editor }}>
				{toolbar(!isMobile && isEditable)}
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

				<EditorContent
					editor={editor}
					role="presentation"
					className="simple-editor-content"
				/>
				{isEditable && <TableMenu editor={editor} isEditable={isEditable} />}
				{toolbar(isMobile && isEditable)}
			</EditorContext.Provider>
		</div>
	)
})
