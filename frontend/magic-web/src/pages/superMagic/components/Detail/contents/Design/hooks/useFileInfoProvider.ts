import { useCallback, useEffect } from "react"
import type {
	CanvasFileResourceMeta,
	FileUrlRequestPriority,
	GetFileInfoResponse,
} from "@/components/CanvasDesign/public/magic-types"
import { GET_FILE_INFO_NOT_FOUND_ERROR_CODE } from "@/components/CanvasDesign/runtime/resources/media-common/resourceLoadFailure"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { useTranslation } from "react-i18next"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getFileInfoByPath,
	getFileResourceMetaByPath,
	getFileInfoById as getSharedFileInfoById,
	setFileInfoCache as setSharedFileInfoCache,
	cleanupFileInfoCache,
} from "../utils/designFileInfoCache"
import type { GetFileInfoResponseWithFileId } from "../utils/uploadCallbacks"

interface UseFileInfoProviderOptions {
	/** 已扁平化的附件列表（从入口传入） */
	flatAttachments?: FileItem[]
	/** 附件快照是否已由入口提供；观测过真实快照后，空数组也可能是一个有效快照 */
	attachmentsReady?: boolean
	/** 设计目录 ID，用于为 file info cache 建立命名空间 */
	designProjectId?: string
	/** 画布目录在项目中的路径段（与 magic.project.js 同级），用于解析 DSL 相对路径（如 `images/...` 或 `./images/...`） */
	designProjectBasePath?: string
	attachmentIndex?: DesignAttachmentIndex | null
}

interface UseFileInfoProviderReturn {
	getFileInfo: (
		path: string,
		options?: {
			useImageProcess?: boolean
			forceRefresh?: boolean
			priority?: FileUrlRequestPriority
		},
	) => Promise<GetFileInfoResponse>
	getFileResourceMeta: (
		path: string,
		options?: { useImageProcess?: boolean },
	) => Promise<CanvasFileResourceMeta>
	getFileInfoById: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponseWithFileId>
	setFileInfoCache: (
		path: string,
		fileInfo: GetFileInfoResponse,
		options?: { allowMissingAttachment?: boolean },
	) => void
}

function createFileNotFoundByPathError(path: string, message: string): Error {
	const error = new Error(message) as Error & { code?: string; path?: string }
	error.code = GET_FILE_INFO_NOT_FOUND_ERROR_CODE
	error.path = path
	return error
}

/**
 * 文件信息提供功能 Hook
 * 职责：根据文件路径获取文件信息
 * - 通过 designFileInfoCache 获取文件信息（包含缓存和批量请求合并）
 * - 当文件列表变化时，清理已删除文件的缓存
 */
export function useFileInfoProvider(
	options: UseFileInfoProviderOptions,
): UseFileInfoProviderReturn {
	const {
		flatAttachments,
		attachmentsReady,
		designProjectBasePath,
		designProjectId,
		attachmentIndex,
	} = options
	const { t } = useTranslation("super")
	// designFileInfoCache is a module-level cache outside React; thread the ambient
	// identity into each request so its in-flight keys and batches stay identity-pure.
	const fileApi = useFileApi()

	// 当文件列表变化时，清理已删除文件的缓存
	useEffect(() => {
		cleanupFileInfoCache(flatAttachments, designProjectId, {
			hasAttachmentSnapshot: attachmentsReady === true,
		})
	}, [flatAttachments, designProjectId, attachmentsReady])

	/**
	 * 获取文件信息。path 解析与 path 缓存保留在宿主层，URL 去重和批处理由统一协调器负责。
	 */
	const getFileInfo = useCallback(
		async (
			path: string,
			opts?: {
				useImageProcess?: boolean
				forceRefresh?: boolean
				priority?: FileUrlRequestPriority
			},
		): Promise<GetFileInfoResponse> => {
			const result = await getFileInfoByPath(path, flatAttachments, {
				...opts,
				designProjectBasePath,
				designProjectId,
				attachmentIndex,
				attachmentsSnapshotKeyOverride: attachmentIndex?.attachmentsSnapshotKey,
				hasAttachmentSnapshot: attachmentsReady === true,
				fileApi,
			})
			if (!result) {
				throw createFileNotFoundByPathError(
					path,
					t("design.errors.fileNotFoundByPath", { path }),
				)
			}
			return result
		},
		[
			t,
			flatAttachments,
			attachmentsReady,
			designProjectBasePath,
			designProjectId,
			attachmentIndex,
			fileApi,
		],
	)

	const getFileResourceMeta = useCallback(
		(path: string): Promise<CanvasFileResourceMeta> => {
			return getFileResourceMetaByPath(path, flatAttachments, {
				designProjectBasePath,
				designProjectId,
				attachmentIndex,
				hasAttachmentSnapshot: attachmentsReady === true,
			})
		},
		[
			flatAttachments,
			designProjectBasePath,
			designProjectId,
			attachmentIndex,
			attachmentsReady,
		],
	)

	/**
	 * 通过 file_id 获取文件信息
	 * 优势：不依赖 path 和 attachments，直接使用 file_id 获取下载 URL
	 * 适用场景：上传完成后，API 已返回 file_id，但 attachments 可能还未更新
	 * 注意：这是 superMagic 上传回填专用链路，不作为 CanvasDesign 资源同一性标识。
	 */
	const getFileInfoById = useCallback(
		async (
			fileId: string,
			fileName?: string,
			fileSize?: number,
		): Promise<GetFileInfoResponseWithFileId> => {
			try {
				const result = await getSharedFileInfoById(fileId, fileName, fileSize, {
					filesList: flatAttachments,
					designProjectId,
					priority: "critical",
					fileApi,
				})
				return result
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : t("design.errors.getFileInfoFailed")
				throw new Error(errorMessage)
			}
		},
		[t, flatAttachments, designProjectId, fileApi],
	)

	/**
	 * 设置文件信息缓存
	 * 用于外部直接设置缓存，避免重复调用 API
	 */
	const setFileInfoCache = useCallback(
		(
			path: string,
			fileInfo: GetFileInfoResponse,
			opts?: { allowMissingAttachment?: boolean },
		) => {
			setSharedFileInfoCache(
				path,
				fileInfo,
				flatAttachments,
				designProjectBasePath,
				designProjectId,
				attachmentIndex,
				{
					...opts,
					hasAttachmentSnapshot: attachmentsReady === true,
				},
			)
		},
		[
			flatAttachments,
			designProjectBasePath,
			designProjectId,
			attachmentIndex,
			attachmentsReady,
		],
	)

	return {
		getFileInfo,
		getFileResourceMeta,
		getFileInfoById,
		setFileInfoCache,
	}
}
