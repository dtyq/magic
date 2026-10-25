import {
	ElementTypeEnum,
	type LayerElement,
} from "@/components/CanvasDesign/runtime/document/types"

export interface CanvasResolvedMediaFile {
	file_id?: string | number
}

/** Find all Canvas media elements whose content resolves to one project media file. */
export function findCanvasMediaElementIdsByFileId(
	elements: LayerElement[],
	mediaFileId: string,
	resolveFileBySrc: (src: string) => CanvasResolvedMediaFile | null,
): string[] {
	const elementIds = new Set<string>()
	const visit = (items: LayerElement[]) => {
		for (const element of items) {
			if (element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group) {
				visit(element.children || [])
				continue
			}
			if (
				element.type !== ElementTypeEnum.Image &&
				element.type !== ElementTypeEnum.Video &&
				element.type !== ElementTypeEnum.Audio
			) {
				continue
			}
			for (const content of element.contents) {
				if (!content.src) continue
				const fileId = resolveFileBySrc(content.src)?.file_id
				if (fileId !== undefined && fileId !== null && String(fileId) === mediaFileId) {
					elementIds.add(element.id)
				}
			}
		}
	}
	visit(elements)
	return Array.from(elementIds)
}
