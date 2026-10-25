import { LinkNode, type LinkNodeOptions } from "@/components/tiptap-node/link-node"
import { Plugin, TextSelection, PluginKey } from "@/infrastructure/editors/tiptap/pm-state"
import {
	TabDragData,
	AttachmentDragData,
	MultipleFilesDragData,
	DRAG_TYPE,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import { calculateRelativePath } from "@/utils/path"
import { parseAnchorLink } from "@/utils/slug"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import { mergeAttributes } from "@/infrastructure/editors/tiptap/core"
import { isMarkdownFileLink } from "@/pages/superMagic/utils/markdownFileReference"
import { ReactMarkViewRenderer } from "@/infrastructure/editors/tiptap/react"
import { MarkdownLinkMarkView } from "../components/MarkdownLinkMarkView"
import type MarkdownIt from "markdown-it"
import { installSpacedMarkdownFileLinks } from "@/pages/superMagic/utils/markdownFileLinkSyntax"

export interface CustomLinkNodeOptions extends LinkNodeOptions {
	/**
	 * Custom click handler for links
	 * Receives the full href including anchor (e.g., "file.md#heading")
	 * Return true to prevent default behavior
	 * Return false to continue with parent plugin handling
	 */
	onLinkClick?: (
		event: MouseEvent,
		href: string,
		element: HTMLAnchorElement,
		anchor?: string,
	) => boolean | void
	/**
	 * Current document path for calculating relative paths
	 */
	documentPath?: string
}

/**
 * Custom Link extension that extends LinkNode with:
 * 1. Support for handling custom drag data (Tab, ProjectFile, MultipleFiles)
 * 2. Support for custom click behavior
 */
export const CustomLinkNode = LinkNode.extend<CustomLinkNodeOptions>({
	addStorage() {
		const parent = this.parent?.()
		return {
			...parent,
			markdown: {
				...parent?.markdown,
				parse: {
					...parent?.markdown?.parse,
					setup(md: MarkdownIt) {
						parent?.markdown?.parse?.setup?.(md)
						installSpacedMarkdownFileLinks(md)
					},
				},
			},
		}
	},
	addMarkView() {
		return ReactMarkViewRenderer(MarkdownLinkMarkView)
	},
	addOptions() {
		return {
			...this.parent?.(),
			onLinkClick: undefined,
			documentPath: undefined,
		}
	},

	parseHTML() {
		return [
			...(this.parent?.() || []),
			{
				tag: "a[data-file-href]",
				getAttrs: (element) => ({
					href: element.getAttribute("data-file-href"),
					title: element.getAttribute("title"),
				}),
			},
		]
	},

	addAttributes() {
		const attributes = this.parent?.() || {}
		return {
			...attributes,
			href: {
				...attributes.href,
				// 从只读预览复制的 HTML 仍还原原始目标，不能丢失 mark 的文件路径。
				parseHTML: (element) =>
					element.getAttribute("data-file-href") ?? element.getAttribute("href"),
			},
		}
	},

	renderHTML({ HTMLAttributes }) {
		const attributes = mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes)
		const href = typeof attributes.href === "string" ? attributes.href : ""
		// mark 始终保存原路径；只读 DOM 只提供文件操作，避免悬停／中键走前端路由。
		if (!this.editor.isEditable && isMarkdownFileLink(href)) {
			delete attributes.href
			delete attributes.target
			attributes["data-file-href"] = href
			attributes.role = "button"
			attributes.tabindex = "0"
			attributes.class = [attributes.class, "cursor-pointer focus-visible:outline"]
				.filter(Boolean)
				.join(" ")
		}
		return ["a", attributes, 0]
	},

	addProseMirrorPlugins() {
		const parentPlugins = this.parent?.() || []
		const options = this.options

		// Create a unique plugin key to avoid conflicts
		const customLinkClickKey = new PluginKey("customLinkClick")

		return [
			// Custom link click handler plugin - must be before parent plugins to intercept clicks
			// This ensures our custom handler runs before the parent LinkNode's click handler
			new Plugin({
				key: customLinkClickKey,
				props: {
					handleDOMEvents: {
						keydown: (_view, event) => {
							if (event.key !== "Enter" && event.key !== " ") return false
							const target = event.target
							if (!(target instanceof HTMLElement)) return false
							const link = target.closest<HTMLAnchorElement>("a[data-file-href]")
							if (!link) return false
							event.preventDefault()
							// 键盘激活走与鼠标相同的已注册点击处理，不能生成另一套文件打开行为。
							link.click()
							return true
						},
						click: (_view, event) => {
							const target = event.target as HTMLElement
							const linkElement = target.closest("a")

							if (linkElement) {
								const href =
									linkElement.getAttribute("data-file-href") ??
									linkElement.getAttribute("href")
								if (!href) return false

								// Call custom click handler if provided (works in both editable and non-editable modes)
								if (options.onLinkClick) {
									// Parse anchor from href
									const { anchor } = parseAnchorLink(href)

									// Always call the handler regardless of edit mode
									// This handler is called BEFORE parent LinkNode's handler
									const result = options.onLinkClick(
										event,
										href,
										linkElement,
										anchor || undefined,
									)
									// If handler returns true, prevent default behavior (including parent plugin's behavior)
									if (result === true) {
										event.preventDefault()
										event.stopPropagation()
										// Return true to prevent parent plugins from handling this click
										// This will prevent LinkNode's default selection behavior in edit mode
										return true
									}
									// If handler returns false or undefined, continue with default behavior
									// In editable mode, parent plugin will handle selection
									// In non-editable mode, default link navigation will occur
									// Return false to let parent plugins or default behavior handle it
									return false
								}

								// If no custom handler, let parent plugins handle it
								return false
							}

							return false
						},
					},
				},
			}),
			// Parent plugins come after custom handler
			// They will only execute if custom handler returns false or doesn't exist
			...parentPlugins,
			new Plugin({
				key: new PluginKey("customLinkDrop"),
				props: {
					handleDrop: (view, event, _slice, moved) => {
						if (moved) return false

						// Check for custom drag data
						const customData = event.dataTransfer?.getData("text/plain")
						if (!customData) {
							return false
						}

						try {
							const parsedData = JSON.parse(customData) as
								TabDragData | AttachmentDragData | MultipleFilesDragData

							// Check if it's a valid custom drag data type
							if (!Object.values(DRAG_TYPE).includes(parsedData.type as DRAG_TYPE)) {
								return false
							}

							event.preventDefault()

							// Get drop position
							const pos = view.posAtCoords({
								left: event.clientX,
								top: event.clientY,
							})

							if (!pos) {
								return false
							}

							const { state } = view
							const $pos = state.doc.resolve(pos.pos)
							view.dispatch(state.tr.setSelection(TextSelection.near($pos)))

							// Extract link data based on drag type
							const links: Array<{ href: string; title: string }> = []
							const documentPath = options.documentPath

							switch (parsedData.type) {
								case DRAG_TYPE.Tab: {
									const tabData = parsedData.data
									const fileRelativePath =
										tabData.fileData?.relative_file_path || tabData.filePath
									const fileName =
										tabData.title || tabData.fileData?.file_name || "未命名文件"

									if (fileRelativePath) {
										// Calculate relative path from document to file
										const href = documentPath
											? calculateRelativePath(documentPath, fileRelativePath)
											: fileRelativePath
										links.push({ href, title: fileName })
									}
									break
								}
								case DRAG_TYPE.ProjectFile:
								case DRAG_TYPE.ProjectDirectory: {
									const attachmentData = parsedData.data
									const fileRelativePath = attachmentData.relative_file_path
									const fileName =
										attachmentData.display_filename ||
										attachmentData.file_name ||
										attachmentData.filename ||
										"未命名文件"

									if (fileRelativePath) {
										// Calculate relative path from document to file
										const href = documentPath
											? calculateRelativePath(documentPath, fileRelativePath)
											: fileRelativePath
										links.push({ href, title: fileName })
									}
									break
								}
								case DRAG_TYPE.MultipleFiles: {
									const filesData = parsedData.data
									filesData.forEach((file) => {
										const fileRelativePath = file.relative_file_path
										const fileName =
											file.display_filename ||
											file.file_name ||
											file.filename ||
											"未命名文件"

										if (fileRelativePath) {
											// Calculate relative path from document to file
											const href = documentPath
												? calculateRelativePath(
														documentPath,
														fileRelativePath,
													)
												: fileRelativePath
											links.push({ href, title: fileName })
										}
									})
									break
								}
								default:
									return false
							}

							if (links.length === 0) {
								return false
							}

							return (
								runActiveEditor(
									this.editor,
									(editor) => {
										// Insert links sequentially
										links.forEach((link, index) => {
											if (index > 0) {
												// Add space between multiple links
												editor.chain().insertContent(" ").run()
											}

											// Encode URL if it contains spaces to ensure markdown parsing works correctly
											// According to Markdown spec, URLs with spaces should be URL-encoded
											// We use encodeURI to preserve path structure while encoding spaces
											let encodedHref = link.href
											if (link.href && /[\s<>]/.test(link.href)) {
												// Use encodeURI to encode spaces while preserving path separators and other valid characters
												// This ensures markdown parsing works while maintaining valid URLs for HTML rendering
												encodedHref = encodeURI(link.href)
											}

											// Insert link with title
											editor
												.chain()
												.insertContent({
													type: "text",
													text: link.title,
													marks: [
														{
															type: "link",
															attrs: {
																href: encodedHref,
																title: link.title,
															},
														},
													],
												})
												.run()
										})

										return true
									},
									false,
								) ?? false
							)
						} catch (error) {
							console.error("Error parsing drag data:", error)
							return false
						}
					},
				},
			}),
		]
	},
})

export default CustomLinkNode
