import type { DirectoryMentionData, DirectoryMentionMetadata } from "../types"

interface GetFolderMentionDataParams {
	directoryId?: string | number | null
	directoryName?: string | number | null
	directoryPath?: string | number | null
	directoryMetadata?: unknown
}

export function getFolderMentionData({
	directoryId,
	directoryName,
	directoryPath,
	directoryMetadata,
}: GetFolderMentionDataParams): DirectoryMentionData {
	return {
		directory_id: getStringValue(directoryId),
		directory_name: getStringValue(directoryName),
		directory_path: getStringValue(directoryPath),
		directory_metadata: pickDirectoryMentionMetadata(directoryMetadata),
	}
}

function pickDirectoryMentionMetadata(metadata: unknown): DirectoryMentionMetadata {
	if (!isRecord(metadata)) return {}

	const nextMetadata: DirectoryMentionMetadata = {}

	if (typeof metadata.version === "string" || typeof metadata.version === "number") {
		nextMetadata.version = metadata.version
	}
	if (typeof metadata.type === "string") nextMetadata.type = metadata.type
	if (typeof metadata.name === "string") nextMetadata.name = metadata.name

	return nextMetadata
}

function getStringValue(value: unknown): string {
	if (typeof value === "string") return value
	if (value === undefined || value === null) return ""

	return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
