import type { NormalSuccessResponse, PlatformType } from "../types"

const DEFAULT_SUCCESS_CODE = 1000
const DEFAULT_SUCCESS_MESSAGE = "请求成功"

export function normalizeSuccessResponse(
	key: string,
	platform: PlatformType,
	headers: Record<string, string>,
): NormalSuccessResponse {
	return {
		code: DEFAULT_SUCCESS_CODE,
		message: DEFAULT_SUCCESS_MESSAGE,
		headers,
		data: {
			path: key,
			platform,
		},
	}
}
