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
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { transformInspectorContent } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/transform"
import InlineMention from "./components/InlineMention"
import { InspectorDetailReadOnly } from "./components/InspectorDetailReadOnly"

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
				[INSPECTOR_DETAIL_TYPE]: (node: Node) => {
					const dom = document.createElement("div")
					dom.className = "inspector-detail-node-view"

					const root = createRoot(dom)
					root.render(<InspectorDetailReadOnly attrs={node.attrs} />)

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

			if (node.type.name === INSPECTOR_DETAIL_TYPE) {
				const attrs = node.attrs
				const lines: string[] = []
				if (attrs.selector) lines.push(`selector: ${attrs.selector}`)
				if (attrs.size) lines.push(`size: ${attrs.size}`)
				if (attrs.computedStyles && attrs.computedStyles !== "{}") {
					try {
						const styles = JSON.parse(attrs.computedStyles) as Record<string, string>
						const pairs = Object.entries(styles).map(([k, v]) => `${k}: ${v}`)
						if (pairs.length > 0) lines.push(`computedStyles: ${pairs.join("; ")}`)
					} catch {
						lines.push(`computedStyles: ${attrs.computedStyles}`)
					}
				}
				if (attrs.textContent) lines.push(`textContent: "${attrs.textContent}"`)
				return lines.length > 0 ? `${lines.join("\n")}\n` : ""
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

				// Extract mentions and build rich text JSON from the fragment
				const mentions: TiptapMentionAttributes[] = []
				const richTextJson: JSONContent = { type: "doc", content: [] }
				fragment.content.forEach((node) => {
					const nodeJson = node.toJSON()
					richTextJson.content!.push(nodeJson)
					// Collect mention nodes recursively
					const collectMentions = (n: Node) => {
						if (n.type.name === "mention" && n.attrs) {
							mentions.push(n.attrs as TiptapMentionAttributes)
						}
						n.forEach((child) => collectMentions(child))
					}
					collectMentions(node)
				})

				// Build magic clipboard metadata
				const metadata: Record<string, unknown> = {
					richText: JSON.stringify(richTextJson),
				}
				if (mentions.length > 0) {
					metadata.mentions = mentions.map((m) => ({ attrs: m }))
				}
				const metadataBase64 = btoa(encodeURIComponent(JSON.stringify(metadata)))
				const htmlWithMetadata = `<div data-magic-clipboard="${metadataBase64}">${htmlContent}</div>`

				// Write to clipboard with both formats
				event.preventDefault()
				if (event.clipboardData) {
					event.clipboardData.setData("text/html", htmlWithMetadata)
					event.clipboardData.setData("text/plain", plainText)
					// Also set custom MIME types for desktop browsers
					try {
						event.clipboardData.setData(
							"text/x-magic-message-rich-text",
							metadata.richText as string,
						)
						if (mentions.length > 0) {
							event.clipboardData.setData(
								"text/x-magic-message-mentions",
								JSON.stringify(metadata.mentions),
							)
						}
					} catch {
						// Custom MIME types may not be supported in all browsers
					}
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

					// Transform inspector text paragraphs into collapsible nodes
					const transformedContent = transformInspectorContent(parsedContent)

					// 创建 ProseMirror 视图
					editorViewRef.current = new EditorView(containerRef.current, {
						state: EditorState.create({
							doc: Node.fromJSON(finalSchema, transformedContent),
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
