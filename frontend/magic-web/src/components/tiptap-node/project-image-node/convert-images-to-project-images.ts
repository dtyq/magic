import type { EditorState, Transaction } from "@tiptap/pm/state"
import type { NodeType } from "@tiptap/pm/model"
import { parseProjectImageTitle } from "./project-image-metadata"

interface ConvertImagesOptions {
	state: EditorState
	tr: Transaction
	projectImageType: NodeType | null | undefined
	logger?: Pick<typeof console, "log" | "error">
}

/**
 * Convert images to project images
 * @param param0 {
 *   state: EditorState
 *   tr: Transaction
 *   projectImageType: NodeType | null | undefined
 *   logger?: Pick<typeof console, "log" | "error">
 * }
 * @returns {
 *   modified: boolean
 * }
 */
export function convertImagesToProjectImages({
	state,
	tr,
	projectImageType,
	logger = console,
}: ConvertImagesOptions): any {
	if (!projectImageType) {
		logger.error("[ProjectImage] Missing projectImage node type in schema.")
		return false
	}

	let modified = false
	const replacements: Array<{ pos: number; node: any; nodeSize: number }> = []

	state.doc.descendants((node, pos) => {
		if (node.type.name !== "image") {
			return
		}

		const { alt, src, title } = node.attrs

		if (!alt || typeof alt !== "string" || !alt.startsWith("project_file:")) {
			return
		}

		const file_id = alt.substring(13)

		const { width, height } = parseProjectImageTitle(title)

		const projectImageNode = projectImageType.create({
			file_id,
			src,
			width,
			height,
		})

		if (projectImageNode) {
			replacements.push({
				pos,
				node: projectImageNode,
				nodeSize: node.nodeSize,
			})
			modified = true
		} else {
			logger.error("[ProjectImage] Failed to create projectImage node.")
		}
	})

	if (replacements.length > 0) {
		replacements.reverse().forEach(({ pos, node, nodeSize }) => {
			tr.replaceRangeWith(pos, pos + nodeSize, node)
		})
	}

	return modified
}
