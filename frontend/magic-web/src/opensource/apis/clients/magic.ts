import { userStore } from "@/opensource/models/user"
import { env } from "@/utils/env"
import { getCurrentLang } from "@/utils/locale"
import { configStore } from "@/opensource/models/config"
import { HttpClient } from "../core/HttpClient"
import generatorUnionRequest from "@/opensource/apis/core/unionRequest"

export class MagicHttpClient extends HttpClient {
	constructor() {
		super(env("MAGIC_SERVICE_BASE_URL"))
		this.setupInterceptors()
	}

	private setupInterceptors() {
		// 请求拦截器
		this.addRequestInterceptor(function request(config) {
			const headers = new Headers(config.headers)

			// 设置通用请求头
			headers.set("Content-Type", "application/json")
			headers.set("language", getCurrentLang(configStore.i18n.language))

			if (!headers.get("authorization")) {
				headers.set("authorization", userStore.user.authorization ?? "")
			}

			// 如果请求头中没有组织代码，则设置组织代码
			if (!headers.get("organization-code")) {
				// 针对 magic API请求需要将组织 Code 换成 magic 生态中的组织 Code，而非 teamshare 的组织 Code
				const magicOrganizationCode = userStore.user.organizationCode
				headers.set("organization-code", magicOrganizationCode ?? "")
			}

			return {
				...config,
				headers,
			}
		})

		// 错误拦截器
		this.addErrorInterceptor(function errHandler(error) {
			console.error("Request failed:", error)
			if (error.code === 2185 && window.location.pathname.startsWith("/admin/")) {
				window.history.pushState({}, "", "/admin/no-authorized")
				window.dispatchEvent(new Event("popstate"))
			}
			return Promise.reject(error)
		})
	}
}

const magicClient = new MagicHttpClient()

const unionRequestDecorator = generatorUnionRequest()

export default unionRequestDecorator(magicClient)
