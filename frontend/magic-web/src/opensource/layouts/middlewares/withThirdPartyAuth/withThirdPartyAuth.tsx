import { useDebounceFn, useThrottleEffect } from "ahooks"
import type { ComponentType, JSX, MemoExoticComponent } from "react"
import { useState } from "react"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { RoutePath } from "@/opensource/constants/routes"
import { baseHistory, history } from "@/opensource/routes/history"
import { RouteName } from "@/opensource/routes/constants"
import { logger as Logger } from "@/opensource/utils/log"
import { useAuthorization } from "@/opensource/models/user/hooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { AuthApi, CommonApi } from "@/opensource/apis"
import { service } from "@/opensource/services"
import type { LoginService } from "@/opensource/services/user/LoginService"
import type { UserService } from "@/opensource/services/user/UserService"
import type { ConfigService } from "@/opensource/services/config/ConfigService"
import { useTranslation } from "react-i18next"
import { getAuthCode } from "./Strategy"
import { useStyles } from "./styles"
import { thirdPartyOpenLink } from "./utils/openLink"
import { userStore } from "@/opensource/models/user"
import { convertSearchParams, routesMatch } from "@/opensource/routes/history/helpers"
import { defaultClusterCode } from "@/opensource/routes/helpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

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
		const { styles } = useStyles()
		const { t } = useTranslation("interface")

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
					logger.error(
						"temporary authorization code call exception",
						`tempToken: ${tempToken}`,
						error,
					)
					// Need to redirect to login route
					history.push({ name: RouteName.Login })
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
					logger.error("login free error", `deployCode: ${deployCode}`, error)
					magicToast.error(error?.message)

					// Need to redirect to login route
					history.push({ name: RouteName.Login })
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
							// Prohibit the non login process when there is a temporary authorization code
							if (tempAuthorizationCode) {
								await generateAuthorizationToken(tempAuthorizationCode)
							} else if (thirdPartyAuthDeployCode) {
								// If and only if there is a private exclusive code can it trigger login exemption
								await handleAutoLogin(thirdPartyAuthDeployCode)
							}
						}
					} catch (error) {
						logger.error("login free mount error", error)
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
					wrapperClassName={styles.spin}
				>
					<div style={{ height: "100vh" }} />
				</MagicSpin>
			)
		}

		return <WrapperComponent {...props} />
	}
}
