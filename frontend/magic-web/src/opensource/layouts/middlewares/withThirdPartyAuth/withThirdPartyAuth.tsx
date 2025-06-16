import { useDebounceFn, useMount } from "ahooks"
import type { ComponentType, JSX, MemoExoticComponent } from "react"
import { useState } from "react"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { message } from "antd"
import type { Login } from "@/types/login"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { RoutePath } from "@/const/routes"
import Logger from "@/utils/log/Logger"
import { useAuthorization } from "@/opensource/models/user/hooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { AuthApi, CommonApi } from "@/opensource/apis"
import { loginService, userService, configService } from "@/services"
import { useTranslation } from "react-i18next"
import { getAuthCode } from "./Strategy"
import { useStyles } from "./styles"
import { thirdPartyOpenLink } from "./utils/openLink"

const console = new Logger("withThirdPartyAuth")

/** Temporary authorization code in query */
const TempAuthorizationCodeKey = "tempAuthorizationCode"
const ThirdPartyAuthDeployCodeKey = "thirdPartyAuthDeployCode"

export function withThirdPartyAuth<T extends object>(
	WrapperComponent: ComponentType<T> | MemoExoticComponent<() => JSX.Element>,
) {
	return function WithThirdPartyAuth(props: T) {
		const { styles } = useStyles()
		const { t } = useTranslation("interface")

		const navigate = useNavigate()
		const { setClusterCode } = useClusterCode()
		const { setAuthorization } = useAuthorization()

		const [isLoading, setLoading] = useState(true)

		/** Process temporary authorization token, exchange for user token, save locally, and remove corresponding query */
		const { run: generateAuthorizationToken } = useDebounceFn(
			async (tempToken: string) => {
				const { teamshare_token } = await AuthApi.getUserTokenFromTempToken(tempToken)
				setAuthorization(teamshare_token)
				const { clusterCode } = await loginService.syncClusterConfig()
				setClusterCode(clusterCode)

				const magicOrgSyncStep = loginService.magicOrganizationSyncStep(
					clusterCode as string,
				)
				const userSyncStep = loginService.accountSyncStep(clusterCode as string)
				return (
					Promise.resolve()
						/**
						 * Before obtaining the temporary authorization code that is currently exempt from login,
						 * it is necessary to obtain the corresponding privatization configuration based on
						 * the privatization exclusive code and set it before authorization can be granted
						 * (as authorization requires obtaining the corresponding third-party organization ID, application key, etc.)
						 */
						.then(() => {
							return Promise.resolve({
								access_token: teamshare_token,
							} as Login.UserLoginsResponse)
						})
						.then(magicOrgSyncStep)
						// @ts-ignore
						.then(loginService.organizationFetchStep)
						.then(loginService.organizationSyncStep)
						.then(userSyncStep)
						.then(() => {
							/**
							 * After obtaining the privatization configuration, update the current deployment module status
							 * (privatization deployment configuration, current privatization configuration code, current
							 * privatization form filling record, etc.)
							 */
							const url = new URL(window.location.href)
							const { searchParams } = url
							searchParams.delete(TempAuthorizationCodeKey)
							navigate(`${url.pathname}${url.search}`)
						})
						.then(() => userService.wsLogin({ showLoginLoading: true }))
						.catch((error) => {
							console.error("Abnormal authorization acquisition", "error", ...error)
							// Need to redirect to login route
							window.location.assign(RoutePath.Login)
						})
				)
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		/** After replacing the temporary authorization token, the query will be carried and redirected again */
		const { run: redirectUrlStep } = useDebounceFn(
			async () => {
				const { temp_token } = await AuthApi.getTempTokenFromUserToken()
				const url = new URL(window.location.href)
				const { searchParams } = url
				const redirect = searchParams.get(LoginValueKey.REDIRECT_URL)
				if (redirect) {
					// Regarding the existence of off-site addresses, special handling is applied to the corresponding redirection URL
					const redirectUrl = new URL(decodeURIComponent(redirect))
					redirectUrl.searchParams.set(TempAuthorizationCodeKey, temp_token)
					thirdPartyOpenLink(redirectUrl.toString(), "dingtalk")
				} else {
					// Regarding the redirection within the platform, the routing parameters that need to be processed include removing the redirection address and adding a temporary authorization token
					searchParams.delete(LoginValueKey.REDIRECT_URL)
					searchParams.delete(ThirdPartyAuthDeployCodeKey)
					searchParams.set(TempAuthorizationCodeKey, temp_token)
					searchParams.toString()
					// The login free middleware needs to restore the open page's path name
					url.pathname = "/"
					thirdPartyOpenLink(url.toString(), "dingtalk")
				}
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		/** Submit data and handle the logic of different login methods uniformly */
		const { run: handleAutoLogin } = useDebounceFn(
			(deployCode: string) => {
				const magicOrgSyncStep = loginService.magicOrganizationSyncStep(
					deployCode as string,
				)
				const userSyncStep = loginService.accountSyncStep(deployCode as string)

				return (
					Promise.resolve()
						/**
						 * Before obtaining the temporary authorization code that is currently exempt from login,
						 * it is necessary to obtain the corresponding privatization configuration based on
						 * the privatization exclusive code and set it before authorization can be granted
						 * (as authorization requires obtaining the corresponding third-party organization ID, application key, etc.)
						 */
						.then(async () => {
							const data = await CommonApi.getPrivateConfigure(deployCode)
							setClusterCode(deployCode)
							/**
							 * After obtaining the privatization configuration, update the current deployment module status
							 * (privatization deployment configuration, current privatization configuration code, current
							 * privatization form filling record, etc.)
							 */
							await configService.setClusterConfig(deployCode, data.config)
							return Promise.resolve(deployCode)
						})
						.then(() => {
							return getAuthCode(deployCode)
						})
						.then((...args) => {
							console.error("getAuthCode", ...args)
							return Promise.resolve(...args)
						})
						.then(async (result: { authCode: string; platform: Login.LoginType }) => {
							return loginService.loginStep(result.platform, {
								platform_type: result?.platform,
								authorization_code: result?.authCode,
								redirect: window.location.href,
							})()
						})
						.then(loginService.authorizationSyncStep)
						.then(magicOrgSyncStep)
						// @ts-ignore
						.then(loginService.organizationFetchStep)
						.then(loginService.organizationSyncStep)
						.then(userSyncStep)
						.then(redirectUrlStep)
						.catch((error) => {
							console.error("error", error)
							message.error(error?.message)

							// Need to redirect to login route
							window.location.assign(RoutePath.Login)
						})
				)
			},
			{ wait: 3000, leading: true, trailing: false },
		)

		useMount(async () => {
			try {
				const url = new URL(window.location.href)
				const { searchParams } = url
				const tempAuthorizationCode = searchParams.get(TempAuthorizationCodeKey)
				const thirdPartyAuthDeployCode = searchParams.get(ThirdPartyAuthDeployCodeKey) // 私有化专属码

				// Prohibit the non login process when there is a temporary authorization code
				if (tempAuthorizationCode) {
					await generateAuthorizationToken(tempAuthorizationCode)
				} else if (thirdPartyAuthDeployCode) {
					// If and only if there is a private exclusive code can it trigger login exemption
					await handleAutoLogin(thirdPartyAuthDeployCode)
				}
			} catch (error) {
				console.error("init", error)
			} finally {
				setLoading(false)
			}
		})

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
