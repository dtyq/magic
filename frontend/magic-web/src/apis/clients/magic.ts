import { userStore } from "@/models/user"
import { env } from "@/utils/env"
import { getCurrentLang } from "@/utils/locale"
import { configStore } from "@/models/config"
import { HttpClient, HttpClientParams } from "../core/HttpClient"
import generatorUnionRequest from "@/apis/core/unionRequest"
import { StringUtils } from "../utils"

export class MagicHttpClient extends HttpClient {
	constructor(props: HttpClientParams) {
		super(props)
		this.setupInterceptors()
	}

	private setupInterceptors() {
		// 请求拦截器
		this.addRequestInterceptor(function request(config) {
			// 设置通用请求头
			config.headers?.set("Content-Type", "application/json")
			config.headers?.set("language", getCurrentLang(configStore.i18n.language))

			if (!config.headers?.get("authorization")) {
				const authorization = userStore.user.authorization?.trim()
				if (authorization) config.headers?.set("authorization", authorization)
			}

			// 如果请求头中没有组织代码，则设置组织代码
			if (!config.headers?.get("organization-code")) {
				// 针对 magic API请求需要将组织 Code 换成 magic 生态中的组织 Code，而非 teamshare 的组织 Code
				const magicOrganizationCode = userStore.user.organizationCode?.trim()
				if (magicOrganizationCode)
					config.headers?.set("organization-code", magicOrganizationCode)
			}

			config.headers?.set("request-id", StringUtils.createRequestId())

			return config
		})

		// 错误拦截器
		this.addErrorInterceptor(function errHandler(error) {
			console.error("Request failed:", error)
			return Promise.reject(error)
		})
	}
}

const magicClient = new MagicHttpClient({
	baseURL: env("MAGIC_SERVICE_BASE_URL"),
	getBaseURL(clusterCode: string) {
		return env("MAGIC_SERVICE_BASE_URL", false, clusterCode)
	},
})

const unionRequestDecorator = generatorUnionRequest()

export default unionRequestDecorator(magicClient)
