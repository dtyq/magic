import { useDebounceFn, useThrottleEffect } from "ahooks"
import type { ComponentType, JSX, MemoExoticComponent } from "react"
import { useState } from "react"
import MagicSpin from "@/components/base/MagicSpin"
import { LoginValueKey } from "@/pages/login/constants"
import { RoutePath } from "@/constants/routes"
import { baseHistory, history } from "@/routes/history"
import { logger as Logger } from "@/infrastructure/logger"
import { useAuthorization } from "@/models/user/hooks"
import { useClusterCode } from "@/providers/ClusterProvider"
import { AuthApi, CommonApi } from "@/apis"
import { service } from "@/services"
import type { LoginService } from "@/services/user/LoginService"
import type { UserService } from "@/services/user/UserService"
import type { ConfigService } from "@/services/config/ConfigService"
import { useTranslation } from "react-i18next"
import { getAuthCode } from "./Strategy"
import { thirdPartyOpenLink } from "./utils/openLink"
import { userStore } from "@/models/user"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { defaultClusterCode } from "@/routes/helpers"
import magicToast from "@/components/base/MagicToaster/utils"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"
import { isAccountDisabledError } from "@/services/auth/AuthFailureClassifier"

const logger = Logger.createLogger("withThirdPartyAuth")

/** Temporary authorization code in query */
export const TempAuthorizationCodeKey = "tempAuthorizationCode"
export const ThirdPartyAuthDeployCodeKey = "thirdPartyAuthDeployCode"

export function withThirdPartyAuth<T extends object>(
	WrapperComponent: ComponentType<T> | MemoExoticComponent<() => JSX.Element>,
	{
		customThirdPartyOpenLink = (url: string, platform: "dingtalk") => {
			thirdPartyOpenLink(url, platform)
		},
	} = {},
) {
	return function WithThirdPartyAuth(props: T) {
		const { t } = useTranslation("interface")
		/** 登录流程的提示文案单独取 login 命名空间，避免与界面文案混用。 */
		const { t: tLogin } = useTranslation("login")

		const { setClusterCode } = useClusterCode()
		const { setAuthorization } = useAuthorization()

		const [isLoading, setLoading] = useState(true)

		/** Process temporary authorization token, exchange for user token, save locally, and remove corresponding query */
		const { run: generateAuthorizationToken } = useDebounceFn(
			async (tempToken: string) => {
				try {
					const { teamshare_token } = await AuthApi.getUserTokenFromTempToken(tempToken)
					if (teamshare_token) {
						// 避免已使用的临时授权token重复使用导致的问题，若出现该场景则无需设置 authorization，直接通过缓存的 authorization 进行后续操作
						setAuthorization(teamshare_token)
					}
					const { clusterCode } = await service
						.get<LoginService>("loginService")
						.syncClusterConfig()
					setClusterCode(clusterCode)
					/**
					 * After obtaining the privatization configuration, update the current deployment module status
					 * (privatization deployment configuration, current privatization configuration code, current
					 * privatization form filling record, etc.)
					 */
					const url = new URL(window.location.href)
					const { searchParams } = url
					searchParams.delete(TempAuthorizationCodeKey)

					const routeMeta = routesMatch(url.pathname)
					// 兼容旧版本路由不存在路由别名问题
					if (routeMeta?.route?.name) {
						history.replace({
							name: routeMeta.route.name,
							params: {
								...routeMeta?.params,
								clusterCode: clusterCode || defaultClusterCode,
							},
							query: convertSearchParams(searchParams),
						})
					} else {
						baseHistory.replace(`${url.pathname}${url.search}`)
					}
				} catch (error: any) {
					logger.error({
						eventKey: "temporary_authorization_code_exchange_failed",
						errorKind: "permission",
						error: error,
						message: "temporary authorization code call exception",
						// 临时授权码属于凭据，只记录是否存在，禁止进入上报内容。
						context: { tempToken },
					})
					// Need to redirect to login route
					authEventBus.emit(AuthEventName.RequestLogin, {
						reason: "third-party-auth-failed",
						source: "third-party",
						returnTo: window.location.href,
						preserveQuery: true,
					})
				}
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		/** After replacing the temporary authorization token, the query will be carried and redirected again */
		const { run: redirectUrlStep } = useDebounceFn(
			async () => {
				const url = new URL(window.location.href)
				const { searchParams } = url

				// 移除私有化部署编码防止逻辑重复执行
				searchParams.delete(ThirdPartyAuthDeployCodeKey)

				// 在当前窗口打开（针对特殊场景优化，在相同tab下继续业务流程）
				if (url.searchParams.get("loginSameWindow") === "true") {
					// 移除第三方集群编码，防止流程死循环
					searchParams.delete(ThirdPartyAuthDeployCodeKey)
					setLoading(false)
					return
				}

				// Open in a new browser window
				const { temp_token } = await AuthApi.getTempTokenFromUserToken()
				const redirect = searchParams.get(LoginValueKey.REDIRECT_URL)

				if (redirect) {
					// Regarding the existence of off-site addresses, special handling is applied to the corresponding redirection URL
					const redirectUrl = new URL(decodeURIComponent(redirect))
					redirectUrl.searchParams.set(TempAuthorizationCodeKey, temp_token)
					searchParams.delete(LoginValueKey.REDIRECT_URL)

					// Synchronize remaining query parameters
					searchParams.forEach((v, k) => {
						redirectUrl.searchParams.set(k, v)
					})
					customThirdPartyOpenLink(redirectUrl.toString(), "dingtalk")
				} else {
					// Regarding the redirection within the platform, the routing parameters that need to be processed include removing the redirection address and adding a temporary authorization token
					searchParams.set(TempAuthorizationCodeKey, temp_token)
					// The login free middleware needs to restore the open page's path name
					if (url.pathname !== RoutePath.Login) {
						customThirdPartyOpenLink(url.toString(), "dingtalk")
					} else {
						url.pathname = RoutePath.Chat
						customThirdPartyOpenLink(url.toString(), "dingtalk")
					}
				}
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		/** Submit data and handle the logic of different login methods uniformly */
		const { run: handleAutoLogin } = useDebounceFn(
			async (deployCode: string) => {
				try {
					/**
					 * Before obtaining the temporary authorization code that is currently exempt from login,
					 * it is necessary to obtain the corresponding privatization configuration based on
					 * the privatization exclusive code and set it before authorization can be granted
					 * (as authorization requires obtaining the corresponding third-party organization ID, application key, etc.)
					 */
					const data = await CommonApi.getPrivateConfigure(deployCode)

					/**
					 * After obtaining the privatization configuration, update the current deployment module status
					 * (privatization deployment configuration, current privatization configuration code, current
					 * privatization form filling record, etc.)
					 */
					await Promise.all([
						service
							.get<ConfigService>("configService")
							.setClusterConfig(deployCode, data.config),
						service.get<ConfigService>("configService").setClusterCode(deployCode),
					])
					setClusterCode(deployCode)

					const { authCode, platform } = await getAuthCode(deployCode)

					const url = new URL(window.location.href)
					const { access_token } = await service
						.get<LoginService>("loginService")
						.loginStep(platform, {
							platform_type: platform,
							authorization_code: authCode,
							redirect: url.toString(),
						})()

					service.get<UserService>("userService").setAuthorization(access_token)

					// Establish a mapping relationship between cluster codes and user tokens
					await service
						.get<LoginService>("loginService")
						.magicOrganizationSync(deployCode, access_token)

					// Optimized for specific scenarios, continue the business process under the same tab
					await redirectUrlStep()
				} catch (error: any) {
					logger.error({
						eventKey: "login_free_failed",
						errorKind: "permission",
						error: error,
						message: "login free error",
						context: { deployCode },
					})
					magicToast.error(error?.message)

					// Need to redirect to login route
					authEventBus.emit(AuthEventName.RequestLogin, {
						reason: "third-party-auth-failed",
						source: "third-party",
						returnTo: window.location.href,
						preserveQuery: true,
					})
				}
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		useThrottleEffect(
			() => {
				const init = async () => {
					try {
						const url = new URL(window.location.href)
						const { searchParams } = url
						const tempAuthorizationCode = searchParams.get(TempAuthorizationCodeKey)
						const thirdPartyAuthDeployCode = searchParams.get(
							ThirdPartyAuthDeployCodeKey,
						) // Privatized exclusive code

						try {
							// Prioritize verifying whether authorization is available in the cache (and in the presence of a privatized exclusive code)
							const { authorization } = userStore.user
							if (authorization && thirdPartyAuthDeployCode) {
								await service
									.get<LoginService>("loginService")
									.magicOrganizationSync(thirdPartyAuthDeployCode, authorization)
								await redirectUrlStep()
							} else {
								throw new Error("thirdPartyAuthDeployCode is required")
							}
						} catch (err) {
							/*
							 * 账号被平台禁用（3109）是确定的终态：继续走临时码换 token 或免登
							 * 只会再撞一次同样的错误，因此这里直接提示并终止整个免登初始化。
							 */
							if (isAccountDisabledError(err)) {
								magicToast.error(
									tLogin("magicOrganizationSyncStep.accountDisabled"),
								)
								return
							}
							// Prohibit the non login process when there is a temporary authorization code
							if (tempAuthorizationCode) {
								await generateAuthorizationToken(tempAuthorizationCode)
							} else if (thirdPartyAuthDeployCode) {
								// If and only if there is a private exclusive code can it trigger login exemption
								await handleAutoLogin(thirdPartyAuthDeployCode)
							}
						}
					} catch (error) {
						logger.error({
							eventKey: "login_free_mount_failed",
							errorKind: "permission",
							error: error,
							message: "login free mount error",
						})
					} finally {
						setLoading(false)
					}
				}
				init()
			},
			[],
			{ wait: 1000, leading: true, trailing: false },
		)

		if (isLoading) {
			return (
				<MagicSpin
					spinning={isLoading}
					tip={t("spin.loadingLogin")}
					wrapperClassName="[&_.magic-spin-blur]:opacity-100 [&_.magic-spin]:[--magic-spin-content-height:unset]"
				>
					<div className="h-screen" />
				</MagicSpin>
			)
		}

		return <WrapperComponent {...props} />
	}
}
