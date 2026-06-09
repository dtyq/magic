import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { normalizePath } from "../utils/utils"

export interface ResolveDesignImagesFileDirOptions {
	projectId: string
	currentFile?: {
		id: string
		name: string
	}
	flatAttachments?: FileItem[]
	updateAttachments: () => void
}

/**
 * 解析当前设计项目下的 `images` 目录（与发起生图一致）：不存在则创建。
 * @returns 形如 `/design/path/images/`；当前文件或附件上下文不足时返回 `undefined`
 */
export async function resolveDesignImagesFileDirWithSlash(
	options: ResolveDesignImagesFileDirOptions,
): Promise<string | undefined> {
	const { projectId, currentFile, flatAttachments, updateAttachments } = options

	let fileDir = ""
	let parentDirId: string | undefined = undefined

	if (currentFile?.id && flatAttachments && flatAttachments.length > 0) {
		const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)

		if (designProjectFile?.relative_file_path) {
			const filePath = designProjectFile.relative_file_path

			if (designProjectFile.is_directory) {
				fileDir = filePath
				parentDirId = designProjectFile.file_id
			} else {
				const fileName = designProjectFile.file_name || currentFile.name
				if (filePath.endsWith(fileName)) {
					fileDir = filePath.slice(0, -fileName.length)
				} else {
					const lastSlashIndex = filePath.lastIndexOf("/")
					if (lastSlashIndex >= 0) {
						fileDir = filePath.slice(0, lastSlashIndex + 1)
					}
				}
				const parentDirPath = normalizePath(fileDir)
				if (parentDirPath) {
					const parentDir = flatAttachments.find(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") === parentDirPath,
					)
					if (parentDir) {
						parentDirId = parentDir.file_id
					}
				}
			}

			fileDir = normalizePath(fileDir)

			if (!parentDirId && fileDir) {
				const parentDir = flatAttachments.find(
					(item) =>
						item.is_directory &&
						normalizePath(item.relative_file_path || "") === fileDir,
				)
				if (parentDir) {
					parentDirId = parentDir.file_id
				}
			}

			const imagesDirPath = fileDir ? `${fileDir}/images` : "images"
			const normalizedImagesDirPath = normalizePath(imagesDirPath)
			const imagesDirExists = flatAttachments.some(
				(item) =>
					item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedImagesDirPath,
			)

			if (!imagesDirExists) {
				try {
					await SuperMagicApi.createFile({
						project_id: projectId,
						parent_id: parentDirId || "",
						file_name: "images",
						is_directory: true,
					})
					updateAttachments()
				} catch (error: unknown) {
					const errorObj = error as { code?: number; message?: string }
					if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
						updateAttachments()
					} else {
						//
					}
				}
			}

			fileDir = imagesDirPath
		}
	}

	return fileDir ? `/${fileDir}/` : undefined
}
