import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { FileReference } from "@/apis/modules/superMagic"
import type { ReferencedProjectAttachment } from "@/pages/superMagic/services/referencedProjectAttachmentResolver"
import { createUserFilePreview } from "@/pages/superMagic/components/UserSpace/services/userSpaceFileService"

interface OpenMessageFileOptions {
	locateInTree?: boolean
}

export function createReferencedProjectPreviewFile(file: ReferencedProjectAttachment) {
	return {
		...file,
		display_config: {
			...(file.display_config || {}),
			previewPolicy: {
				...(file.display_config?.previewPolicy || {}),
				standalone: true,
				syncWithAttachments: false,
				persistTab: false,
				restoreAsActive: false,
			},
		},
	}
}

/** 用户资源单独预览，文本保存统一使用用户文件的修订号契约。 */
export function openUserFileReference(
	reference: Extract<FileReference, { space_type: "user" }>,
): void {
	if (reference.is_directory) return
	openMessageFile(createUserFilePreview(reference), { locateInTree: false })
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object")
}

function resolveMessageFileId(fileData: unknown): string | null {
	if (!isRecord(fileData)) return null
	const nestedData = fileData.data
	const fileId =
		fileData.file_id ||
		(isRecord(nestedData) ? nestedData.file_id : undefined) ||
		fileData.currentFileId ||
		fileData.id

	if (typeof fileId === "string" && fileId.trim()) return fileId
	if (typeof fileId === "number" && Number.isFinite(fileId)) return String(fileId)

	return null
}

function isHiddenMessageFile(fileData: unknown): boolean {
	if (!isRecord(fileData)) return false
	const nestedData = fileData.data
	return Boolean(fileData.is_hidden || (isRecord(nestedData) && nestedData.is_hidden))
}

export function openMessageFile(
	fileData: unknown,
	options: OpenMessageFileOptions = {},
): string | null {
	const fileId = resolveMessageFileId(fileData)
	if (!fileId) return null

	pubsub.publish(PubSubEvents.Switch_Detail_Mode, "files")
	pubsub.publish(PubSubEvents.Open_File_Tab, {
		fileId,
		fileData,
	})

	if (options.locateInTree ?? !isHiddenMessageFile(fileData)) {
		pubsub.publish(PubSubEvents.Locate_File_In_Tree, fileId)
	}

	return fileId
}
