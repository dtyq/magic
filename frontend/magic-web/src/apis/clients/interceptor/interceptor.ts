import type { UserService } from "@/services/user/UserService"
import { userStore } from "@/models/user/stores"
import type { Container } from "@/services/ServiceContainer"
import { RoutePath } from "@/constants/routes"
import type { InterceptorContext } from "../../core/HttpClient"
import { LoginValueKey } from "@/pages/login/constants"
import type { AccountService } from "@/services/user/AccountService"
import { UrlUtils } from "@/apis/utils"
import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import magicToast from "@/components/base/MagicToaster/utils"

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
	/** api平台无权限 */
	PlatformUnauthorized = 70007,
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
	/** 登录无效处理: 清除登录态、重定向登录页 */
	async function unAuthorizedRedirect() {
		await service.get<AccountService>("accountService").deleteAccount()
		if (window.location.pathname !== RoutePath.Login) {
			// window.history.pushState({}, "", genLoginRedirectUrl())
			// 退出登录需要重定向当前路由，重置应用所有状态
			window.location.replace(genLoginRedirectUrl())
		}
	}

	return async function unAuthorized({ request, response, http }: InterceptorContext) {
		const { enableAuthorizationVerification = true } = request

		if (
			(enableAuthorizationVerification && response.status === HttpStatusCode.Unauthorized) ||
			response?.data?.code === 3103
		) {
			const authorization = request.headers?.get("authorization")
			const user = userStore.account.getAccountByAccessToken(authorization || "")
			/** 当且仅当集群编码映射异常，纠正请求请求集群对应域名，API 重试 */
			if (user) {
				const baseUrl = http.getBaseURL(user.deployCode)
				if (baseUrl) {
					// 返回新的api请求
					http.setBaseURL(UrlUtils.parse(baseUrl).origin)
					const res = await http.retry({
						...request,
						url: UrlUtils.replaceHostname(
							request.url as string,
							UrlUtils.parse(baseUrl).host,
						),
					})

					// Parse JSON data (only needs to be executed once)
					const jsonData = (await UrlUtils.responseParse(res.clone())).data

					if (
						(enableAuthorizationVerification &&
							res.status === HttpStatusCode.Unauthorized) ||
						jsonData?.data?.code === 3103
					) {
						await unAuthorizedRedirect()
						throw new Error("Unauthorized")
					}

					return {
						request,
						response: {
							status: res.status,
							statusText: res.statusText,
							headers: res.headers,
							data: jsonData,
						},
					}
				}
			}
			await unAuthorizedRedirect()
			throw new Error("Unauthorized")
		}
		return { request, response }
	}
}

/** 组织无效 */
export function generateInvalidOrgResInterceptor(service: Container) {
	return async function invalidOrg({ request, response }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code === BusinessResponseCode.InvalidOrganization) {
			service
				.get<UserService>("userService")
				.setMagicOrganizationCode(userStore.user.organizations?.[0]?.organization_code)
			window.location.reload()
		}
		return { request, response }
	}
}

/** api平台无权限 */
export function generatePlatformUnauthorizedResInterceptor() {
	return async function invalidPlatform({ request, response }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code !== BusinessResponseCode.PlatformUnauthorized) {
			return { request, response }
		}
	}
}

/** 成功响应 */
export function generateSuccessResInterceptor() {
	return async function success({ request, response }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code !== BusinessResponseCode.Success) {
			if (request?.enableErrorMessagePrompt && jsonResponse?.message) {
				/** 业务入侵性调整 */
				if (jsonResponse?.code !== BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION) {
					magicToast.error(jsonResponse.message)
				}
			}
			throw jsonResponse
		}

		return { request, response }
	}
}
