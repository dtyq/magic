import localDevConfig from "@/apis/config"
// import { createAxiosInstance } from "./creator"
import type { HttpClientParams } from "../core/HttpClient"
import { HttpClient } from "../core/HttpClient"
import generatorUnionRequest from "../core/unionRequest"

// export function getTeamshareClient() {
// 	const language = "zh_CN"
// 	const { services, user, organization } = config
// 	const baseURL = services.teamshare_base_url
// 	const teamshare = createAxiosInstance({
// 		baseURL,
// 		headers: {
// 			"Content-Type": "application/json",
// 			authorization: user.token,
// 			language,
// 			"organization-code": organization.organizationCode,
// 		},
// 	})

// 	return teamshare
// }

// export const teamshareClient = getTeamshareClient()

export class TeamshareHttpClient extends HttpClient {
	constructor(props: HttpClientParams) {
		super(props)
		this.setupInterceptors()
	}

	setupInterceptors() {
		// request interceptor
		this.addRequestInterceptor((config) => {
			const language = "zh_CN"
			const { user, organization } = localDevConfig
			// Set universal request header
			config.headers?.set("Content-Type", "application/json")
			if (!config.headers?.get("authorization") && config.enableAuthorization) {
				config.headers?.set("authorization", user.token ?? "")
			}
			config.headers?.set("language", language)

			// If there is no organization code in the request header, set the organization code
			if (!config.headers?.get("organization-code")) {
				const { teamshareOrganizationCode, teamshareOrganizationInfo } = organization
				if (teamshareOrganizationCode) {
					config.headers?.set("organization-code", teamshareOrganizationCode ?? "")
				} else {
					config.headers?.set(
						"organization-code",
						teamshareOrganizationInfo.organization_code ?? "",
					)
				}
			}
			// config.headers?.set("request-id", StringUtils.createRequestId())
			return config
		})

		// 错误拦截器
		this.addErrorInterceptor((error) => {
			console.error("Request failed:", error)
			return Promise.reject(error)
		})
	}
}

const teamshareClient = new TeamshareHttpClient({
	baseURL: localDevConfig.services.teamshare_base_url,
	getBaseURL: () => {
		return localDevConfig.services.teamshare_base_url
	},
})

const unionRequestDecorator = generatorUnionRequest()

export default unionRequestDecorator(teamshareClient)
