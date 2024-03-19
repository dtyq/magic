import localDevConfig from "@/apis/config"
// import { createAxiosInstance } from "./creator"
import type { HttpClientParams } from "../core/HttpClient"
import { HttpClient } from "../core/HttpClient"
import generatorUnionRequest from "../core/unionRequest"

// export function getMagicClient() {
// 	const language = "zh_CN"
// 	const { services, user, organization } = config
// 	const baseURL = services.base_url

// 	const magic = createAxiosInstance({
// 		baseURL,
// 		headers: {
// 			"Content-Type": "application/json",
// 			authorization: user.token,
// 			language,
// 			"organization-code": organization.organizationCode,
// 		},
// 	})

// 	return magic
// }

// export const magicClient = getMagicClient()

export class MagicHttpClient extends HttpClient {
	constructor(props: HttpClientParams) {
		super(props)
		this.setupInterceptors()
	}

	private setupInterceptors() {
		// 请求拦截器
		this.addRequestInterceptor(function request(config) {
			const language = "zh_CN"
			const { user, organization } = localDevConfig
			// 设置通用请求头
			config.headers?.set("Content-Type", "application/json")
			config.headers?.set("language", language)

			if (!config.headers?.get("authorization")) {
				config.headers?.set("authorization", user.token ?? "")
			}

			// 如果请求头中没有组织代码，则设置组织代码
			if (!config.headers?.get("organization-code")) {
				// 针对 magic API请求需要将组织 Code 换成 magic 生态中的组织 Code，而非 teamshare 的组织 Code
				const magicOrganizationCode = organization.organizationCode
				config.headers?.set("organization-code", magicOrganizationCode ?? "")
			}

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
	baseURL: localDevConfig.services.base_url,
	getBaseURL: () => {
		return localDevConfig.services.base_url
	},
})

const unionRequestDecorator = generatorUnionRequest()

export default unionRequestDecorator(magicClient)
