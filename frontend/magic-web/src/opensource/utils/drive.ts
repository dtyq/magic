import { DriveItemFileType } from "@/opensource/types/drive"
import { RouteName } from "@/opensource/routes/constants"
import type { RouteParams } from "@/opensource/routes/history/types"

/**
 * 获取文件访问路径
 * @param id 文件 ID
 * @param fType 文件类型
 * @returns 路径
 */
export const getDriveFileRedirectUrl = (
	id: string,
	fType: DriveItemFileType,
): RouteParams | undefined => {
	if (fType === DriveItemFileType.CLOUD_DOC) {
		return {
			name: RouteName.Docs,
			params: { fileId: id },
		}
	}
	if (fType === DriveItemFileType.CLOUD_DOCX) {
		return {
			name: RouteName.Docx,
			params: { fileId: id },
		}
	}
	if (fType === DriveItemFileType.WHITEBOARD) {
		return {
			name: RouteName.Whiteboard,
			params: { fileId: id },
		}
	}
	if (fType === DriveItemFileType.MULTI_TABLE) {
		return {
			name: RouteName.BiTable,
			params: { tableId: id },
		}
	}
	if (
		[
			DriveItemFileType.WORD,
			DriveItemFileType.EXCEL,
			DriveItemFileType.PPT,
			DriveItemFileType.PDF,
		].includes(fType)
	) {
		return {
			name: RouteName.OfficeFile,
			params: { id },
		}
	}
	if (
		[
			DriveItemFileType.XMIND,
			DriveItemFileType.VIDEO,
			DriveItemFileType.IMAGE,
			DriveItemFileType.AUDIO,
			DriveItemFileType.UNKNOWN,
		].includes(fType)
	) {
		return {
			name: RouteName.File,
			params: { fileId: id },
		}
	}

	if (fType === DriveItemFileType.KNOWLEDGE_BASE) {
		return {
			name: RouteName.KnowledgeDirectory,
			params: { knowledgeId: id },
		}
	}

	return undefined
}
