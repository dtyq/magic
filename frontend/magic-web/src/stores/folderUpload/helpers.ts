import type { FolderUploadFile } from "./types"

/**
 * 按文件夹路径对文件进行分组
 */
export const groupFilesByFolder = (
	files: FolderUploadFile[],
	baseSuffixDir: string,
): Map<string, FolderUploadFile[]> => {
	const groups = new Map<string, FolderUploadFile[]>()

	files.forEach((folderFile) => {
		const key = folderFile.targetPath
		if (!groups.has(key)) {
			groups.set(key, [])
		}
		groups.get(key)!.push(folderFile)
	})

	return groups
}

/**
 * 将数组分块
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
	const chunks: T[][] = []
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size))
	}
	return chunks
}

/**
 * 延迟函数
 */
export const delay = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 计算进度百分比
 */
export const calculateProgress = (processed: number, total: number): number => {
	if (total === 0) return 0
	return Math.round((processed / total) * 100)
}

/**
 * 从相对路径获取文件夹路径
 */
export const getFolderPath = (relativePath: string): string => {
	const pathParts = relativePath.split("/")
	return pathParts.slice(0, -1).join("/")
}

/**
 * 计算目标路径
 */
export const calculateTargetPath = (relativePath: string, baseSuffixDir: string): string => {
	const folderPath = getFolderPath(relativePath)
	return baseSuffixDir
		? folderPath
			? `${baseSuffixDir}/${folderPath}`
			: baseSuffixDir
		: folderPath
}

/**
 * 从WebKit相对路径创建文件夹文件对象
 */
export const createFolderFiles = (
	files: File[],
	baseSuffixDir: string,
	fileKeysMap?: Map<string, string>,
): FolderUploadFile[] => {
	return files.map((file) => ({
		file,
		relativePath: (file as any).webkitRelativePath || file.name,
		folderPath: getFolderPath((file as any).webkitRelativePath || file.name),
		targetPath: calculateTargetPath(
			(file as any).webkitRelativePath || file.name,
			baseSuffixDir,
		),
		customFileKey: fileKeysMap?.get(file.name), // 添加自定义fileKey
	}))
}

/**
 * 生成唯一任务ID
 */
export const generateTaskId = (): string => {
	return `folder_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化文件大小
 * 使用十进制单位（SI标准）与操作系统保持一致
 */
export const formatFileSize = (bytes: number): string => {
	const units = ["B", "KB", "MB", "GB"]
	let size = bytes
	let unitIndex = 0

	// 使用十进制单位（1000）而不是二进制单位（1024）
	while (size >= 1000 && unitIndex < units.length - 1) {
		size /= 1000
		unitIndex++
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 计算上传速度 (KB/s)
 */
export const calculateUploadSpeed = (uploadedBytes: number, startTime: number): number => {
	const elapsedSeconds = (Date.now() - startTime) / 1000
	if (elapsedSeconds === 0) return 0
	return Math.round(uploadedBytes / 1024 / elapsedSeconds)
}

/**
 * 估算剩余时间 (秒)
 */
export const estimateTimeRemaining = (
	totalBytes: number,
	uploadedBytes: number,
	uploadSpeed: number, // KB/s
): number => {
	if (uploadSpeed === 0) return 0
	const remainingBytes = totalBytes - uploadedBytes
	const remainingKB = remainingBytes / 1024
	return Math.round(remainingKB / uploadSpeed)
}

/**
 * 获取当前项目ID (从URL中提取)
 */
export const getCurrentProjectId = (): string => {
	return window.location.pathname.includes("/project/")
		? window.location.pathname.split("/project/")[1].split("/")[0]
		: ""
}
