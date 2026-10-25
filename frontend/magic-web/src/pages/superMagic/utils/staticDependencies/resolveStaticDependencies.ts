import {
	buildAttachmentIndex,
	type AttachmentIndex,
} from "@/pages/superMagic/components/TopicFilesButton/utils/attachmentIndex"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getStaticDependencyParser } from "./parserRegistry"
import type { StaticDependencyAttachment, StaticDependencyResult } from "./types"

const EMPTY_RESULT: StaticDependencyResult = {
	fileType: null,
	dependencyFileIds: [],
	dependencyTransferFileIds: [],
	missingResourcePaths: [],
}

/**
 * Reports whether a file has a registered dependency parser.
 * @example HTML/Markdown → `true`; PNG → `false`
 */
export function supportsStaticDependencies(file: StaticDependencyAttachment): boolean {
	return Boolean(getStaticDependencyParser(file))
}

/**
 * Resolves local dependencies for one file; batches return empty.
 * @example `["readme-md"]` → `["cover-image"]`
 */
export async function resolveSingleDocumentStaticDependencies({
	fileIds,
	attachments,
	attachmentIndex,
	fileApi,
	signal,
}: {
	fileIds: string[]
	attachments: StaticDependencyAttachment[]
	attachmentIndex?: AttachmentIndex
	fileApi?: Pick<FileApi, "getFileContentById">
	signal?: AbortSignal
}): Promise<StaticDependencyResult> {
	signal?.throwIfAborted()
	if (fileIds.length !== 1) return EMPTY_RESULT

	const resolvedAttachmentIndex =
		attachmentIndex ?? buildAttachmentIndex(attachments, { includeHidden: true })
	const file = resolvedAttachmentIndex.getItemById(fileIds[0])
	if (!file?.file_id) return EMPTY_RESULT

	const parser = getStaticDependencyParser(file)
	if (!parser) return EMPTY_RESULT

	const content = await (fileApi?.getFileContentById ?? getFileContentById)(file.file_id, {
		responseType: "text",
		signal,
	})
	signal?.throwIfAborted()
	if (typeof content !== "string") {
		throw new Error("Static dependency analysis requires text content")
	}

	return parser.resolve({ file, content, attachments, attachmentIndex: resolvedAttachmentIndex })
}

/**
 * Merges and deduplicates dependency IDs when enabled.
 * @example `(["doc"], ["image", "doc"], true)` → `["doc", "image"]`
 */
export function mergeStaticDependencyFileIds(
	fileIds: string[],
	dependencyFileIds: string[],
	includeDependencies: boolean,
): string[] {
	return includeDependencies
		? [...new Set([...fileIds, ...dependencyFileIds])]
		: [...new Set(fileIds)]
}
