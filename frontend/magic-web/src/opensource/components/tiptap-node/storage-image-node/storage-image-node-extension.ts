import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react"
import type { ImageStorageInterface } from "@/opensource/services/tiptap-image-storage"
import { StorageImageNodeView } from "./storage-image-node-view"

export interface StorageImageNodeOptions {
	/**
	 * Image storage implementation
	 * @required
	 */
	imageStorage: ImageStorageInterface

	/**
	 * Error callback
	 * @optional
	 */
	onError?: (error: Error) => void

	/**
	 * HTML attributes to add to the node element
	 * @default {}
	 */
	HTMLAttributes?: Record<string, unknown>
}

declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		storageImage: {
			/**
			 * Insert a storage image node
			 */
			insertStorageImage: (attrs: {
				id: string
				alt?: string
				width?: number
				height?: number
				align?: "left" | "center" | "right" | null
				objectFit?: "cover" | "contain" | "fill"
			}) => ReturnType

			/**
			 * Update storage image attributes
			 */
			updateStorageImage: (
				id: string,
				attrs: Partial<{
					alt: string
					width: number
					height: number
				}>,
			) => ReturnType

			/**
			 * Update storage image alignment
			 */
			updateStorageImageAlign: (
				id: string,
				align: "left" | "center" | "right" | null,
			) => ReturnType

			/**
			 * Update storage image object fit
			 */
			updateStorageImageObjectFit: (
				id: string,
				objectFit: "cover" | "contain" | "fill",
			) => ReturnType

			/**
			 * Delete a storage image node and its stored data
			 */
			deleteStorageImage: (id: string) => ReturnType
		}
	}
}

/**
 * Tiptap node extension for rendering images stored in IndexedDB
 * This node displays images stored via the SaveImageToStorageExtension
 */
export const StorageImageNode = Node.create<StorageImageNodeOptions>({
	name: "storageImage",

	group: "block",

	draggable: true,

	atom: true,

	addOptions() {
		return {
			imageStorage: null!,
			onError: undefined,
			HTMLAttributes: {},
		}
	},

	addAttributes() {
		return {
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-id"),
				renderHTML: (attributes) => {
					if (!attributes.id) return {}
					return { "data-id": attributes.id }
				},
			},
			alt: {
				default: null,
				parseHTML: (element) => element.getAttribute("alt"),
				renderHTML: (attributes) => {
					if (!attributes.alt) return {}
					return { alt: attributes.alt }
				},
			},
			width: {
				default: null,
				parseHTML: (element) => {
					const width = element.getAttribute("data-width")
					return width ? parseInt(width, 10) : null
				},
				renderHTML: (attributes) => {
					if (!attributes.width) return {}
					return { "data-width": attributes.width }
				},
			},
			height: {
				default: null,
				parseHTML: (element) => {
					const height = element.getAttribute("data-height")
					return height ? parseInt(height, 10) : null
				},
				renderHTML: (attributes) => {
					if (!attributes.height) return {}
					return { "data-height": attributes.height }
				},
			},
			align: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-align"),
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

					return "cover"
				},
				renderHTML: (attributes) => {
					if (!attributes.objectFit) return {}
					return { "data-object-fit": attributes.objectFit }
				},
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="storage-image"]',
				getAttrs: (dom) => {
					if (typeof dom === "string") return false
					const element = dom as HTMLElement

					const widthAttr = element.getAttribute("data-width")
					const heightAttr = element.getAttribute("data-height")

					return {
						id: element.getAttribute("data-id"),
						alt: element.getAttribute("data-alt"),
						width: widthAttr ? parseInt(widthAttr, 10) : null,
						height: heightAttr ? parseInt(heightAttr, 10) : null,
						align: element.getAttribute("data-align"),
						objectFit: element.getAttribute("data-object-fit") || "cover",
					}
				},
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes, {
				"data-type": "storage-image",
			}),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(StorageImageNodeView, {
			contentDOMElementTag: "div",
		})
	},

	addCommands() {
		return {
			insertStorageImage:
				(attrs) =>
				({ commands }) => {
					return commands.insertContent({
						type: this.name,
						attrs,
					})
				},

			updateStorageImage:
				(id, attrs) =>
				({ tr, state }) => {
					let updated = false
					state.doc.descendants((node, pos) => {
						if (node.type.name === this.name && node.attrs.id === id) {
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

			updateStorageImageAlign:
				(id: string, align: "left" | "center" | "right" | null) =>
				({ tr, state }) => {
					let updated = false
					state.doc.descendants((node, pos) => {
						if (node.type.name === this.name && node.attrs.id === id) {
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

			updateStorageImageObjectFit:
				(id: string, objectFit: "cover" | "contain" | "fill") =>
				({ tr, state }) => {
					let updated = false
					state.doc.descendants((node, pos) => {
						if (node.type.name === this.name && node.attrs.id === id) {
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

			deleteStorageImage:
				(id) =>
				({ tr, state }) => {
					let deleted = false
					state.doc.descendants((node, pos) => {
						if (node.type.name === this.name && node.attrs.id === id) {
							tr.delete(pos, pos + node.nodeSize)
							// Delete from storage asynchronously
							this.options.imageStorage.deleteImage(id).catch((error) => {
								this.options.onError?.(error)
							})
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
			imageStorage: this.options.imageStorage,
			onError: this.options.onError,
			markdown: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				serialize(state: any, node: any) {
					// Serialize storage image as div with data attributes
					// Format: <div data-type="storage-image" data-id="xxx" ...></div>
					const { id, alt, width, height, align, objectFit } = node.attrs

					if (!id) {
						// Fallback for invalid node
						state.write("")
						state.closeBlock(node)
						return
					}

					// Build div with data attributes
					const dataType = 'data-type="storage-image"'
					const dataId = `data-id="${id}"`
					const dataAlt = alt ? ` data-alt="${alt}"` : ""
					const dataWidth = width ? ` data-width="${width}"` : ""
					const dataHeight = height ? ` data-height="${height}"` : ""
					const dataAlign = align ? ` data-align="${align}"` : ""
					const dataObjectFit =
						objectFit && objectFit !== "cover" ? ` data-object-fit="${objectFit}"` : ""

					state.write(
						`<div ${dataType} ${dataId}${dataAlt}${dataWidth}${dataHeight}${dataAlign}${dataObjectFit}></div>`,
					)
					state.closeBlock(node)
				},
			},
		}
	},
})

export default StorageImageNode
