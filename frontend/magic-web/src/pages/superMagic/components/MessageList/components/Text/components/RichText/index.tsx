import { memo, useEffect, useRef, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { EditorView } from "prosemirror-view"
import { Schema, Node, DOMSerializer, type SchemaSpec } from "prosemirror-model"
import { EditorState, TextSelection } from "prosemirror-state"
import { useMemoizedFn } from "ahooks"
import { cn } from "@/lib/utils"
import schemaConfig from "./schemaConfig"
import { parseContent } from "./utils"
import type { RichTextProps } from "./types"
import { JSONContent } from "@tiptap/core"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { getMentionDisplayName } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { getDisplayText } from "@/pages/superMagic/components/MessageEditor/extensions/super-placeholder/utils"
import InlineMention from "./components/InlineMention"

const RichText = memo(
	function RichText(props: RichTextProps) {
		const { content, className, style, onFileClick, markerClickScene = "messageList" } = props

		const scene = markerClickScene
		const containerRef = useRef<HTMLDivElement>(null)
		const editorViewRef = useRef<EditorView | null>(null)
		const initializingRef = useRef(false)

		const finalSchema = useMemo(() => new Schema(schemaConfig as SchemaSpec), [])
		const mentionNodeViews = useMemo(
			() => ({
				mention: (node: Node) => {
					const dom = document.createElement("span")
					dom.className = "mention-node-view"

					const root = createRoot(dom)
					root.render(
						<InlineMention
							data={node.attrs as TiptapMentionAttributes}
							onFileClick={onFileClick}
							markerClickScene={scene}
							messageContent={content}
						/>,
					)

					return {
						dom,
						destroy() {
							root.unmount()
						},
					}
				},
			}),
			[content, onFileClick, scene],
		)

		// Generate plain text from ProseMirror node
		const getPlainText = useMemoizedFn((node: Node): string => {
			if (node.type.name === "text") {
				return node.text || ""
			}

			if (node.type.name === "mention") {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const displayName = getMentionDisplayName(node.attrs as any)
				const type = node.attrs.type
				return type === MentionItemType.FOLDER ? ` @${displayName}/ ` : ` @${displayName} `
			}

			if (node.type.name === "super-placeholder") {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return getDisplayText(node.attrs as any)
			}

			if (node.type.name === "hardBreak") {
				return "\n"
			}

			if (node.type.name === "paragraph") {
				let text = ""
				node.forEach((child) => {
					text += getPlainText(child)
				})
				return text + "\n"
			}

			// For other nodes, recursively process children
			let text = ""
			node.forEach((child) => {
				text += getPlainText(child)
			})
			return text
		})

		// Handle copy events to provide proper plain text representation
		const handleCopy = useMemoizedFn((view: EditorView, event: ClipboardEvent) => {
			const { state } = view
			const { selection } = state

			if (selection.empty) {
				return false // No selection, let browser handle default behavior
			}

			try {
				// Extract the selected fragment
				const fragment = selection.content()

				// Generate HTML using ProseMirror's DOM serializer
				const serializer = DOMSerializer.fromSchema(state.schema)
				const dom = serializer.serializeFragment(fragment.content)

				// Create a temporary container to get HTML
				const tempDiv = document.createElement("div")
				tempDiv.appendChild(dom)
				const htmlContent = tempDiv.innerHTML

				// Generate plain text by walking through the fragment
				let plainText = ""
				fragment.content.forEach((node) => {
					plainText += getPlainText(node)
				})

				// Remove trailing newline if it exists
				plainText = plainText.replace(/\n$/, "")

				// Write to clipboard with both formats
				event.preventDefault()
				if (event.clipboardData) {
					event.clipboardData.setData("text/html", htmlContent)
					event.clipboardData.setData("text/plain", plainText)
				}

				return true
			} catch (error) {
				console.error("Failed to handle copy event:", error)
				return false // Let browser handle default behavior on error
			}
		})

		const handleTripleClickOn = useMemoizedFn((view, _pos, _node, _nodePos, event) => {
			event.preventDefault()

			if (!view || !view.state) {
				return true
			}

			// Create a selection that spans the entire document content
			const { doc } = view.state
			const from = 0
			const to = doc.content.size

			// Update ProseMirror's selection state
			const transaction = view.state.tr.setSelection(
				TextSelection.create(view.state.doc, from, to),
			)
			view.dispatch(transaction)

			// Also update DOM selection for consistency
			setTimeout(() => {
				const selection = window.getSelection()
				if (selection && containerRef.current) {
					selection.removeAllRanges()
					const range = document.createRange()
					range.selectNodeContents(containerRef.current)
					selection.addRange(range)
				}
			}, 0)

			return true
		})

		// 初始化渲染器
		useEffect(() => {
			async function init() {
				initializingRef.current = true
				try {
					const parsedContent = parseContent(content as JSONContent | string)
					if (!parsedContent) {
						return
					}

					// 创建 ProseMirror 视图
					editorViewRef.current = new EditorView(containerRef.current, {
						state: EditorState.create({
							doc: Node.fromJSON(finalSchema, parsedContent),
							schema: finalSchema,
						}),
						editable: () => false,
						nodeViews: mentionNodeViews,
						handleTripleClickOn,
						handleDOMEvents: {
							copy: handleCopy,
						},
						plugins: [],
					})
				} catch (error) {
					console.error("RichText init error:", error, content)
				} finally {
					initializingRef.current = false
				}
			}

			if (containerRef.current && content && !initializingRef.current) {
				init()
			}

			return () => {
				if (editorViewRef.current) {
					editorViewRef.current.destroy()
				}
			}
		}, [content, finalSchema, handleTripleClickOn, onFileClick, handleCopy, mentionNodeViews])

		return (
			<div
				ref={containerRef}
				style={style}
				className={cn(
					"flex cursor-text flex-col overflow-hidden outline-none",
					"[&_p]:break-all [&_p]:text-sm [&_p]:font-normal [&_p]:leading-[22px] [&_p]:text-foreground",
					"[&_p>.magic-mention:first-child]:ml-0",
					"[&_p>.mention-node-view:first-child>.magic-marker-mention]:ml-0",
					"[&_.mention-node-view]:inline [&_.mention-node-view]:align-baseline",
					"[&_.magic-marker-mention]:mx-1",
					"[&_p>.mention-node-view:first-child>.magic-mention]:ml-0",
					"[&_.magic-mention]:mx-1 [&_.magic-mention]:inline [&_.magic-mention]:cursor-pointer [&_.magic-mention]:overflow-hidden [&_.magic-mention]:text-ellipsis [&_.magic-mention]:rounded-[4px] [&_.magic-mention]:bg-primary-10 [&_.magic-mention]:px-1 [&_.magic-mention]:py-0.5 [&_.magic-mention]:align-baseline [&_.magic-mention]:text-xs [&_.magic-mention]:leading-4 [&_.magic-mention]:text-foreground",
					"[&_.super-placeholder]:mx-1 [&_.super-placeholder]:inline [&_.super-placeholder]:min-w-[3ch] [&_.super-placeholder]:break-words [&_.super-placeholder]:rounded-[4px] [&_.super-placeholder]:bg-primary-10 [&_.super-placeholder]:px-2 [&_.super-placeholder]:py-0.5 [&_.super-placeholder]:text-sm [&_.super-placeholder]:leading-5 [&_.super-placeholder]:text-primary",
					className,
				)}
			/>
		)
	},
	(prev, next) => {
		return (
			prev.content === next.content &&
			prev.className === next.className &&
			prev.onFileClick === next.onFileClick &&
			prev.markerClickScene === next.markerClickScene
		)
	},
)

export default RichText
export type { RichTextProps } from "./types"
