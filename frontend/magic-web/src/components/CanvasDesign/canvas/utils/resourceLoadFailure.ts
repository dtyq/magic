export type ResourceLoadFailureReason = "not-found" | "load-error"

export const GET_FILE_INFO_NOT_FOUND_ERROR_CODE = "canvas-design/get-file-info-not-found"

const FILE_NOT_FOUND_MESSAGE_PATTERNS = ["未找到路径对应的文件", "File not found for path"]

export function getFailureReasonFromStatusCode(
	statusCode: number | null | undefined,
): ResourceLoadFailureReason {
	void statusCode
	return "load-error"
}

export function getFailureReasonFromGetFileInfoError(error: unknown): ResourceLoadFailureReason {
	if (!(error instanceof Error)) {
		return "load-error"
	}

	const errorWithCode = error as Error & { code?: string }
	if (errorWithCode.code === GET_FILE_INFO_NOT_FOUND_ERROR_CODE) {
		return "not-found"
	}

	const isFileNotFound = FILE_NOT_FOUND_MESSAGE_PATTERNS.some((pattern) =>
		error.message.includes(pattern),
	)

	return isFileNotFound ? "not-found" : "load-error"
}
