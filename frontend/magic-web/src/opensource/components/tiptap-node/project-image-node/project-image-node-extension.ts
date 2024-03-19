import { mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react"
import type { ImageOptions } from "@tiptap/extension-image"
import { Image as TiptapImage } from "@tiptap/extension-image"
import type { Transaction, EditorState } from "@tiptap/pm/state"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { ProjectImageNodeView } from "./project-image-node-view"
import { parseProjectImageTitle, toMarkdownImageSource } from "./project-image-metadata"
import { isTempPath } from "./temp-path-utils"

export interface ProjectImageNodeOptions extends ImageOptions {
	/**
	 * URL resolver function to convert relative path to absolute URL
	 * @required
	 */
	urlResolver: (relativePath: string) => string | Promise<string>

	/**
	 * Error callback
	 * @optional
	 */
	onError?: (error: Error) => void
}

declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		projectImage: {
			/**
			 * Set an image with project-specific attributes
			 */
			setProjectImage: (options: {
				src?: string
				alt?: string
				title?: string
				uploading?: boolean
				uploadProgress?: number
			}) => ReturnType

			/**
			 * Update project image attributes
			 */
			updateProjectImage: (
				src: string,
				attrs: Partial<{
					width: number
					height: number
				}>,
			) => ReturnType

			/**
			 * Update project image upload status
			 */
			updateProjectImageUploadStatus: (
				src: string,
				status: {
					uploading?: boolean
					uploadProgress?: number
					uploadError?: string | null
				},
			) => ReturnType

			/**
			 * Update project image alignment
			 */
			updateProjectImageAlign: (
				src: string,
				align: "left" | "center" | "right" | null,
			) => ReturnType

			/**
			 * Update project image object fit
			 */
			updateProjectImageObjectFit: (
				src: string,
				objectFit: "cover" | "contain" | "fill",
			) => ReturnType

			/**
			 * Delete a project image node
			 */
			deleteProjectImage: (src: string) => ReturnType
		}
	}
}

/**
 * Tiptap node extension for rendering images stored in project
 * This node displays images uploaded via the SaveImageToProjectExtension
 * Extends the standard Image node with project-specific features
 */
export const ProjectImageNode = TiptapImage.extend<ProjectImageNodeOptions>({
	group: "block",

	draggable: true,

	atom: true,

	addOptions() {
		const parentOptions = this.parent?.() || {}
		return {
			...parentOptions,
			inline: false,
			allowBase64: false,
			urlResolver: (relativePath: string) => relativePath,
			onError: undefined,
		} as ProjectImageNodeOptions
	},

	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				parseHTML: (element) => {
					// First try data-width attribute
					const dataWidth = element.getAttribute("data-width")
					if (dataWidth) return parseInt(dataWidth, 10)

					// Then try parsing from title attribute
					const title = element.getAttribute("title")
					if (title) {
						const { width } = parseProjectImageTitle(title)
						return width
					}

					return null
				},
				renderHTML: (attributes) => {
					if (!attributes.width) return {}
					return { "data-width": attributes.width }
				},
			},
			height: {
				default: null,
				parseHTML: (element) => {
					// First try data-height attribute
					const dataHeight = element.getAttribute("data-height")
					if (dataHeight) return parseInt(dataHeight, 10)

					// Then try parsing from title attribute
					const title = element.getAttribute("title")
					if (title) {
						const { height } = parseProjectImageTitle(title)
						return height
					}

					return null
				},
				renderHTML: (attributes) => {
					if (!attributes.height) return {}
					return { "data-height": attributes.height }
				},
			},
			title: {
				default: null,
				// Don't store title as it's parsed into width/height
				parseHTML: () => null,
				renderHTML: () => ({}),
			},
			uploading: {
				default: false,
				parseHTML: (element) => element.getAttribute("data-uploading") === "true",
				renderHTML: (attributes) => {
					if (!attributes.uploading) return {}
					return { "data-uploading": "true" }
				},
			},
			uploadProgress: {
				default: 0,
				parseHTML: (element) => {
					const progress = element.getAttribute("data-upload-progress")
					return progress ? parseInt(progress, 10) : 0
				},
				renderHTML: (attributes) => {
					if (!attributes.uploadProgress) return {}
					return { "data-upload-progress": attributes.uploadProgress }
				},
			},
			uploadError: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-upload-error"),
				renderHTML: (attributes) => {
					if (!attributes.uploadError) return {}
					return { "data-upload-error": attributes.uploadError }
				},
			},
			align: {
				default: null,
				parseHTML: (element) => {
					// First try data-align attribute
					const dataAlign = element.getAttribute("data-align")
					if (dataAlign) return dataAlign

					// Then try parsing from parent container's text-align style
					const parent = element.parentElement
					if (parent && parent.style.textAlign) {
						return parent.style.textAlign
					}

					return null
				},
				renderHTML: (attributes) => {
					if (!attributes.align) return {}
					return { "data-align": attributes.align }
				},
			},
			objectFit: {
				default: "cover",
				parseHTML: (element) => {
					const dataObjectFit = element.getAttribute("data-object-fit")
					if (dataObjectFit) return dataObjectFit

					const style = element.getAttribute("style")
					if (style) {
						const match = style.match(/object-fit:\s*(cover|contain|fill)/)
						if (match) return match[1]
					}

					return undefined
				},
				renderHTML: (attributes) => {
					if (!attributes.objectFit) return {}
					return { "data-object-fit": attributes.objectFit }
				},
			},
		}
	},

	/**
	 * Parse HTML to detect images (both project images and external URLs)
	 * Handles two formats:
	 * 1. Aligned images wrapped in div with text-align style
	 * 2. Standard img tags with any valid src (relative paths or HTTP/HTTPS URLs)
	 */
	parseHTML() {
		return [
			// Match div with text-align style containing img (for aligned images)
			// Format: <div style="text-align: center"><img src="./image.png" /></div>
			{
				tag: 'div[style*="text-align"]',
				getAttrs: (dom) => {
					if (typeof dom === "string") return false
					const element = dom as HTMLElement

					// Check if div contains an img element
					const img = element.querySelector("img")
					if (!img) return false

					const src = img.getAttribute("src")
					// Accept all image sources (both relative paths and HTTP/HTTPS URLs)
					if (!src) return false

					// Extract text-align value from div's style attribute
					// Matches: "text-align: left", "text-align:center", etc.
					const divStyle = element.getAttribute("style")
					const alignMatch = divStyle?.match(/text-align:\s*(left|center|right)/)
					const align = alignMatch ? alignMatch[1] : null

					// Get dimensions from img width/height attributes
					const widthAttr = img.getAttribute("width")
					const heightAttr = img.getAttribute("height")

					// Also try to get dimensions from img's style attribute
					const imgStyle = img.getAttribute("style")
					let styleWidth: number | null = null
					let styleHeight: number | null = null
					let styleObjectFit: string | null = null
					if (imgStyle) {
						const widthMatch = imgStyle.match(/width:\s*(\d+)px/)
						const heightMatch = imgStyle.match(/height:\s*(\d+)px/)
						styleWidth = widthMatch ? parseInt(widthMatch[1], 10) : null
						styleHeight = heightMatch ? parseInt(heightMatch[1], 10) : null
						const objectFitMatch = imgStyle.match(/object-fit:\s*(cover|contain|fill)/)
						styleObjectFit = objectFitMatch ? objectFitMatch[1] : null
					}

					const attrs: Record<string, unknown> = {
						src,
						alt: img.getAttribute("alt"),
					}

					if (widthAttr || styleWidth) {
						attrs.width = widthAttr ? parseInt(widthAttr, 10) : styleWidth
					}
					if (heightAttr || styleHeight) {
						attrs.height = heightAttr ? parseInt(heightAttr, 10) : styleHeight
					}
					if (align) {
						attrs.align = align
					}
					if (styleObjectFit) {
						attrs.objectFit = styleObjectFit
					}

					return attrs
				},
			},
			// Match standard img tags (both project images and external URLs)
			// Format: <img src="./image.png" width="300" height="200" />
			// Format: <img src="https://example.com/image.png" width="300" height="200" />
			{
				tag: "img[src]",
				getAttrs: (dom) => {
					if (typeof dom === "string") return false
					const element = dom as HTMLElement
					const src = element.getAttribute("src")

					// Accept all valid image sources
					if (src) {
						// Try to get dimensions from multiple sources (in priority order):
						// 1. Standard HTML width/height attributes
						// 2. Style attribute (width/height in CSS)
						// 3. data-width/data-height attributes
						// 4. Parse from title attribute
						const widthAttr = element.getAttribute("width")
						const heightAttr = element.getAttribute("height")
						const dataWidth = element.getAttribute("data-width")
						const dataHeight = element.getAttribute("data-height")
						const title = element.getAttribute("title")
						const dimensions = title
							? parseProjectImageTitle(title)
							: { width: null, height: null }

						// Parse dimensions from style attribute if present
						// Format: style="width: 300px; height: 200px"
						const style = element.getAttribute("style")
						let styleWidth: number | null = null
						let styleHeight: number | null = null
						let styleObjectFit: string | null = null
						if (style) {
							const widthMatch = style.match(/width:\s*(\d+)px/)
							const heightMatch = style.match(/height:\s*(\d+)px/)
							styleWidth = widthMatch ? parseInt(widthMatch[1], 10) : null
							styleHeight = heightMatch ? parseInt(heightMatch[1], 10) : null
							const objectFitMatch = style.match(/object-fit:\s*(cover|contain|fill)/)
							styleObjectFit = objectFitMatch ? objectFitMatch[1] : null
						}

						// Parse width: prefer HTML width attribute, then style, then data-width, then title
						const width = widthAttr
							? parseInt(widthAttr, 10)
							: styleWidth ||
								(dataWidth ? parseInt(dataWidth, 10) : null) ||
								dimensions.width

						// Parse height: prefer HTML height attribute, then style, then data-height, then title
						const height = heightAttr
							? parseInt(heightAttr, 10)
							: styleHeight ||
								(dataHeight ? parseInt(dataHeight, 10) : null) ||
								dimensions.height

						const attrs: Record<string, unknown> = {
							src,
							alt: element.getAttribute("alt"),
						}

						if (width) {
							attrs.width = width
						}
						if (height) {
							attrs.height = height
						}
						if (styleObjectFit) {
							attrs.objectFit = styleObjectFit
						}

						return attrs
					}
					return false
				},
			},
		]
	},

	renderHTML({ node, HTMLAttributes }) {
		const {
			src,
			alt,
			width,
			height,
			align,
			objectFit,
			uploading,
			uploadProgress,
			uploadError,
		} = node.attrs

		// Build img attributes
		const imgAttrs: Record<string, string> = {
			src: src || "",
		}

		if (alt) imgAttrs.alt = alt
		if (width) imgAttrs.width = String(width)
		if (height) imgAttrs.height = String(height)

		// Add data attributes for special states
		if (uploading) imgAttrs["data-uploading"] = "true"
		if (uploadProgress) imgAttrs["data-upload-progress"] = String(uploadProgress)
		if (uploadError) imgAttrs["data-upload-error"] = uploadError
		if (align) imgAttrs["data-align"] = align
		if (objectFit) imgAttrs["data-object-fit"] = objectFit

		// Build style for object-fit and dimensions
		const styles: string[] = []
		if (objectFit) styles.push(`object-fit: ${objectFit}`)
		if (width) styles.push(`width: ${width}px`)
		if (height) styles.push(`height: ${height}px`)
		if (styles.length > 0) {
			imgAttrs.style = styles.join("; ")
		}

		// Wrap in div with text-align if align is specified
		if (align) {
			return [
				"div",
				mergeAttributes(this.options.HTMLAttributes ?? {}, {
					style: `text-align: ${align}`,
					"data-type": "image",
				}),
				["img", imgAttrs],
			]
		}

		// Return plain img without wrapper
		return [
			"img",
			mergeAttributes(this.options.HTMLAttributes ?? {}, imgAttrs, HTMLAttributes, {
				"data-type": "image",
			}),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(ProjectImageNodeView, {
			contentDOMElementTag: "div",
		})
	},

	addCommands() {
		return {
			...this.parent?.(),
			setProjectImage:
				(options) =>
				({ commands }) => {
					return commands.insertContent({
						type: this.name,
						attrs: options,
					})
				},

			updateProjectImage:
				(
					src: string,
					attrs: Partial<{
						width: number
						height: number
					}>,
				) =>
				({ tr, state }: { tr: Transaction; state: EditorState }) => {
					let updated = false
					state.doc.descendants((node: ProseMirrorNode, pos: number) => {
						if (node.type.name === this.name && node.attrs.src === src) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								...attrs,
							})
							updated = true
							return false
						}
					})
					return updated
				},

			updateProjectImageUploadStatus:
				(
					src: string,
					status: {
						uploading?: boolean
						uploadProgress?: number
						uploadError?: string | null
					},
				) =>
				({ tr, state }: { tr: Transaction; state: EditorState }) => {
					let updated = false
					state.doc.descendants((node: ProseMirrorNode, pos: number) => {
						if (node.type.name === this.name && node.attrs.src === src) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								...status,
							})
							updated = true
							return false
						}
					})
					return updated
				},

			updateProjectImageAlign:
				(src: string, align: "left" | "center" | "right" | null) =>
				({ tr, state }: { tr: Transaction; state: EditorState }) => {
					let updated = false
					state.doc.descendants((node: ProseMirrorNode, pos: number) => {
						if (node.type.name === this.name && node.attrs.src === src) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								align,
							})
							updated = true
							return false
						}
					})
					return updated
				},

			updateProjectImageObjectFit:
				(src: string, objectFit: "cover" | "contain" | "fill") =>
				({ tr, state }: { tr: Transaction; state: EditorState }) => {
					let updated = false
					state.doc.descendants((node: ProseMirrorNode, pos: number) => {
						if (node.type.name === this.name && node.attrs.src === src) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								objectFit,
							})
							updated = true
							return false
						}
					})
					return updated
				},

			deleteProjectImage:
				(src: string) =>
				({ tr, state }: { tr: Transaction; state: EditorState }) => {
					let deleted = false
					state.doc.descendants((node: ProseMirrorNode, pos: number) => {
						if (node.type.name === this.name && node.attrs.src === src) {
							tr.delete(pos, pos + node.nodeSize)
							deleted = true
							return false
						}
					})
					return deleted
				},
		}
	},

	addStorage() {
		return {
			urlResolver: this.options.urlResolver,
			onError: this.options.onError,
			markdown: {
				/**
				 * Serialize project image node to markdown format
				 * Skips temporary/uploading nodes and exports images with proper formatting
				 */
				serialize(
					state: {
						write: (content: string) => void
						closeBlock: (node: ProseMirrorNode) => void
					},
					node: ProseMirrorNode,
				) {
					// Skip temporary nodes (uploading or failed)
					if (node.attrs.uploading || node.attrs.uploadError) {
						// Do not serialize temporary or failed nodes
						state.closeBlock(node)
						return
					}

					// Skip nodes without valid src
					if (!node.attrs.src || isTempPath(node.attrs.src)) {
						state.closeBlock(node)
						return
					}

					const { src, width, height, alt, align, objectFit } = node.attrs

					// Use alt text if available, otherwise use empty string
					const altText = alt || ""

					const imageUrl = toMarkdownImageSource(src)

					// Build objectFit style attribute if not default
					const objectFitAttr =
						objectFit && objectFit !== "cover"
							? ` style="object-fit: ${objectFit}"`
							: ""
					const widthAttr = width ? ` width="${width}"` : ""
					const heightAttr = height ? ` height="${height}"` : ""
					const altAttr = altText ? ` alt="${altText}"` : ""

					// If align is specified, use div wrapper with text-align style
					if (align) {
						state.write(
							`<div style="text-align: ${align}"><img src="${imageUrl}"${altAttr}${widthAttr}${heightAttr}${objectFitAttr} /></div>`,
						)
					} else if (width || height || (objectFit && objectFit !== "cover")) {
						state.write(
							`<img src="${imageUrl}"${altAttr}${widthAttr}${heightAttr}${objectFitAttr} />`,
						)
					} else {
						// Serialize project image as standard markdown image with relative path
						// Format: ![alt](./relative/path)
						state.write(`![${altText}](${imageUrl})`)
					}

					state.closeBlock(node)
				},
				parse: {
					/**
					 * Update markdown-it parsing rule to handle project images
					 * Detects relative paths and parses size syntax
					 */
					updateRule(rule: {
						name: string
						getContent?: (
							tokens: Array<{ attrs?: Array<[string, string]> }>,
							i: number,
						) => Array<{ type: string; attrs: Record<string, unknown> }>
					}) {
						// Only modify the image rule
						if (rule.name !== "image") return rule

						const originalGetContent = rule.getContent
						rule.getContent = function (
							tokens: Array<{ attrs?: Array<[string, string]> }>,
							i: number,
						) {
							const token = tokens[i]
							const altAttr = token.attrs?.find((attr) => attr[0] === "alt")
							const srcAttr = token.attrs?.find((attr) => attr[0] === "src")
							const src = srcAttr ? srcAttr[1] : null

							// Accept all image sources (both relative paths and HTTP/HTTPS URLs)
							if (src) {
								const titleAttr = token.attrs?.find((attr) => attr[0] === "title")
								const { width, height } = parseProjectImageTitle(
									titleAttr ? titleAttr[1] : null,
								)

								// Return as array for Tiptap - use correct node type name
								return [
									{
										type: "image",
										attrs: {
											src,
											width,
											height,
											alt: altAttr ? altAttr[1] : null,
										},
									},
								]
							}

							// Fallback to original getContent if no src
							return originalGetContent
								? originalGetContent.call(this, tokens, i)
								: []
						}

						return rule
					},
				},
			},
		}
	},
})

export default ProjectImageNode
