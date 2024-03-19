import { message } from "antd"
import type { AxiosError, AxiosResponse } from "axios"

/** HTTP 状态码枚举（RFC 7231、RFC 7233、RFC 7540） */
export const enum HttpStatusCode {
	/** 200 OK - 请求成功 */
	Ok = 200,
	/** 302 Found - 资源临时重定向 */
	Found = 302,
	/** 400 Bad Request - 请求语法错误 */
	BadRequest = 400,
	/** 401 Unauthorized - 未认证 */
	Unauthorized = 401,
	/** 403 Forbidden - 无权限访问 */
	Forbidden = 403,
	/** 404 Not Found - 资源不存在 */
	NotFound = 404,
	/** 500 Internal Server Error - 服务器内部错误 */
	InternalServerError = 500,
}

export const enum BusinessResponseCode {
	/** 响应成功 */
	Success = 1000,
	/** 组织无效 */
	InvalidOrganization = 40101,

	/** 未授权 */
	Unauthorized = 2185,
}

/** 成功响应 */
export function generateSuccessResInterceptor() {
	return async (response: AxiosResponse) => {
		const { data: jsonResponse } = response
		if (jsonResponse?.code !== BusinessResponseCode.Success) {
			if (jsonResponse.code === BusinessResponseCode.Unauthorized) {
				window.location.href = `${window.location.origin}/admin/no-authorized`
			}

			if (jsonResponse?.message) {
				message.error(jsonResponse.message)
			}
			throw jsonResponse
		}

		return jsonResponse.data
	}
}

let hasShowMessage = false
export function generateErrorInterceptor() {
	return async (error: AxiosError) => {
		if (error.response?.status === HttpStatusCode.Unauthorized) {
			if (!hasShowMessage) {
				message.error("登录已过期，请重新登录")
				hasShowMessage = true
				window.location.href = `${window.location.origin}/admin/no-authorized`
			}
		}
		return Promise.reject(error)
	}
}
