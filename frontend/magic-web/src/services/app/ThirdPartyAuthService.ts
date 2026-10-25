import { AuthApi, CommonApi } from "@/apis"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { service } from "@/services"
import { RoutePath } from "@/constants/routes"
import { baseHistory, history } from "@/routes/history"
import { LoginValueKey } from "@/pages/login/constants"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { defaultClusterCode } from "@/routes/helpers"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import type { Login } from "@/types/login"
import type { User } from "@/types/user"
import type { LoginService } from "@/services/user/LoginService"
import type { UserService } from "@/services/user/UserService"
import type { ConfigService } from "@/services/config/ConfigService"
import { thirdPartyOpenLink } from "@/layouts/middlewares/withThirdPartyAuth/utils/openLink"
import { withTimeout } from "@/utils/promise"
import type {
	RequestThirdPartyAccountConflictDecision,
	ResolveThirdPartyAccountOrganizationName,
	ThirdPartyAccountIdentity,
	ThirdPartyAccountReconcileResult,
} from "@/services/app/types/thirdPartyAccountReconcile"
import { isLoginAuthorizationWhitelist } from "@/utils/env"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"
import { isNil } from "lodash-es"

// const logger = Logger.createLogger("thirdPartyAuthService")
const logger = { ...console, report: console.log }

/** Temporary authorization code in query */
export const TempAuthorizationCodeKey = "tempAuthorizationCode"
export const thirdPartyOrganizationCodeKey = "thirdPartyOrganizationCode"
const thirdPartyAccountConflictSuppressionKey = "thirdPartyAccountConflictSuppression"
const thirdPartyBackgroundProbeTimeoutMs = 10000
const thirdPartyOrganizationLookupTimeoutMs = 3000

/**
 * Get auth code function type
 */
export type GetAuthCodeFn = (
	deployCode: string,
	options?: Pick<RequestConfig, "skipAppInitWait">,
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
	/** Determine whether the current platform supports account verification without redirecting the page. */
	canBackgroundProbe?: () => boolean | Promise<boolean>
	/** Request the UI layer to display the account conflict dialog. */
	requestAccountConflictDecision?: RequestThirdPartyAccountConflictDecision
	/** Resolve display-safe organization names without coupling the shared service to a private API. */
	resolveAccountOrganizationName?: ResolveThirdPartyAccountOrganizationName
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
	private canBackgroundProbe?: () => boolean | Promise<boolean>
	private requestAccountConflictDecision?: RequestThirdPartyAccountConflictDecision
	private resolveAccountOrganizationName?: ResolveThirdPartyAccountOrganizationName
	private backgroundReconcilePromise: Promise<ThirdPartyAccountReconcileResult> | null = null

	constructor(options: ThirdPartyAuthServiceOptions) {
		this.getAuthCode = options.getAuthCode
		this.customThirdPartyOpenLink = options.customThirdPartyOpenLink || thirdPartyOpenLink
		this.thirdPartyAuthDeployCode = options.thirdPartyAuthDeployCode
		this.onClusterCodeChange = options.onClusterCodeChange
		this.canBackgroundProbe = options.canBackgroundProbe
		this.requestAccountConflictDecision = options.requestAccountConflictDecision
		this.resolveAccountOrganizationName = options.resolveAccountOrganizationName
		logger.log("第三方认证服务初始化完成", {
			thirdPartyOrganizationCodeKey: this.thirdPartyAuthDeployCode,
			hasCustomOpenLink: !!options.customThirdPartyOpenLink,
		})
	}

	private getAccountConflictFingerprint(
		deployCode: string,
		platform: Login.LoginType,
		currentUser: ThirdPartyAccountIdentity,
		candidateUser: ThirdPartyAccountIdentity,
	) {
		return [deployCode, platform, currentUser.magicId, candidateUser.magicId].join(":")
	}

	private resolveMagicId(authStatus: Array<User.MagicOrganization>): string | null {
		const magicIds = new Set(authStatus.map((item) => item.magic_id).filter(Boolean))
		if (magicIds.size !== 1) {
			logger.warn("候选账号 Magic ID 解析异常", { magicIdCount: magicIds.size })
			return null
		}

		return magicIds.values().next().value ?? null
	}

	private async resolveOrganizationName(
		authorization: string,
		deployCode: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<string | undefined> {
		if (!this.resolveAccountOrganizationName) return undefined

		try {
			return await withTimeout(
				this.resolveAccountOrganizationName({ authorization, deployCode }, options),
				thirdPartyOrganizationLookupTimeoutMs,
				"third party account organization lookup timeout",
			)
		} catch (error) {
			// Organization names are supplemental UI data and must never block account selection.
			logger.warn("第三方平台账号组织名称获取失败", { deployCode, error })
			return undefined
		}
	}

	private getSuppressedAccountConflict() {
		try {
			return sessionStorage.getItem(thirdPartyAccountConflictSuppressionKey)
		} catch {
			return null
		}
	}

	private suppressAccountConflict(fingerprint: string) {
		try {
			sessionStorage.setItem(thirdPartyAccountConflictSuppressionKey, fingerprint)
		} catch {
			// Session storage can be unavailable in restricted WebViews; the current page still remains safe.
		}
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

	private isLoginSameWindow() {
		return new URL(window.location.href).searchParams.get("loginSameWindow") === "true"
	}

	/**
	 * Same-window only: resolve organizations and persist the account entry in the current page.
	 * New-window flows rely on AppService.initAccount in the destination window instead.
	 */
	private async syncAccountSystem(
		deployCode: string,
		accessToken: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<void> {
		const loginService = service.get<LoginService>("loginService")
		const userService = service.get<UserService>("userService")
		const {
			magicOrganizationMap,
			organizationCode,
			thirdPlatformOrganizations,
			thirdPlatformOrganizationCode,
		} = await loginService.getThirdPlatformOrganizations(accessToken, deployCode, options)

		userService.setOrganization({
			organizationCode,
			teamshareOrganizationCode: thirdPlatformOrganizationCode,
			organizations: thirdPlatformOrganizations,
			magicOrganizationMap,
		})

		const urlOrganizationCode = this.getThirdPartyOrganizationCode()
		const teamshareOrganizationCode =
			thirdPlatformOrganizationCode ||
			urlOrganizationCode ||
			userStore.user.teamshareOrganizationCode

		if (urlOrganizationCode) {
			await userService.setTeamshareOrganization(urlOrganizationCode, options)
		}

		await loginService.accountSync(
			{
				deployCode,
				access_token: accessToken,
				magicOrganizationMap,
				organizations: thirdPlatformOrganizations,
				teamshareOrganizationCode,
			},
			options,
		)
	}

	/**
	 * Process temporary authorization token, exchange for user token,
	 * save locally, and remove corresponding query
	 */
	async generateAuthorizationToken(
		tempToken: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<void> {
		logger.log("开始生成授权令牌", { tempToken: tempToken.substring(0, 10) + "..." })
		try {
			logger.log("调用API将临时令牌转换为用户令牌")
			const { teamshare_token } = await AuthApi.getUserTokenFromTempToken(tempToken, options)
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
				.syncClusterConfig(options)
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
			authEventBus.emit(AuthEventName.RequestLogin, {
				reason: "third-party-auth-failed",
				source: "third-party",
				returnTo: window.location.href,
				preserveQuery: true,
			})
			throw error
		}
	}

	/**
	 * After replacing the temporary authorization token,
	 * the query will be carried and redirected again
	 */
	async redirectUrlStep(
		options?: Pick<RequestConfig, "skipAppInitWait">,
		currentAuthorization?: string,
	): Promise<void> {
		const { clusterCode } = this.getClusterCodeFromUrl()
		if (currentAuthorization && clusterCode) {
			// Verify the final account in the background for an existing session before entering either redirect branch.
			this.scheduleExistingSessionRedirect(clusterCode, currentAuthorization, options)
			return
		}

		// Fresh auto-login: sync account only when staying in the current window.
		await this.performRedirectUrlStep(options, {
			reloadCurrentWindow: false,
			syncAccountInSameWindow: true,
		})
	}

	private scheduleExistingSessionRedirect(
		deployCode: string,
		currentAuthorization: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	) {
		const runReconcile = () => {
			void this.reconcileExistingSession(deployCode, currentAuthorization, options)
				.then(async (result) => {
					logger.log("第三方平台账号后台校验完成", { deployCode, result })
					if (result === "stale") return

					await this.performRedirectUrlStep(options, {
						reloadCurrentWindow: result === "switched",
					})
				})
				.catch((error) => {
					logger.warn("第三方平台账号后台校验异常", { deployCode, error })
				})
		}

		// Account reconciliation must not block AppService initialization, but redirect routing must wait for it to finish.
		if ("requestIdleCallback" in window) {
			requestIdleCallback(runReconcile, { timeout: 2000 })
			return
		}

		setTimeout(runReconcile, 0)
	}

	private async performRedirectUrlStep(
		options: Pick<RequestConfig, "skipAppInitWait"> | undefined,
		{
			reloadCurrentWindow = false,
			syncAccountInSameWindow = false,
		}: {
			reloadCurrentWindow?: boolean
			syncAccountInSameWindow?: boolean
		} = {},
	): Promise<void> {
		logger.log("开始URL重定向步骤")
		const url = new URL(window.location.href)
		const { searchParams } = url
		const loginSameWindow = this.isLoginSameWindow()

		// Remove private deployment code to prevent logic from repeating
		searchParams.delete(this.thirdPartyAuthDeployCode)
		logger.log("删除私有化部署代码查询参数", {
			thirdPartyOrganizationCodeKey: this.thirdPartyAuthDeployCode,
		})

		// Open in current window (optimized for specific scenarios,
		// continue business process in the same tab)
		if (loginSameWindow) {
			logger.log("检测到同窗口登录标识，跳过重定向")
			// Remove third-party cluster code to prevent process dead loop
			searchParams.delete(this.thirdPartyAuthDeployCode)

			if (syncAccountInSameWindow && !reloadCurrentWindow && userStore.user.authorization) {
				const deployCode = configStore.cluster.clusterCode ?? ""
				logger.log("同窗口免登，同步账号体系", { deployCode })
				await this.syncAccountSystem(deployCode, userStore.user.authorization, options)
				logger.log("同窗口账号体系同步完成")
			}

			if (reloadCurrentWindow) {
				// The candidate token has been committed; remove the login parameters and reinitialize account state in the current window.
				window.location.replace(url.toString())
			} else {
				window.history.replaceState({}, "", url.toString())
			}
			return
		}

		// Open in a new browser window
		logger.log("获取临时令牌用于重定向")
		const { temp_token } = await AuthApi.getTempTokenFromUserToken(options)
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
			if (isLoginAuthorizationWhitelist(redirectUrl.toString())) {
				this.customThirdPartyOpenLink(redirectUrl.toString(), "dingtalk")
			}
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
	async handleAutoLogin(
		deployCode: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<void> {
		logger.log("开始处理自动登录流程", { deployCode })
		try {
			/**
			 * Before obtaining the temporary authorization code that is currently exempt from login,
			 * it is necessary to obtain the corresponding privatization configuration based on
			 * the privatization exclusive code and set it before authorization can be granted
			 * (as authorization requires obtaining the corresponding third-party organization ID, application key, etc.)
			 */
			logger.log("获取私有化配置", { deployCode })
			const data = await CommonApi.getPrivateConfigure(deployCode, {
				enableRequestUnion: true,
				enableErrorMessagePrompt: false,
				...options,
			})
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
			const { authCode, platform } = await this.getAuthCode(deployCode, options)
			logger.log("授权码获取完成", { platform, authCodeLength: authCode?.length, authCode })

			const url = new URL(window.location.href)
			logger.log("执行登录步骤", { platform, redirect: url.toString() })
			const { access_token } = await service.get<LoginService>("loginService").loginStep(
				platform,
				{
					platform_type: platform,
					authorization_code: authCode,
					redirect: url.toString(),
				},
				undefined,
				options,
			)()
			logger.log("登录步骤完成，获取到访问令牌")

			logger.log("设置用户授权令牌")
			await service.get<UserService>("userService").setAuthorizationAndWait(access_token)

			// Establish a mapping relationship between cluster codes and user tokens
			logger.log("同步魔法组织映射关系", { deployCode })
			const magicOrganizationMap = await service
				.get<LoginService>("loginService")
				.magicOrganizationSync(deployCode, access_token, undefined, options)

			// 第三方组织获取
			const { organizations, organizationCode, thirdPlatformOrganizationCode } = await service
				.get<LoginService>("loginService")
				.getThirdPlatformOrganization(
					magicOrganizationMap,
					access_token,
					deployCode,
					options,
				)

			// 设置组织
			service.get<UserService>("userService").setOrganization({
				organizationCode,
				teamshareOrganizationCode: thirdPlatformOrganizationCode,
				organizations,
				magicOrganizationMap,
			})
			logger.log("魔法组织映射关系同步完成")

			// Optimized for specific scenarios, continue the business process under the same tab
			logger.log("执行URL重定向步骤")
			await this.redirectUrlStep(options)
			logger.log("自动登录流程完成")
		} catch (error: any) {
			logger.error("自动登录流程失败", { deployCode, error })
			// Need to redirect to login route
			logger.log("重定向到登录页")
			authEventBus.emit(AuthEventName.RequestLogin, {
				reason: "third-party-auth-failed",
				source: "third-party",
				returnTo: window.location.href,
				preserveQuery: true,
			})
			throw error
		}
	}

	/**
	 * After restoring the current session, fetch the candidate platform account in the background and compare identities.
	 * Keep the candidate token in the current call stack until the user confirms; do not mutate global stores, cluster state, or persistence.
	 */
	private async reconcileExistingSession(
		deployCode: string,
		currentAuthorization: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<ThirdPartyAccountReconcileResult> {
		if (this.backgroundReconcilePromise) return this.backgroundReconcilePromise

		const reconcileTask = this.runExistingSessionReconcile(
			deployCode,
			currentAuthorization,
			options,
		).finally(() => {
			this.backgroundReconcilePromise = null
		})

		this.backgroundReconcilePromise = reconcileTask
		return reconcileTask
	}

	private async runExistingSessionReconcile(
		deployCode: string,
		currentAuthorization: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<ThirdPartyAccountReconcileResult> {
		if (
			!deployCode ||
			!currentAuthorization ||
			!this.canBackgroundProbe ||
			!this.requestAccountConflictDecision
		) {
			return "skipped"
		}

		try {
			if (!(await this.canBackgroundProbe())) return "unsupported"

			// Load the target deployment configuration for the platform SDK without switching the current access cluster.
			const targetConfig = await CommonApi.getPrivateConfigure(deployCode, {
				enableRequestUnion: true,
				enableErrorMessagePrompt: false,
				...options,
			})
			await service
				.get<ConfigService>("configService")
				.setClusterConfig(deployCode, targetConfig.config, { waitForPersistence: false })

			const identityRequestOptions = {
				...options,
				enableAuthorizationVerification: false,
				enableErrorMessagePrompt: false,
			} as const

			const { authCode, platform } = await withTimeout(
				this.getAuthCode(deployCode, options),
				thirdPartyBackgroundProbeTimeoutMs,
				"third party account background probe timeout",
			)

			const url = new URL(window.location.href)
			const candidateLogin = await service.get<LoginService>("loginService").loginStep(
				platform,
				{
					platform_type: platform,
					authorization_code: authCode,
					redirect: url.toString(),
				},
				targetConfig.config.orgcode,
				options,
			)()
			const candidateAuthProfile = await AuthApi.getUserProfile(
				candidateLogin.access_token,
				deployCode,
				identityRequestOptions,
			)

			const currentMagicId = userStore.user.userInfo?.magic_id
			const candidateMagicId = this.resolveMagicId(candidateAuthProfile.auth_status)
			if (!currentMagicId || !candidateMagicId) return "failed"

			const currentUser: ThirdPartyAccountIdentity = {
				magicId: currentMagicId,
				name:
					userStore.user.userInfo?.real_name ||
					userStore.user.userInfo?.nickname ||
					currentMagicId,
				avatar: userStore.user.userInfo?.avatar,
			}
			const candidateUser: ThirdPartyAccountIdentity = {
				magicId: candidateMagicId,
				name: candidateLogin.user_info.real_name || candidateLogin.user_info.id,
				avatar: candidateLogin.user_info.avatar,
			}

			if (currentUser.magicId === candidateUser.magicId) return "same-user"

			const fingerprint = this.getAccountConflictFingerprint(
				deployCode,
				platform,
				currentUser,
				candidateUser,
			)
			if (this.getSuppressedAccountConflict() === fingerprint) return "kept-current"

			const [currentOrganizationName, candidateOrganizationName] = await Promise.all([
				this.resolveOrganizationName(currentAuthorization, deployCode, options),
				this.resolveOrganizationName(candidateLogin.access_token, deployCode, options),
			])

			// Organization lookups add an async boundary, so discard the dialog if the session changed meanwhile.
			if (userStore.user.authorization !== currentAuthorization) return "stale"

			const decision = await this.requestAccountConflictDecision({
				platform,
				currentUser: { ...currentUser, organizationName: currentOrganizationName },
				candidateUser: { ...candidateUser, organizationName: candidateOrganizationName },
			})

			// The session may have changed through another flow while probing, so a stale result must not overwrite it.
			if (userStore.user.authorization !== currentAuthorization) return "stale"

			if (decision === "keep-current") {
				this.suppressAccountConflict(fingerprint)
				return "kept-current"
			}

			await service
				.get<UserService>("userService")
				.setAuthorizationAndWait(candidateLogin.access_token)
			return "switched"
		} catch (error) {
			// Background verification is an enhancement only; failures must preserve the valid session and initial page content.
			logger.warn("第三方平台账号后台校验失败", { deployCode, error })
			return "failed"
		}
	}

	/**
	 * Initialize third party auth process
	 * @description Main entry point for third party authentication flow
	 */
	async init(options?: Pick<RequestConfig, "skipAppInitWait">): Promise<void> {
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
			// Treat the login result as a candidate for an existing session and enter redirect routing only after the final account is confirmed.
			await this.redirectUrlStep(options, authorization)
		} else if (tempAuthorizationCode) {
			await this.generateAuthorizationToken(tempAuthorizationCode, options)
		} else if (thirdPartyAuthDeployCode || !isNil(thirdPartyAuthDeployCode)) {
			// If and only if there is a private exclusive code can it trigger login exemption
			await this.handleAutoLogin(
				thirdPartyAuthDeployCode === defaultClusterCode ? "" : thirdPartyAuthDeployCode,
				options,
			)
		} else {
			throw new Error("no third party auth params")
		}
	}
}

export default ThirdPartyAuthService
