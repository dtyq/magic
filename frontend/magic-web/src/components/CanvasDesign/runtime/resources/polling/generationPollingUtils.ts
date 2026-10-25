import {
	GenerationStatus,
	type GenerationStatus as GenerationStatusValue,
} from "../../../public/magic-types"

export const INVALID_GENERATED_RESOURCE_PATH_ERROR = "generated-resource-path-unresolved"

/** Keeps internal polling failures out of user-visible element error text. */
export function resolveGenerationErrorMessage(
	errorMessage: string | null | undefined,
	localizedFallback: string,
): string {
	if (!errorMessage || errorMessage === INVALID_GENERATED_RESOURCE_PATH_ERROR) {
		return localizedFallback
	}
	return errorMessage
}

export function getGenerationResultStatusPatch(
	status: GenerationStatusValue,
	errorMessage: string | null | undefined,
	hasResolvedResource: boolean,
): { status: GenerationStatusValue; errorMessage?: string } {
	if (status === GenerationStatus.Completed && !hasResolvedResource) {
		return {
			status: GenerationStatus.Failed,
			errorMessage: INVALID_GENERATED_RESOURCE_PATH_ERROR,
		}
	}

	return {
		status,
		errorMessage: errorMessage ?? undefined,
	}
}

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

const DESIGN_INVALID_ARGUMENT_CODE = 14000

/**
 * 后端查询不存在的生成任务时返回 14000，并在 message 中回显任务 ID。
 * 同一个错误码还用于其他参数错误，因此必须同时匹配当前任务 ID，不能只按 code 自愈。
 */
export function isGenerationTaskNotFoundError(error: unknown, taskId: string): boolean {
	if (!taskId || !error || typeof error !== "object") return false

	const response = error as { code?: unknown; message?: unknown }
	return (
		Number(response.code) === DESIGN_INVALID_ARGUMENT_CODE &&
		typeof response.message === "string" &&
		response.message.includes(taskId)
	)
}
