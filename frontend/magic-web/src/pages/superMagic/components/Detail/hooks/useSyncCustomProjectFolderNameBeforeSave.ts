import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { parseMagicProjectJs } from "@/pages/superMagic/components/Detail/contents/HTML/utils/magicProjectUpdater"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { unshadow } from "@/utils/shadow"

interface AttachmentLike {
	file_id?: string
	parent_id?: string | number | null
	name?: string
	file_name?: string
	filename?: string
	children?: AttachmentLike[]
}

function findAttachmentById(
	items: AttachmentLike[] | undefined,
	targetId: string,
): AttachmentLike | null {
	for (const item of items || []) {
		if (String(item?.file_id || "") === targetId) return item
		if (Array.isArray(item?.children) && item.children.length > 0) {
			const found = findAttachmentById(item.children, targetId)
			if (found) return found
		}
	}
	return null
}

function getAttachmentName(item: AttachmentLike | null | undefined): string {
	if (!item) return ""
	return String(item.name || item.file_name || item.filename || "").trim()
}

function parseMagicProjectConfigFromContent(content: unknown): Record<string, unknown> | null {
	if (typeof content !== "string" || !content.trim()) return null
	const rawContent = content.startsWith("SHADOWED_") ? unshadow(content) : content
	const parsed = parseMagicProjectJs(rawContent)
	if (!parsed?.config || typeof parsed.config !== "object") return null
	return parsed.config as Record<string, unknown>
}

interface UseSyncCustomProjectFolderNameBeforeSaveParams {
	attachments?: AttachmentLike[]
	/** 当前详情里的文件数据，用于在附件树中找不到时的回退 */
	currentFileData?: AttachmentLike | null
}

/**
 * 保存 magic.project.js 前：若配置为 custom 且 name 与父文件夹不一致，则同步重命名父文件夹
 */
export function useSyncCustomProjectFolderNameBeforeSave({
	attachments,
	currentFileData,
}: UseSyncCustomProjectFolderNameBeforeSaveParams) {
	const syncCustomProjectFolderNameBeforeSave = useMemoizedFn(
		async (targetFileId: string, newContent: unknown) => {
			const targetId = String(targetFileId || "")
			if (!targetId) return

			const fileItem = findAttachmentById(attachments, targetId) || currentFileData || null
			const fileName = getAttachmentName(fileItem)
			if (fileName !== "magic.project.js") return

			const config = parseMagicProjectConfigFromContent(newContent)
			if (!config || config.type !== "custom") return

			const nextFolderName = typeof config.name === "string" ? config.name.trim() : ""
			if (!nextFolderName) return

			const parentId = fileItem?.parent_id
			if (parentId === undefined || parentId === null) return

			const parentFolder = findAttachmentById(attachments, String(parentId))
			if (!parentFolder?.file_id) return

			const currentFolderName = getAttachmentName(parentFolder)
			if (currentFolderName === nextFolderName) return

			await SuperMagicApi.renameFile({
				file_id: String(parentFolder.file_id),
				target_name: nextFolderName,
			})
			pubsub.publish(PubSubEvents.Update_Attachments)
		},
	)

	return { syncCustomProjectFolderNameBeforeSave }
}
