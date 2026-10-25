import projectFilesStore from "@/stores/projectFiles"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { DisabledDetailToolTypes } from "@/pages/superMagic/components/Detail/constants"
import { isInlineToolDetail } from "@/pages/superMagic/utils/toolDetailDisplay"
import { reaction } from "mobx"
import magicToast from "@/components/base/MagicToaster/utils"
import i18n from "i18next"
import type { FileReference } from "@/apis/modules/superMagic"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import { resolveReferencedProjectAttachment } from "@/pages/superMagic/services/referencedProjectAttachmentResolver"
import {
	classifyMarkdownFileHref,
	findAttachmentByPath,
} from "@/pages/superMagic/utils/markdownFileReference"
import {
	createReferencedProjectPreviewFile,
	openMessageFile,
	openUserFileReference,
} from "../../utils/openMessageFile"

// Internal marker: keeps the single-arg callback shape without colliding with tool fields.
const TOOL_DETAIL_SELECTION_TARGET = Symbol("toolDetailSelectionTarget")

type ToolDetailSelectionTarget = "detail" | "file"
type ToolDetail = Record<string, unknown> & {
	[TOOL_DETAIL_SELECTION_TARGET]?: ToolDetailSelectionTarget
}

export type ToolCardInteractionTarget =
	| { type: "disabled" }
	| { type: "inline" }
	| { type: "playback" }
	| { type: "file"; fileId: string }
	| { type: "file-reference"; fileId?: string; filePath?: string }
	| { type: "canvas" }

// 旧消息可能没有 DisplayType.DESIGN，保留稳定的 Canvas 导航工具名作为兼容兜底。
// 工具属于 Design 领域不等于卡片点击必须打开 Canvas；query_canvas_overview 只打开详情。
const LEGACY_CANVAS_NAVIGATION_TOOL_NAMES = new Set([
	"create_design_project",
	"create_canvas_element",
	"update_canvas_element",
	"batch_create_canvas_elements",
	"batch_update_canvas_elements",
	"reorder_canvas_elements",
	"query_canvas_element",
	"generate_images_to_canvas",
	"search_images_to_canvas",
	"generate_videos_to_canvas",
	"query_video_generation",
	"create_canvas",
	"generate_canvas_images",
	"generate_canvas_videos",
])

type ToolFilesStore = Pick<
	typeof projectFilesStore,
	"workspaceFilesList" | "currentSelectedProject"
>

interface SelectToolDetailOptions {
	detail: Record<string, unknown>
	onSelectDetail?: (detail: ToolDetail) => void
	filesStore?: ToolFilesStore
}

interface SelectSourceFileOptions extends SelectToolDetailOptions {
	fileId: string
}

function resolveFilesStore(filesStore?: ToolFilesStore): ToolFilesStore {
	return filesStore ?? projectFilesStore
}

export function resolveToolFileId(data: unknown): string | undefined {
	if (!data || typeof data !== "object" || Array.isArray(data)) return undefined

	const detailData = data as Record<string, unknown>
	const candidate = [detailData.source_file_id, detailData.target_file_id].find(
		(value): value is string => typeof value === "string" && value.length > 0,
	)
	return candidate
}

export function getToolCardInteractionTarget(
	toolName: string | undefined,
	detail: unknown,
): ToolCardInteractionTarget {
	if (
		!detail ||
		typeof detail !== "object" ||
		Array.isArray(detail) ||
		Object.keys(detail).length === 0
	) {
		return { type: "disabled" }
	}
	if (toolName && DisabledDetailToolTypes.includes(toolName)) {
		return { type: "disabled" }
	}
	if (isInlineToolDetail(detail)) return { type: "inline" }

	const detailRecord = detail as Record<string, unknown>
	// 明确的 DisplayType.DESIGN 详情表示卡片点击需要进入 Canvas。
	if (detailRecord.type === "design") {
		return { type: "canvas" }
	}
	if (toolName && LEGACY_CANVAS_NAVIGATION_TOOL_NAMES.has(toolName)) {
		return { type: "canvas" }
	}
	if (detailRecord.type === "browser") {
		return { type: "playback" }
	}
	// 生成进度详情只承载预期完成时间，没有可预览的内容，不能因为卡片在生成中就变成可点。
	if (detailRecord.type === "generation_progress") {
		return { type: "disabled" }
	}
	const data = detailRecord.data
	if (data && typeof data === "object" && !Array.isArray(data)) {
		const { target_file_id, target_file_path } = data as Record<string, unknown>
		const fileId =
			typeof target_file_id === "string" && target_file_id ? target_file_id : undefined
		const filePath =
			typeof target_file_path === "string" && target_file_path ? target_file_path : undefined
		if (fileId || filePath) return { type: "file-reference", fileId, filePath }
	}
	const fileId = resolveToolFileId(detailRecord.data)
	return fileId ? { type: "file", fileId } : { type: "playback" }
}

let pendingFileSelection: AbortController | null = null

/** 两种消息卡片共用真实目标解析；旧来源字段继续遵守原附件判断。 */
export function selectToolFile({
	detail,
	target,
	onSelectDetail,
	filesStore,
}: SelectToolDetailOptions & {
	target: ToolCardInteractionTarget
}): boolean {
	if (target.type === "file")
		return selectSourceFileFromTool({
			detail,
			fileId: target.fileId,
			onSelectDetail,
			filesStore,
		})
	if (target.type !== "file-reference") return false
	pendingFileSelection?.abort()
	void selectReferencedToolFile({ detail, target, onSelectDetail, filesStore })
	return true
}

async function selectReferencedToolFile({
	detail,
	target,
	onSelectDetail,
	filesStore,
}: SelectToolDetailOptions & {
	target: Extract<ToolCardInteractionTarget, { type: "file-reference" }>
}): Promise<void> {
	const resolvedFilesStore = resolveFilesStore(filesStore)
	const controller = new AbortController()
	pendingFileSelection = controller
	const identity = getFileReferenceIdentityKey()
	const projectId = resolvedFilesStore.currentSelectedProject?.id
	const cancel = () => controller.abort()
	const disposeIdentity = reaction(
		() => [getFileReferenceIdentityKey(), resolvedFilesStore.currentSelectedProject?.id],
		cancel,
	)
	const selectionEvents = [
		PubSubEvents.Open_File_Tab,
		PubSubEvents.Open_Playback_Tab,
		PubSubEvents.Update_Active_File_Id,
	] as const
	selectionEvents.forEach((event) => pubsub.subscribe(event, cancel))
	const release = () => {
		disposeIdentity()
		selectionEvents.forEach((event) => pubsub.unsubscribe(event, cancel))
		if (pendingFileSelection === controller) pendingFileSelection = null
	}
	try {
		let reference: FileReference | undefined
		let file: Awaited<ReturnType<typeof resolveReferencedProjectAttachment>> | undefined
		if (target.fileId) {
			const result = await resolveFileReference({ file_id: target.fileId }, controller.signal)
			if (result.status === "resolved") reference = result.reference
		} else if (target.filePath) {
			// 工具传回实际 POSIX 路径；只在 href 边界编码一次，百分号属于文件名。
			const pathTarget = classifyMarkdownFileHref(
				target.filePath.split("/").map(encodeURIComponent).join("/"),
			).target
			if (pathTarget?.scope === "user") {
				const result = await resolveFileReference(
					{ space_type: "user", space_relative_path: pathTarget.relativePath },
					controller.signal,
				)
				if (result.status === "resolved") reference = result.reference
			} else if (pathTarget?.scope === "workspace" && projectId) {
				const attachment = findAttachmentByPath(
					resolvedFilesStore.workspaceFilesList,
					pathTarget.relativePath,
				)
				if (attachment)
					file = {
						...attachment,
						project_id: projectId,
						relative_file_path: pathTarget.relativePath,
					}
			} else if (pathTarget?.scope === "referenced-project") {
				file = await resolveReferencedProjectAttachment(pathTarget)
			}
		}
		if (reference?.space_type === "project" && !reference.is_directory) {
			// ID 已完成鉴权；直接使用其元信息，不再通过同路径查找另一个目标。
			const attachment = resolvedFilesStore.workspaceFilesList.find(
				(item) => String(item.file_id) === reference.file_id,
			)
			file = {
				...attachment,
				...reference,
				relative_file_path: reference.space_relative_path,
				display_config: {
					...attachment?.display_config,
					previewPolicy: {
						...attachment?.display_config?.previewPolicy,
						standalone: true,
					},
				},
			}
		}
		if (
			controller.signal.aborted ||
			identity !== getFileReferenceIdentityKey() ||
			projectId !== resolvedFilesStore.currentSelectedProject?.id
		)
			return
		release()
		if (reference?.space_type === "user" && !reference.is_directory) {
			openUserFileReference(reference)
		} else if (file && !file.is_directory && file.type !== "directory") {
			openMessageFile(
				file.project_id === projectId ? file : createReferencedProjectPreviewFile(file),
				{ locateInTree: file.project_id === projectId },
			)
		} else {
			magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
			return
		}
		onSelectDetail?.(markSelectionTarget(detail, "file"))
	} catch {
		if (!controller.signal.aborted && identity === getFileReferenceIdentityKey())
			magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
	} finally {
		release()
	}
}

function isFileInAttachments(fileId: string, filesStore?: ToolFilesStore): boolean {
	return resolveFilesStore(filesStore).workspaceFilesList.some(
		(item) => String(item.file_id ?? "") === fileId,
	)
}

function markSelectionTarget(
	detail: Record<string, unknown>,
	target: ToolDetailSelectionTarget,
): ToolDetail {
	return { ...detail, isFromNode: true, [TOOL_DETAIL_SELECTION_TARGET]: target }
}

export function getToolDetailSelectionTarget(
	detail: unknown,
): ToolDetailSelectionTarget | undefined {
	if (!detail || typeof detail !== "object" || Array.isArray(detail)) return undefined

	return (detail as ToolDetail)[TOOL_DETAIL_SELECTION_TARGET]
}

/** Opens a file tab only if `fileId` exists in attachments. Returns false to fall back to playback. */
export function selectSourceFileFromTool({
	detail,
	fileId,
	onSelectDetail,
	filesStore,
}: SelectSourceFileOptions): boolean {
	// Runtime artifacts (e.g. browser screenshots) are not workspace files.
	if (!isFileInAttachments(fileId, filesStore)) return false

	pubsub.publish(PubSubEvents.Open_File_Tab, { fileId })
	pubsub.publish(PubSubEvents.Locate_File_In_Tree, fileId)
	onSelectDetail?.(markSelectionTarget(detail, "file"))
	return true
}

export function selectToolDetail({ detail, onSelectDetail }: SelectToolDetailOptions) {
	if (isInlineToolDetail(detail)) return
	pubsub.publish(PubSubEvents.Open_Playback_Tab, detail)
	onSelectDetail?.(markSelectionTarget(detail, "detail"))
}
