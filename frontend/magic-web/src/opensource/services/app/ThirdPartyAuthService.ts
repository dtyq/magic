import { AuthApi, CommonApi } from "@/opensource/apis"
import { service } from "@/opensource/services"
import { RoutePath } from "@/opensource/constants/routes"
import { baseHistory, history } from "@/opensource/routes/history"
import { RouteName } from "@/opensource/routes/constants"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { convertSearchParams, routesMatch } from "@/opensource/routes/history/helpers"
import { defaultClusterCode } from "@/opensource/routes/helpers"
import { userStore } from "@/opensource/models/user"
import type { Login } from "@/opensource/types/login"
import type { LoginService } from "@/opensource/services/user/LoginService"
import type { UserService } from "@/opensource/services/user/UserService"
import type { ConfigService } from "@/opensource/services/config/ConfigService"
import { thirdPartyOpenLink } from "@/opensource/layouts/middlewares/withThirdPartyAuth/utils/openLink"

// const logger = Logger.createLogger("thirdPartyAuthService")
const logger = { ...console, report: console.log }

/** Temporary authorization code in query */
export const TempAuthorizationCodeKey = "tempAuthorizationCode"
export const thirdPartyOrganizationCodeKey = "thirdPartyOrganizationCode"

/**
 * Get auth code function type
 */
export type GetAuthCodeFn = (
	deployCode: string,
) => Promise<{ authCode: string; platform: Login.LoginType }>

/**
 * Custom third party open link function type
 */
export type CustomThirdPartyOpenLinkFn = (url: string, platform: "dingtalk") => void

/**
 * Third party auth service options
 */
export interface ThirdPartyAuthServiceOptions {
	/** Get auth code function */
	getAuthCode: GetAuthCodeFn
	/** Custom third party open link function (optional) */
	customThirdPartyOpenLink?: CustomThirdPartyOpenLinkFn
	/** Third party organization code key in query */
	thirdPartyAuthDeployCode: string
	onClusterCodeChange?: (clusterCode: string) => void
}

/**
 * Third Party Auth Service
 * @description Service for handling third-party authentication logic
 */
class ThirdPartyAuthService {
	private getAuthCode: GetAuthCodeFn
	private customThirdPartyOpenLink: CustomThirdPartyOpenLinkFn
	private thirdPartyAuthDeployCode: string
	private onClusterCodeChange?: (clusterCode: string) => void

	constructor(options: ThirdPartyAuthServiceOptions) {
		this.getAuthCode = options.getAuthCode
		this.customThirdPartyOpenLink = options.customThirdPartyOpenLink || thirdPartyOpenLink
		this.thirdPartyAuthDeployCode = options.thirdPartyAuthDeployCode
		this.onClusterCodeChange = options.onClusterCodeChange
		logger.log("第三方认证服务初始化完成", {
			thirdPartyOrganizationCodeKey: this.thirdPartyAuthDeployCode,
			hasCustomOpenLink: !!options.customThirdPartyOpenLink,
		})
	}

	/**
	 * 从URL中获取集群代码和来源
	 * @returns { clusterCode: string | undefined; hasClusterCode: boolean; origin: "query" | "route" } Get cluster code and origin
	 */
	getClusterCodeFromUrl(): {
		clusterCode: string | undefined
		hasClusterCode: boolean
		/** 集群代码来源 */
		/** @description "query" 表示集群代码来自查询参数, "route" 表示集群代码来自路由 */
		origin: "query" | "route"
	} {
		const url = new URL(window.location.href)
		const { searchParams } = url
		const clusterCodeFromQuery = searchParams.get(this.thirdPartyAuthDeployCode)
		if (clusterCodeFromQuery) {
			return {
				clusterCode: clusterCodeFromQuery,
				hasClusterCode: true,
				origin: "query",
			}
		}

		// const routeMeta = routesMatch(url.pathname)
		// const clusterCodeFromRoute = routeMeta?.params?.clusterCode
		// if (clusterCodeFromRoute && clusterCodeFromRoute !== defaultClusterCode) {
		// 	return {
		// 		clusterCode: clusterCodeFromRoute,
		// 		hasClusterCode: true,
		// 		origin: "route",
		// 	}
		// }
		return {
			clusterCode: undefined,
			hasClusterCode: false,
			origin: clusterCodeFromQuery ? "query" : "route",
		}
	}

	/**
	 * Check if third party auth parameters exist
	 */
	hasThirdPartyAuthParams(): boolean {
		const url = new URL(window.location.href)
		const { searchParams } = url
		const { hasClusterCode } = this.getClusterCodeFromUrl()
		const hasTempAuthCode = !!searchParams.get(TempAuthorizationCodeKey)
		const hasParams = hasTempAuthCode || hasClusterCode
		logger.log("检查第三方认证参数", {
			hasTempAuthCode,
			hasClusterCode,
			hasParams,
			thirdPartyAuthDeployCode: this.thirdPartyAuthDeployCode,
		})

		return hasTempAuthCode || hasClusterCode
	}

	/**
	 * Get third party organization code from URL query
	 */
	getThirdPartyOrganizationCode(): string | null {
		const url = new URL(window.location.href)
		const orgCode = url.searchParams.get(thirdPartyOrganizationCodeKey)
		if (orgCode) {
			logger.log("获取第三方组织代码", { orgCode })
		}
		return orgCode
	}

	/**
	 * Process temporary authorization token, exchange for user token,
	 * save locally, and remove corresponding query
	 */
	async generateAuthorizationToken(tempToken: string): Promise<void> {
		logger.log("开始生成授权令牌", { tempToken: tempToken.substring(0, 10) + "..." })
		try {
			logger.log("调用API将临时令牌转换为用户令牌")
			const { teamshare_token } = await AuthApi.getUserTokenFromTempToken(tempToken)
			if (teamshare_token) {
				logger.log("设置用户授权令牌")
				// Avoid issues caused by reusing temporary authorization tokens that have already been used.
				// If this scenario occurs, there is no need to set authorization,
				// and subsequent operations can be performed directly through the cached authorization.
				service.get<UserService>("userService").setAuthorization(teamshare_token)
			} else {
				logger.log("未获取到用户令牌，可能已使用过临时令牌")
			}

			logger.log("同步集群配置")
			const { clusterCode } = await service
				.get<LoginService>("loginService")
				.syncClusterConfig()
			logger.log("设置集群代码", { clusterCode })

			service.get<ConfigService>("configService").setClusterCode(clusterCode)
			this.onClusterCodeChange?.(clusterCode)

			const url = new URL(window.location.href)
			const { searchParams } = url
			searchParams.delete(TempAuthorizationCodeKey)
			logger.log("删除临时授权码查询参数")

			const routeMeta = routesMatch(url.pathname)
			// Compatible with old version routing where route alias may not exist
			if (routeMeta?.route?.name) {
				logger.log("更新路由", {
					routeName: routeMeta.route.name,
					clusterCode: clusterCode || defaultClusterCode,
				})
				history.replace({
					name: routeMeta.route.name,
					params: {
						...routeMeta?.params,
						clusterCode: clusterCode || defaultClusterCode,
					},
					query: convertSearchParams(searchParams),
				})
			} else {
				logger.log("使用基础历史记录更新路由", { pathname: url.pathname })
				baseHistory.replace(`${url.pathname}${url.search}`)
			}
			logger.log("授权令牌生成完成")
		} catch (error: any) {
			logger.error("临时授权码转换失败", {
				tempToken: tempToken.substring(0, 10) + "...",
				error,
			})
			// Need to redirect to login route
			logger.log("重定向到登录页")
			history.push({ name: RouteName.Login })
			throw error
		}
	}

	/**
	 * After replacing the temporary authorization token,
	 * the query will be carried and redirected again
	 */
	async redirectUrlStep(): Promise<void> {
		logger.log("开始URL重定向步骤")
		const url = new URL(window.location.href)
		const { searchParams } = url

		// Remove private deployment code to prevent logic from repeating
		searchParams.delete(this.thirdPartyAuthDeployCode)
		logger.log("删除私有化部署代码查询参数", {
			thirdPartyOrganizationCodeKey: this.thirdPartyAuthDeployCode,
		})

		// Open in current window (optimized for specific scenarios,
		// continue business process in the same tab)
		if (url.searchParams.get("loginSameWindow") === "true") {
			logger.log("检测到同窗口登录标识，跳过重定向")
			// Remove third-party cluster code to prevent process dead loop
			searchParams.delete(this.thirdPartyAuthDeployCode)
			return
		}

		// Open in a new browser window
		logger.log("获取临时令牌用于重定向")
		const { temp_token } = await AuthApi.getTempTokenFromUserToken()
		const redirect = searchParams.get(LoginValueKey.REDIRECT_URL)

		if (redirect) {
			logger.log("检测到外部重定向地址，处理外部重定向", { redirect })
			// Regarding the existence of off-site addresses,
			// special handling is applied to the corresponding redirection URL
			const redirectUrl = new URL(decodeURIComponent(redirect))
			redirectUrl.searchParams.set(TempAuthorizationCodeKey, temp_token)
			searchParams.delete(LoginValueKey.REDIRECT_URL)

			// Synchronize remaining query parameters
			searchParams.forEach((v, k) => {
				redirectUrl.searchParams.set(k, v)
			})
			logger.log("打开外部重定向链接", { redirectUrl: redirectUrl.toString() })
			this.customThirdPartyOpenLink(redirectUrl.toString(), "dingtalk")
		} else {
			logger.log("处理平台内重定向")
			// Regarding the redirection within the platform,
			// the routing parameters that need to be processed include removing
			// the redirection address and adding a temporary authorization token
			searchParams.set(TempAuthorizationCodeKey, temp_token)
			// The login free middleware needs to restore the open page's path name
			if (url.pathname !== RoutePath.Login) {
				logger.log("当前不在登录页，打开当前页面链接", { pathname: url.pathname })
				this.customThirdPartyOpenLink(url.toString(), "dingtalk")
			} else {
				logger.log("当前在登录页，重定向到聊天页面")
				url.pathname = RoutePath.Chat
				this.customThirdPartyOpenLink(url.toString(), "dingtalk")
			}
		}
		logger.log("URL重定向步骤完成")
	}

	/**
	 * Submit data and handle the logic of different login methods uniformly
	 */
	async handleAutoLogin(deployCode: string): Promise<void> {
		logger.log("开始处理自动登录流程", { deployCode })
		try {
			/**
			 * Before obtaining the temporary authorization code that is currently exempt from login,
			 * it is necessary to obtain the corresponding privatization configuration based on
			 * the privatization exclusive code and set it before authorization can be granted
			 * (as authorization requires obtaining the corresponding third-party organization ID, application key, etc.)
			 */
			logger.log("获取私有化配置", { deployCode })
			const data = await CommonApi.getPrivateConfigure(deployCode)
			logger.log("私有化配置获取完成")

			/**
			 * After obtaining the privatization configuration, update the current deployment module status
			 * (privatization deployment configuration, current privatization configuration code, current
			 * privatization form filling record, etc.)
			 */
			logger.log("设置集群配置和集群代码", { deployCode })
			await Promise.all([
				service
					.get<ConfigService>("configService")
					.setClusterConfig(deployCode, data.config),
				service.get<ConfigService>("configService").setClusterCode(deployCode),
			])

			this.onClusterCodeChange?.(deployCode)

			logger.log("集群配置设置完成")

			logger.log("获取授权码", { deployCode })
			const { authCode, platform } = await this.getAuthCode(deployCode)
			logger.log("授权码获取完成", { platform, authCodeLength: authCode?.length })

			const url = new URL(window.location.href)
			logger.log("执行登录步骤", { platform, redirect: url.toString() })
			const { access_token } = await service
				.get<LoginService>("loginService")
				.loginStep(platform, {
					platform_type: platform,
					authorization_code: authCode,
					redirect: url.toString(),
				})()
			logger.log("登录步骤完成，获取到访问令牌")

			logger.log("设置用户授权令牌")
			service.get<UserService>("userService").setAuthorization(access_token)

			// Establish a mapping relationship between cluster codes and user tokens
			logger.log("同步魔法组织映射关系", { deployCode })
			await service
				.get<LoginService>("loginService")
				.magicOrganizationSync(deployCode, access_token)
			logger.log("魔法组织映射关系同步完成")

			// Optimized for specific scenarios, continue the business process under the same tab
			logger.log("执行URL重定向步骤")
			await this.redirectUrlStep()
			logger.log("自动登录流程完成")
		} catch (error: any) {
			logger.error("自动登录流程失败", { deployCode, error })
			// Need to redirect to login route
			logger.log("重定向到登录页")
			history.push({ name: RouteName.Login })
			throw error
		}
	}

	/**
	 * Initialize third party auth process
	 * @description Main entry point for third party authentication flow
	 */
	async init(): Promise<void> {
		logger.log("开始初始化第三方认证流程")
		// 每次经来都需要通过判断当前用户token是否为空，若为空且query存在组织编码且命中第三方环境下则做私有化环境免登流程
		const { authorization } = userStore.user
		const url = new URL(window.location.href)
		const { searchParams } = url
		const tempAuthorizationCode = searchParams.get(TempAuthorizationCodeKey)
		const { clusterCode: thirdPartyAuthDeployCode } = this.getClusterCodeFromUrl()

		logger.log("检查认证参数和用户状态", {
			hasTempAuthorizationCode: !!tempAuthorizationCode,
			thirdPartyAuthDeployCode: !!thirdPartyAuthDeployCode,
			hasAuthorization: !!authorization,
			thirdPartyOrganizationCodeKey: this.thirdPartyAuthDeployCode,
		})

		if (authorization && thirdPartyAuthDeployCode) {
			// 优先判断当前 authorization 是否为 thirdPartyAuthDeployCode 集群，如果不是则强制走免登流程
			const { login_code } = await AuthApi.getAccountDeployCode()
			if (login_code !== thirdPartyAuthDeployCode) {
				await this.handleAutoLogin(thirdPartyAuthDeployCode)
				return
			}
			await service
				.get<LoginService>("loginService")
				.magicOrganizationSync(thirdPartyAuthDeployCode, authorization)
			await this.redirectUrlStep()
		} else if (tempAuthorizationCode) {
			await this.generateAuthorizationToken(tempAuthorizationCode)
		} else if (thirdPartyAuthDeployCode) {
			// If and only if there is a private exclusive code can it trigger login exemption
			await this.handleAutoLogin(thirdPartyAuthDeployCode)
		} else {
			throw new Error("no third party auth params")
		}
	}
}

export default ThirdPartyAuthService
