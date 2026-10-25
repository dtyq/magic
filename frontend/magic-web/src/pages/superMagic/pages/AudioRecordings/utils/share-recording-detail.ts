import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { RecordingDetailCapabilities } from "../types/recording-detail-capabilities"
import type { MagicProjectConfig } from "../types/recording-detail"

interface ShareAttachmentSnapshot {
	tree?: AttachmentItem[]
	list?: AttachmentItem[]
}

export interface ShareRecordingDisplayConfig extends Partial<MagicProjectConfig> {
	metadata?: MagicProjectConfig["metadata"]
	files?: Record<string, string>
}

interface BuildShareRecordingMagicProjectConfigInput {
	magicProjectConfig?: MagicProjectConfig | null
	audioDisplayConfig?: ShareRecordingDisplayConfig | null
}

/** Keeps the share route check explicit so audio-only branching never depends on truthy string coercion. */
export function isAudioProjectMode(projectMode: unknown): boolean {
	return projectMode === "audio"
}

/** Mounts the audio share shell only for audio-mode shares that really carry a recording bundle. */
export function shouldRenderAudioRecordingShareShell(input: {
	projectMode: unknown
	attachments?: ShareAttachmentSnapshot | null
}): boolean {
	const { projectMode, attachments } = input
	if (!isAudioProjectMode(projectMode)) return false

	return hasSharedRecordingBundle(attachments)
}

/**
 * Detects recording bundle content from the audio display config that travels with the shared rows.
 * The tree and the flat list are both scanned because either shape may hydrate the snapshot first.
 */
function hasSharedRecordingBundle(attachments?: ShareAttachmentSnapshot | null): boolean {
	const items = [
		...flattenShareAttachments(attachments?.tree || []),
		...flattenShareAttachments(attachments?.list || []),
	]

	return items.some(isAudioShareTarget)
}

/**
 * Resolves an explicitly selected audio folder or entry file in an ordinary project share.
 * The resolver never picks an audio folder implicitly, so a share with no default target keeps
 * the normal file-list experience even when several audio bundles are present.
 */
export function resolveAudioFolderShareTarget(input: {
	tree?: AttachmentItem[]
	defaultOpenFileId?: string
	fileId?: string
}): AttachmentItem | undefined {
	const { tree = [], defaultOpenFileId, fileId } = input
	const targetId = String(defaultOpenFileId || fileId || "")
	if (!targetId) return undefined

	const items = flattenShareAttachments(tree)
	const itemById = new Map(items.map((item) => [String(item.file_id || ""), item]))
	let current = itemById.get(targetId)

	while (current) {
		if (isAudioShareTarget(current)) return current
		const parentId = String(current.parent_id || "")
		if (!parentId || parentId === String(current.file_id || "")) break
		current = itemById.get(parentId)
	}

	return undefined
}

/** Flattens a share attachment tree while retaining parent relationships for target resolution. */
function flattenShareAttachments(items: AttachmentItem[], result: AttachmentItem[] = []) {
	for (const item of items) {
		result.push(item)
		flattenShareAttachments(item.children || [], result)
	}
	return result
}

/** Identifies only nodes carrying the audio display marker, including legacy index.html entries. */
function isAudioShareTarget(item: AttachmentItem): boolean {
	return item.display_config?.type === "audio"
}

/** Derives a read-only capability matrix and only opens export when the share permission allows downloads. */
export function buildShareRecordingCapabilities(
	allowDownloadProjectFile: boolean,
): RecordingDetailCapabilities {
	return {
		viewMode: "share",
		canRename: false,
		canDelete: false,
		canMoveGroup: false,
		canGenerateSummary: false,
		canManageShare: false,
		canCopyToProject: false,
		canExport: allowDownloadProjectFile,
		canEditSpeakers: false,
		visibleTabKeys: [
			"summary",
			"topics",
			"highlights",
			"insights",
			"mindmap",
			"metrics",
			"followup",
			"power_dynamics",
			"intent",
			"notes",
		],
	}
}

/** Prefers parsed magic.project.js metadata and falls back to directory display_config metadata when the file is absent. */
export function buildShareRecordingMagicProjectConfig(
	input: BuildShareRecordingMagicProjectConfigInput,
): MagicProjectConfig | null {
	const { magicProjectConfig, audioDisplayConfig } = input
	if (magicProjectConfig) return magicProjectConfig
	if (!audioDisplayConfig) return null

	return {
		version: audioDisplayConfig.version,
		type: audioDisplayConfig.type,
		name: audioDisplayConfig.name,
		files: audioDisplayConfig.files,
		metadata: audioDisplayConfig.metadata,
	}
}
