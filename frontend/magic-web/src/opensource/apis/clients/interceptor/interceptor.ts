import type { UserService } from "@/opensource/services/user/UserService"
import { userStore } from "@/opensource/models/user/stores"
import type { Container } from "@/opensource/services/ServiceContainer"
import { RoutePath } from "@/const/routes"
import { message } from "antd"
import type { ResponseData } from "../../core/HttpClient"
import { LoginValueKey } from "@/opensource/pages/login/constants"

/** HTTP 状态码枚举（RFC 7231、RFC 7233、RFC 7540） */
const enum HttpStatusCode {
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

const enum BusinessResponseCode {
	/** 响应成功 */
	Success = 1000,
	/** 组织无效 */
	InvalidOrganization = 40101,
}

/**
 * 生成登录重定向 URL
 * @returns 登录重定向 URL
 */
export const genLoginRedirectUrl = () => {
	const redirectUrl = new URL(RoutePath.Login, window.location.origin)
	if (window.location.pathname !== RoutePath.Login) {
		const redirectTarget = new URLSearchParams(window.location.search).get(
			LoginValueKey.REDIRECT_URL,
		)

		// 获取当前页面地址
		redirectUrl.searchParams.set(
			LoginValueKey.REDIRECT_URL,
			redirectTarget ?? window.location.href,
		)
	}
	return redirectUrl.toString()
}

/** 登录无效 */
export function generateUnauthorizedResInterceptor(service: Container) {
	return async function unauthorized(response: ResponseData) {
		const { enableAuthorizationVerification = true } = response.options
		if (
			(enableAuthorizationVerification && response.status === HttpStatusCode.Unauthorized) ||
			response?.data?.code === 3103
		) {
			await service.get<UserService>("userService").deleteAccount()
			if (window.location.pathname !== RoutePath.Login) {
				window.history.pushState({}, "", genLoginRedirectUrl())
			}
			throw new Error("Unauthorized")
		}
		return response
	}
}

/** 组织无效 */
export function generateInvalidOrgResInterceptor(service: Container) {
	return async function invalidOr(response: ResponseData) {
		const jsonResponse = response.data
		if (jsonResponse?.code === BusinessResponseCode.InvalidOrganization) {
			service
				.get<UserService>("userService")
				.setMagicOrganizationCode(userStore.user.organizations?.[0]?.organization_code)
			window.location.reload()
		}
		return response
	}
}

/** 成功响应 */
export function generateSuccessResInterceptor() {
	return async function success(response: ResponseData) {
		const jsonResponse = response.data
		if (jsonResponse?.code !== BusinessResponseCode.Success) {
			if (response.options?.enableErrorMessagePrompt && jsonResponse?.message) {
				message.error(jsonResponse.message)
			}
			throw jsonResponse
		}

		// 解包数据
		if (response.options?.unwrapData) {
			return jsonResponse.data
		}

		return response
	}
}
