"use client"

import { NodeViewWrapper, NodeViewContent } from "@/infrastructure/editors/tiptap/react"
import type { NodeViewProps } from "@/infrastructure/editors/tiptap/react"
import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import {
	DiffSyntaxHighlighter,
	loadDiffSyntaxHighlighter,
} from "@/infrastructure/vendors/react-syntax-highlighter/diff"
import type { CodeBlockNodeOptions } from "./code-block-node-extension"
import { cn } from "@/utils/cn"
import type { CodeSearchHighlight } from "@/components/base/MagicCode/search-highlights"

const MagicCode = lazy(() => import("@/components/base/MagicCode"))
const MagicMermaid = lazy(() => import("@/components/base/MagicMermaid"))

interface CodeBlockNodeViewProps extends NodeViewProps {
	extension: NodeViewProps["extension"] & {
		options: CodeBlockNodeOptions
	}
}

/**
 * React component for rendering CodeBlock nodes
 * Switches rendering mode based on editor editability:
 * - Editable: uses NodeViewContent for direct editing
 * - Read-only: uses MagicCode for enhanced display with syntax highlighting
 */
export function CodeBlockNodeView(props: CodeBlockNodeViewProps) {
	const { node, editor, extension, innerDecorations } = props
	// Read-only node views render outside contentDOM, so project the search decorations
	// into the syntax renderer using their already node-relative offsets.
	const searchHighlights = useMemo(() => {
		const highlights: CodeSearchHighlight[] = []
		innerDecorations.forEachSet((set) => {
			for (const decoration of set.find()) {
				const className = decoration.spec.searchResultClass
				if (typeof className === "string") {
					highlights.push({ from: decoration.from, to: decoration.to, className })
				}
			}
		})
		return highlights.sort((a, b) => a.from - b.from)
	}, [innerDecorations])
	const language = node.attrs.language || "text"
	const { enableWrapToggle } = extension.options
	const diffWrapClassName = enableWrapToggle ? "diff-code-wrapped" : "diff-code-unwrapped"
	const [diffStyle, setDiffStyle] = useState<Record<string, CSSProperties> | null>(null)
	useEffect(() => {
		if (language !== "diff" || diffStyle) return
		loadDiffSyntaxHighlighter().then(({ style }) => setDiffStyle(style))
	}, [language, diffStyle])

	// Track editable state manually since shouldRerenderOnTransaction is false
	const [isEditable, setIsEditable] = useState(editor.isEditable)

	// Listen to editor updates to sync editable state
	useEffect(() => {
		const updateEditableState = () => {
			if (editor.isEditable !== isEditable) {
				setIsEditable(editor.isEditable)
			}
		}

		// Check immediately in case state changed
		updateEditableState()

		// Listen to update event (triggered after transactions are applied)
		editor.on("update", updateEditableState)

		return () => {
			editor.off("update", updateEditableState)
		}
	}, [editor, isEditable])

	// NodeViewContent hosts the renderer's actual <code> contentDOM. Keep it directly
	// inside <pre>; another editable <code> wrapper can accept input outside the document.
	if (isEditable) {
		return (
			<NodeViewWrapper as="div">
				<NodeViewContent as="pre" />
			</NodeViewWrapper>
		)
	}

	// Read-only mode: use MagicCode for syntax highlighting and copy button
	const codeContent = node.textContent

	if (language === "mermaid") {
		return (
			<NodeViewWrapper as="div">
				<Suspense fallback={null}>
					<MagicMermaid data={codeContent} allowPreview />
				</Suspense>
			</NodeViewWrapper>
		)
	}
	// Support diff format - use Light version to avoid conflict with code mode
	if (language === "diff" && !searchHighlights.length) {
		if (!diffStyle) {
			return null
		}

		return (
			<NodeViewWrapper
				as="div"
				className={cn("diff-code-block-node-view", diffWrapClassName)}
			>
				<Suspense fallback={null}>
					<DiffSyntaxHighlighter
						language="diff"
						style={diffStyle}
						showLineNumbers={false}
						wrapLongLines={enableWrapToggle}
						customStyle={{
							fontSize: "14px",
							textShadow: "none !important",
						}}
						className="diff-code"
					>
						{codeContent}
					</DiffSyntaxHighlighter>
				</Suspense>
			</NodeViewWrapper>
		)
	}

	return (
		<NodeViewWrapper as="div">
			<Suspense fallback={null}>
				<MagicCode
					language={language || "text"}
					data={codeContent}
					className="code-block-node-view"
					enableWrapToggle={enableWrapToggle}
					searchHighlights={searchHighlights}
				/>
			</Suspense>
		</NodeViewWrapper>
	)
}

export default CodeBlockNodeView
