"use client"

import * as React from "react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import {
	parseEditableMarkdownFrontmatter,
	parseMarkdownFrontmatter,
} from "./frontmatter-node-utils"
import "@/components/tiptap-node/frontmatter-node/frontmatter-node.scss"

function MarkdownFrontmatterNodeView(props: NodeViewProps) {
	const { editor, updateAttributes } = props
	const { t } = useTranslation("tiptap")
	const raw = typeof props.node.attrs.raw === "string" ? props.node.attrs.raw : ""
	const parsedResult = React.useMemo(() => parseMarkdownFrontmatter(raw), [raw])
	const [draftValue, setDraftValue] = React.useState(raw)
	const [isEditable, setIsEditable] = React.useState(editor.isEditable)
	const isFocusedRef = React.useRef(false)

	React.useEffect(() => {
		if (!isFocusedRef.current) setDraftValue(raw)
	}, [raw])

	React.useEffect(() => {
		function syncEditableState() {
			setIsEditable((currentValue) =>
				currentValue === editor.isEditable ? currentValue : editor.isEditable,
			)
		}

		syncEditableState()
		editor.on("update", syncEditableState)

		return () => {
			editor.off("update", syncEditableState)
		}
	}, [editor])

	function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		const nextValue = event.target.value
		setDraftValue(nextValue)
		updateAttributes({
			raw: parseEditableMarkdownFrontmatter(nextValue),
		})
	}

	return (
		<NodeViewWrapper
			className="markdown-frontmatter-node"
			contentEditable={false}
			data-testid="tiptap-frontmatter-node"
		>
			<div className="markdown-frontmatter-node__raw-label">
				{t("editor.frontmatter.rawLabel")}
			</div>
			{isEditable ? (
				<textarea
					className="markdown-frontmatter-node__textarea"
					data-testid="tiptap-frontmatter-input"
					spellCheck={false}
					value={draftValue}
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => event.stopPropagation()}
					onKeyDown={(event) => event.stopPropagation()}
					onKeyUp={(event) => event.stopPropagation()}
					onFocus={() => {
						isFocusedRef.current = true
					}}
					onBlur={() => {
						isFocusedRef.current = false
						setDraftValue(parseEditableMarkdownFrontmatter(draftValue))
					}}
					onChange={handleChange}
				/>
			) : (
				<pre
					className="markdown-frontmatter-node__raw"
					data-testid="tiptap-frontmatter-raw"
				>
					{raw}
				</pre>
			)}
			{parsedResult.error && (
				<div
					className="markdown-frontmatter-node__error"
					data-testid="tiptap-frontmatter-error"
				>
					{t("editor.frontmatter.invalid")}
				</div>
			)}
		</NodeViewWrapper>
	)
}

export default React.memo(MarkdownFrontmatterNodeView)
