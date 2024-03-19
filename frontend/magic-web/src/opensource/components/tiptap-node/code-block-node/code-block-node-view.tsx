"use client"

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { Suspense, lazy, useEffect, useState } from "react"

const MagicCode = lazy(() => import("@/opensource/components/base/MagicCode"))
const MagicMermaid = lazy(() => import("@/opensource/components/base/MagicMermaid"))

const DiffHighlighter = lazy(async () => {
	const module = await import("react-syntax-highlighter")
	const diffLanguage = await import("react-syntax-highlighter/dist/esm/languages/hljs/diff")
	module.Light.registerLanguage("diff", diffLanguage.default)
	return { default: module.Light }
})

/**
 * React component for rendering CodeBlock nodes
 * Switches rendering mode based on editor editability:
 * - Editable: uses NodeViewContent for direct editing
 * - Read-only: uses MagicCode for enhanced display with syntax highlighting
 */
export function CodeBlockNodeView(props: NodeViewProps) {
	const { node, editor } = props
	const language = node.attrs.language || "text"
	const [diffStyle, setDiffStyle] = useState<Record<string, any> | null>(null)
	useEffect(() => {
		if (language !== "diff" || diffStyle) return
		import("react-syntax-highlighter/dist/esm/styles/hljs").then((styleModule) => {
			setDiffStyle(styleModule.github)
		})
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

	// Editable mode: use default rendering to allow editing
	if (isEditable) {
		return (
			<NodeViewWrapper as="pre">
				<code>
					<NodeViewContent as="div" />
				</code>
			</NodeViewWrapper>
		)
	}

	// Read-only mode: use MagicCode for syntax highlighting and copy button
	const codeContent = node.textContent

	if (language === "mermaid") {
		return (
			<NodeViewWrapper as="div">
				<Suspense fallback={null}>
					<MagicMermaid data={codeContent} />
				</Suspense>
			</NodeViewWrapper>
		)
	}
	// Support diff format - use Light version to avoid conflict with code mode
	if (language === "diff") {
		if (!diffStyle) {
			return null
		}

		return (
			<NodeViewWrapper as="div" className="diff-code-block-node-view">
				<Suspense fallback={null}>
					<DiffHighlighter
						language="diff"
						style={diffStyle}
						showLineNumbers={false}
						wrapLines={true}
						customStyle={{
							fontSize: "14px",
							textShadow: "none !important",
						}}
						className="diff-code"
					>
						{codeContent}
					</DiffHighlighter>
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
				/>
			</Suspense>
		</NodeViewWrapper>
	)
}

export default CodeBlockNodeView
