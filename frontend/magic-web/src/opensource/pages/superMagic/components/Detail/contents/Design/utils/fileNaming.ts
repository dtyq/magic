import type { FileItem } from "@/opensource/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { UploadFile } from "@/opensource/components/CanvasDesign/types.magic"
import { collectFilesInDirectory, splitFileName } from "./utils"

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
		? collectFilesInDirectory(attachments, suffixDir)
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
		for (const fileName of duplicateFileNames) {
			allExistingFileNames.add(fileName)
		}
	}

	return allExistingFileNames
}

/**
 * 为文件生成唯一文件名（如果需要）
 */
function generateUniqueFileName(
	fileName: string,
	usedNames: Set<string>,
	allExistingFileNames: Set<string>,
): string {
	if (!usedNames.has(fileName) && !allExistingFileNames.has(fileName)) {
		return fileName
	}

	// 需要重命名
	const { baseName, extension } = splitFileName(fileName)
	let counter = 1
	let newFileName: string

	// 持续尝试直到找到未使用的文件名
	do {
		newFileName = `${baseName}(${counter})${extension}`
		counter++
	} while (usedNames.has(newFileName) || allExistingFileNames.has(newFileName))

	return newFileName
}

/**
 * 准备要上传的文件列表，处理重命名逻辑
 */
export function prepareFilesForUpload(
	params: PrepareFilesForUploadParams,
): PrepareFilesForUploadResult {
	const { uploadFiles, suffixDir, attachments, duplicateCheckList } = params

	const filesToUpload: File[] = []
	const usedNames = new Set<string>()
	const fileNameToUploadFileMap = new Map<string, UploadFile>()

	// 获取所有已存在的文件名
	const allExistingFileNames = getAllExistingFileNames(suffixDir, attachments, duplicateCheckList)

	for (const uploadFile of uploadFiles) {
		const { file, overwrite } = uploadFile
		let finalFile: File = file

		// 如果 overwrite 为 true，保持原文件名（不重命名）
		// 如果 overwrite 为 false 或未设置，检查是否需要重命名
		if (!overwrite) {
			const newFileName = generateUniqueFileName(file.name, usedNames, allExistingFileNames)

			// 如果需要重命名，创建新的 File 对象
			if (newFileName !== file.name) {
				finalFile = new File([file], newFileName, {
					type: file.type,
					lastModified: file.lastModified,
				})
			}

			// 记录使用的文件名（用于同批次内去重）
			usedNames.add(newFileName)
		} else {
			// overwrite 为 true，保持原文件名
			usedNames.add(file.name)
		}

		filesToUpload.push(finalFile)
		// 建立映射关系（使用最终文件名）
		fileNameToUploadFileMap.set(finalFile.name, uploadFile)
	}

	return {
		filesToUpload,
		fileNameToUploadFileMap,
	}
}
