import { memo, useEffect, useRef, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { EditorView } from "prosemirror-view"
import { Schema, Node, DOMSerializer, type SchemaSpec } from "prosemirror-model"
import { EditorState, TextSelection } from "prosemirror-state"
import { useMemoizedFn } from "ahooks"
import { cn } from "@/utils/cn"
import schemaConfig from "./schemaConfig"
import { parseContent } from "./utils"
import type { RichTextProps } from "./types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { transformInspectorContent } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/transform"
import { restoreWechatChatContent } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/transform"
import { WECHAT_CHAT_HISTORY } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/types"
import { createWechatReadOnlyView } from "@/pages/superMagic/components/MessageEditor/components/WechatChatHistory/readOnly"
import type { InspectorDetailAttrs } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail"
import InlineMention from "./components/InlineMention"
import { InspectorDetailReadOnly } from "./components/InspectorDetailReadOnly"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import {
	getClipboardHtml,
	getClipboardPlainText,
	resolveClipboardContent,
	resolveMentionForClipboard,
} from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"

// Schedule a callback on the microtask queue. Falls back to Promise.resolve()
// for older browsers/WebViews that lack the native queueMicrotask (pre-2019).
const scheduleMicrotask =
	typeof queueMicrotask === "function"
		? queueMicrotask
		: (cb: () => void) => {
				Promise.resolve().then(cb)
			}

const RichText = memo(
	function RichText(props: RichTextProps) {
		const {
			content,
			className,
			style,
			onFileClick,
			markerClickScene = "messageList",
			fileMentionRenderConfig,
		} = props
		const { projectFilesStore } = useMessageListContext()

		const scene = markerClickScene
		const containerRef = useRef<HTMLDivElement>(null)
		const editorViewRef = useRef<EditorView | null>(null)
		const initializingRef = useRef(false)

		const finalSchema = useMemo(() => new Schema(schemaConfig as SchemaSpec), [])
		const mentionNodeViews = useMemo(
			() => ({
				[WECHAT_CHAT_HISTORY]: createWechatReadOnlyView,
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
							projectFilesStore={projectFilesStore}
							fileMentionRenderConfig={fileMentionRenderConfig}
						/>,
					)

					return {
						dom,
						destroy() {
							// Defer unmount so we never tear down this nested React root
							// synchronously while the outer React tree is still rendering/committing
							// (ProseMirror calls destroy() during EditorView teardown, which can
							// overlap a React render). Avoids React 18's "synchronously unmount a
							// root while React was already rendering" race-condition warning.
							scheduleMicrotask(() => root.unmount())
						},
					}
				},
				[INSPECTOR_DETAIL_TYPE]: (node: Node) => {
					const dom = document.createElement("span")
					dom.className = "inspector-detail-node-view"

					const root = createRoot(dom)
					root.render(
						<InspectorDetailReadOnly attrs={node.attrs as InspectorDetailAttrs} />,
					)

					return {
						dom,
						destroy() {
							// See note above: defer to a microtask to avoid unmounting a nested
							// React root during the outer React render/commit phase.
							scheduleMicrotask(() => root.unmount())
						},
					}
				},
			}),
			[content, onFileClick, projectFilesStore, scene],
		)

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
				const workspaceFiles = projectFilesStore?.workspaceFilesList ?? []
				const currentProjectId = projectFilesStore?.currentSelectedProject?.id
				const htmlContent = getClipboardHtml(
					tempDiv.innerHTML,
					workspaceFiles,
					currentProjectId,
				)

				// Extract mentions and build rich text JSON from the fragment
				const mentions: TiptapMentionAttributes[] = []
				const richTextJson: JSONContent = { type: "doc", content: [] }
				const richTextContent = richTextJson.content ?? []
				fragment.content.forEach((node) => {
					const nodeJson = node.toJSON()
					richTextContent.push(nodeJson)
					// Collect mention nodes recursively
					const collectMentions = (n: Node) => {
						if (n.type.name === "mention" && n.attrs) {
							mentions.push(n.attrs as TiptapMentionAttributes)
						} else if (n.type.name === INSPECTOR_DETAIL_TYPE) {
							for (const key of ["fileMention", "screenshotMention"] as const) {
								if (n.attrs[key])
									mentions.push(n.attrs[key] as TiptapMentionAttributes)
							}
						}
						n.forEach((child) => collectMentions(child))
					}
					collectMentions(node)
				})
				const clipboardContent = resolveClipboardContent(
					richTextJson,
					workspaceFiles,
					currentProjectId,
				)
				const clipboardMentions = mentions.map((mention) =>
					resolveMentionForClipboard(mention, workspaceFiles, currentProjectId),
				)
				const plainText = getClipboardPlainText(
					clipboardContent,
					workspaceFiles,
					currentProjectId,
				)

				// Build magic clipboard metadata
				const metadata: Record<string, unknown> = {
					richText: JSON.stringify(clipboardContent),
					sourceProjectId: currentProjectId,
				}
				if (clipboardMentions.length > 0) {
					metadata.mentions = clipboardMentions.map((attrs) => ({ attrs }))
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
					const transformedContent = restoreWechatChatContent(
						transformInspectorContent(parsedContent),
					)

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
					"[&_p]:whitespace-pre-wrap [&_p]:break-all [&_p]:text-sm [&_p]:font-normal [&_p]:leading-[22px] [&_p]:text-foreground",
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
			prev.markerClickScene === next.markerClickScene &&
			prev.fileMentionRenderConfig === next.fileMentionRenderConfig
		)
	},
)

export default RichText
export type { RichTextProps } from "./types"
