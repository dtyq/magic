/**
 * iframeClient
 *
 * 面向 iframe 内嵌场景的轻量 HTTP 客户端。
 *
 * 与主站 magicClient 共享相同的基础设施（baseURL、auth header、organization-code），
 * 但 **不注册** 以下全局响应拦截器：
 *   - 401 → 跳转登录页
 *   - 组织无效 → reload
 *   - 平台无权限 → toast
 *   - 业务 code !== 1000 → toast
 *
 * 这样当 iframe 侧发起的请求遇到权限问题时，错误会被正常抛出，
 * 由 IframeFSService / IframeLLMService 的 try-catch 捕获并通过
 * postMessage 返回给 HTML 应用自行处理，而不会导致主站跳转登录页。
 */

import { userStore } from "@/models/user"
import { env } from "@/utils/env"
import { getCurrentLang } from "@/utils/locale"
import { configStore } from "@/models/config"
import { HttpClient, type HttpClientParams } from "../core/HttpClient"
import { StringUtils } from "../utils"
import { createWaitForAppInitRequestInterceptor } from "./await-app-init"

class IframeHttpClient extends HttpClient {
	constructor(props: HttpClientParams) {
		super(props)
		this.setupInterceptors()
	}

	private setupInterceptors() {
		this.addRequestInterceptor(createWaitForAppInitRequestInterceptor())

		this.addRequestInterceptor(function request(config) {
			config.headers?.set("Content-Type", "application/json")
			config.headers?.set("language", getCurrentLang(configStore.i18n.displayLanguage))

			if (!config.headers?.get("authorization")) {
				const authorization = userStore.user.authorization?.trim()
				if (authorization) config.headers?.set("authorization", authorization)
			}

			if (!config.headers?.get("organization-code")) {
				const magicOrganizationCode = userStore.user.organizationCode?.trim()
				if (magicOrganizationCode)
					config.headers?.set("organization-code", magicOrganizationCode)
			}

			config.headers?.set("request-id", StringUtils.createRequestId())

			return config
		})

		// 仅打印错误日志，不做额外处理（不 toast、不跳转）
		this.addErrorInterceptor(function errHandler(error) {
			console.error("[iframeClient] Request failed:", error)
			return Promise.reject(error)
		})
	}
}

const iframeClient = new IframeHttpClient({
	baseURL: env("MAGIC_SERVICE_BASE_URL"),
	getBaseURL(clusterCode: string) {
		return env("MAGIC_SERVICE_BASE_URL", false, clusterCode)
	},
})

export default iframeClient
