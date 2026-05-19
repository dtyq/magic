import { GenerationStatus, type GenerationStatus as GenerationStatusValue } from "../../types.magic"

/**
 * 根据文件名提取更稳定的展示名，去除结尾的时间戳/数字后缀。
 */
export function extractSmartNameFromFileName(fileName: string): string {
	const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "")
	const numericSuffixMatch = fileNameWithoutExt.match(/_(\d{6,})$/)

	if (numericSuffixMatch) {
		const suffixIndex = fileNameWithoutExt.lastIndexOf(numericSuffixMatch[0])
		return fileNameWithoutExt.substring(0, suffixIndex)
	}

	return fileNameWithoutExt
}

/**
 * 仅在任务仍处于服务端进行中时继续轮询。
 */
export function shouldContinueGenerationPolling(status: GenerationStatusValue): boolean {
	return status === GenerationStatus.Pending || status === GenerationStatus.Processing
}
