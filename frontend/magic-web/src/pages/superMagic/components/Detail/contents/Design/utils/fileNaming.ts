import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { UploadFile } from "@/components/CanvasDesign/public/magic-types"
import { collectAllFilesInDirectory, generateUniqueDesignFileName } from "./utils"

interface PrepareFilesForUploadParams {
	uploadFiles: UploadFile[]
	suffixDir: string
	attachments?: FileItem[]
	duplicateCheckList?: string[]
}

interface PrepareFilesForUploadResult {
	filesToUpload: File[]
	fileNameToUploadFileMap: Map<string, UploadFile>
}

/**
 * 从 duplicateCheckList 中提取文件名集合
 */
function extractDuplicateFileNames(duplicateCheckList: string[]): Set<string> {
	const duplicateFileNames = new Set<string>()

	for (const path of duplicateCheckList) {
		// 提取文件名（路径的最后一部分）
		const normalizedPath = path.replace(/^\/+/, "") // 移除前导斜杠
		const lastSlashIndex = normalizedPath.lastIndexOf("/")
		const fileName =
			lastSlashIndex >= 0 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath

		if (fileName) {
			duplicateFileNames.add(fileName)
		}
	}

	return duplicateFileNames
}

/**
 * 合并所有已存在的文件名（包括目录下已存在的文件和 duplicateCheckList）
 */
function getAllExistingFileNames(
	suffixDir: string,
	attachments: FileItem[] | undefined,
	duplicateCheckList: string[] | undefined,
): Set<string> {
	const allExistingFileNames = new Set<string>()

	// 获取目标目录下已存在的文件
	const existingFilesInDirectory = attachments
		? collectAllFilesInDirectory(attachments, suffixDir)
		: []

	// 添加已存在文件的文件名
	for (const existingFile of existingFilesInDirectory) {
		if (existingFile.file_name) {
			allExistingFileNames.add(existingFile.file_name)
		}
	}

	// 添加 duplicateCheckList 中的文件名
	if (duplicateCheckList && duplicateCheckList.length > 0) {
		const duplicateFileNames = extractDuplicateFileNames(duplicateCheckList)
		duplicateFileNames.forEach((fileName) => {
			allExistingFileNames.add(fileName)
		})
	}

	return allExistingFileNames
}

function getExistingFileSizesByName(
	suffixDir: string,
	attachments: FileItem[] | undefined,
): Map<string, Set<number>> {
	const existingFileSizesByName = new Map<string, Set<number>>()
	const existingFilesInDirectory = attachments
		? collectAllFilesInDirectory(attachments, suffixDir)
		: []

	for (const existingFile of existingFilesInDirectory) {
		if (!existingFile.file_name || typeof existingFile.file_size !== "number") {
			continue
		}
		const fileSizes = existingFileSizesByName.get(existingFile.file_name) ?? new Set<number>()
		fileSizes.add(existingFile.file_size)
		existingFileSizesByName.set(existingFile.file_name, fileSizes)
	}

	return existingFileSizesByName
}

/**
 * 准备要上传的文件列表，处理重命名逻辑
 */
export function prepareFilesForUpload(
	params: PrepareFilesForUploadParams,
): PrepareFilesForUploadResult {
	const { uploadFiles, suffixDir, attachments, duplicateCheckList } = params

	const filesToUpload: File[] = []
	const seenOriginalNames = new Set<string>()
	const fileNameToUploadFileMap = new Map<string, UploadFile>()

	// 获取所有已存在的文件名
	const occupiedNames = getAllExistingFileNames(suffixDir, attachments, duplicateCheckList)
	const existingFileSizesByName = getExistingFileSizesByName(suffixDir, attachments)

	for (const uploadFile of uploadFiles) {
		const { file, overwrite } = uploadFile
		let finalFile: File = file
		const existingFileSizes = existingFileSizesByName.get(file.name)
		const hasDifferentExistingFile =
			existingFileSizes !== undefined && !existingFileSizes.has(file.size)
		const hasSameBatchFileName = seenOriginalNames.has(file.name)
		const shouldUseUniqueFileName =
			!overwrite || hasDifferentExistingFile || hasSameBatchFileName

		// 调用方明确禁止覆盖、同名文件大小不同或批内重名时统一改名。
		if (shouldUseUniqueFileName) {
			const newFileName = generateUniqueDesignFileName(file.name, occupiedNames)

			// 如果需要重命名，创建新的 File 对象
			if (newFileName !== file.name) {
				finalFile = new File([file], newFileName, {
					type: file.type,
					lastModified: file.lastModified,
				})
			}
		}
		occupiedNames.add(finalFile.name)
		seenOriginalNames.add(file.name)

		filesToUpload.push(finalFile)
		// 建立映射关系（使用最终文件名）
		fileNameToUploadFileMap.set(finalFile.name, uploadFile)
	}

	return {
		filesToUpload,
		fileNameToUploadFileMap,
	}
}
