import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type ElementType } from "../../document/types"
import type { SelectionContentSnapshot } from "../selection/selectionContentCollector"
import type {
	ConnectionAssociationSourceKind,
	ConnectionAssociationTargetKind,
} from "./ConnectionAssociationSeedManager"

export type ConnectionMenuAssociableCreateKind = "text" | "image-generator" | "video-generator"

function getAssociationSourceKind(type: ElementType): ConnectionAssociationSourceKind | null {
	if (type === ElementTypeEnum.Text) return "text"
	if (type === ElementTypeEnum.Image) return "image"
	if (type === ElementTypeEnum.Video) return "video"
	if (type === ElementTypeEnum.Audio) return "audio"
	return null
}

export function getConnectionAssociationTargetKind(
	kind: ConnectionMenuAssociableCreateKind,
): ConnectionAssociationTargetKind | null {
	if (kind === "image-generator" || kind === "video-generator") return kind
	return null
}

export function registerConnectionMenuAssociationSeed(options: {
	canvas: Canvas
	kind: ConnectionMenuAssociableCreateKind
	originSide: "left" | "right"
	snapshot: SelectionContentSnapshot
	targetElementId: string
}): string | null {
	if (options.originSide !== "right") return null
	const targetKind = getConnectionAssociationTargetKind(options.kind)
	if (!targetKind) return null
	const orderedSources = options.snapshot.items.flatMap((item) => {
		const kind = getAssociationSourceKind(item.type)
		return kind ? [{ elementId: item.elementId, kind }] : []
	})
	if (orderedSources.length === 0) return null

	return options.canvas.connectionAssociationSeedManager.register({
		targetElementId: options.targetElementId,
		targetKind,
		rootElementIds: options.snapshot.rootElementIds,
		orderedSources,
		originRevision: options.snapshot.selectionRevision,
		createdBy: "connection-menu",
		mediaRole: "reference",
	})
}
