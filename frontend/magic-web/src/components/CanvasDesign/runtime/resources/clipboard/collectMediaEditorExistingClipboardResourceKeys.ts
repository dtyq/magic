import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { getCanvasResourceReferenceIdentity } from "../../shared/path/canvasResourcePath"
import { collectExistingClipboardResourceKeys } from "./CanvasClipboardPasteController"

export interface MediaEditorExistingClipboardMentionBinding {
	path?: string
	fileId?: string
	sourceFileId?: string
}

export interface MediaEditorExistingClipboardReferenceInfo {
	path?: string
	file_id?: string
	source_file_id?: string
}

function identitiesForPaths(
	paths: Array<string | undefined | null>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): Array<string | undefined> {
	return paths.map((path) =>
		path ? getCanvasResourceReferenceIdentity(path, resolveResourceReference) : undefined,
	)
}

function mentionBindingKeys(
	mentionBindings: MediaEditorExistingClipboardMentionBinding[] | undefined,
): Array<string | undefined> {
	return (mentionBindings ?? []).flatMap((binding) => [
		binding.path,
		binding.fileId,
		binding.sourceFileId,
	])
}

/** Image paste: current references + resolver identity + mention file ids. */
export function collectImageEditorExistingClipboardResourceKeys(input: {
	referencePaths: string[]
	referenceFileInfos?: Array<{ path?: string }>
	mentionBindings?: MediaEditorExistingClipboardMentionBinding[]
	resolveResourceReference?: ResolveCanvasResourceReference
}): string[] {
	return collectExistingClipboardResourceKeys([
		...input.referencePaths,
		...identitiesForPaths(input.referencePaths, input.resolveResourceReference),
		...(input.referenceFileInfos ?? []).map((info) => info.path),
		...mentionBindingKeys(input.mentionBindings),
	])
}

/** Video paste: references, frame slots, file ids, and mention bindings. */
export function collectVideoEditorExistingClipboardResourceKeys(input: {
	referencePaths: string[]
	referenceAssetInfos?: MediaEditorExistingClipboardReferenceInfo[]
	framePaths?: Array<string | undefined | null>
	mentionBindings?: MediaEditorExistingClipboardMentionBinding[]
	resolveResourceReference?: ResolveCanvasResourceReference
}): string[] {
	const framePaths = input.framePaths ?? []
	return collectExistingClipboardResourceKeys([
		...input.referencePaths,
		...identitiesForPaths(input.referencePaths, input.resolveResourceReference),
		...framePaths,
		...identitiesForPaths(framePaths, input.resolveResourceReference),
		...(input.referenceAssetInfos ?? []).flatMap((info) => [
			info.path,
			info.file_id,
			info.source_file_id,
		]),
		...mentionBindingKeys(input.mentionBindings),
	])
}
