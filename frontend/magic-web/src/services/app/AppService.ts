import { service } from "../index"
import { v4 } from "uuid"
import { trackLogger } from "@/utils/log/trackLogger"
import { GlobalApi } from "@/apis"
import { botStore } from "@/stores/bot"
import { globalConfigStore } from "@/stores/globalConfig"
import { withTimeout } from "@/utils/promise"
import { logger as Logger } from "@/utils/log"
import { userStore } from "@/models/user"
import { RoutePath } from "@/constants/routes"
import { getHomeURL } from "@/utils/redirect"
import { history } from "@/routes/history"
import { matchPath } from "react-router"
import { LoginValueKey } from "@/pages/login/constants"
import { RouteName } from "@/routes/constants"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { AppInitErrorCode, AppInitializationError } from "./errors"
import type { User } from "@/types/user"
import type { SettingsAll } from "@/apis/types"
import type { ConfigService } from "@/services/config/ConfigService"
import type { UserService } from "@/services/user/UserService"
import type { AccountService } from "@/services/user/AccountService"
import type { LoginService } from "@/services/user/LoginService/LoginService"
import { appStore } from "@/stores/app"
import i18next from "i18next"
import {
	MagicPlatformServiceInterface,
	PlatformServiceInterface,
} from "./types/platformServiceInterface"
import { AppServiceContext } from "./types"
import { AbstractAppService } from "./AbstractAppService"
import { Platform } from "./const/platform"
import { Config } from "@/models/config"
import { whiteListRoutes } from "@/routes/const/whiteRoutes"
import { interfaceStore } from "@/stores/interface"
import { BroadcastChannelSender } from "@/broadcastChannel"
import { defaultClusterCode } from "@/routes/helpers"

interface PlatformServiceFactory {
	(context: AppServiceContext): Promise<PlatformServiceInterface>
}

const platformServiceFactories: Record<Platform, PlatformServiceFactory> = {
	[Platform.APIPlatform]: async (context) => {
		const { default: APIPlatformService } = await import("@/services/app/platformServices/api")
		return new APIPlatformService(context)
	},
	[Platform.AdminPlatform]: async (context) => {
		const { default: AdminPlatformService } =
			await import("@/services/app/platformServices/admin")
		return new AdminPlatformService(context)
	},
	[Platform.Magic]: async (context) => {
		const { default: MagicPlatformService } =
			await import("@/services/app/platformServices/magic")
		return new MagicPlatformService(context)
	},
}

const appInitSkipWaitRequestOptions = {
	skipAppInitWait: true,
} as const

const AuthenticationKey = "authorization"

/**
 * APP 初始化结果枚举
 */
export enum AppInitResult {
	/** 初始化成功 */
	SUCCESS = "SUCCESS",
	/** 没有授权码但当前是公开路由，允许轻量继续 */
	NO_TOKEN_PUBLIC_ROUTE = "NO_TOKEN_PUBLIC_ROUTE",
	/** 没有授权码但是白名单路由，允许继续 */
	NO_TOKEN_WHITELIST = "NO_TOKEN_WHITELIST",
	/** 没有授权码且已重定向到登录页 */
	NO_TOKEN_REDIRECTED = "NO_TOKEN_REDIRECTED",
	/** 初始化失败且已重定向到登录页 */
	INIT_FAILED_REDIRECTED = "INIT_FAILED_REDIRECTED",
	/** 初始化失败但是白名单路由 */
	INIT_FAILED_WHITELIST = "INIT_FAILED_WHITELIST",
	/** 系统需要初始化且已重定向到初始化页 */
	NEED_SYSTEM_INITIALIZATION = "NEED_SYSTEM_INITIALIZATION",
}

/**
 * APP 初始化结果结构体
 */
export interface AppInitResultData {
	/** 初始化结果枚举值 */
	result: AppInitResult
	/** 当前路径 */
	pathname: string
	/** 是否为白名单路由 */
	isWhiteListRoute: boolean
	/** 是否有授权码 */
	hasAccessToken: boolean
	/** 错误信息（如果有） */
	error?: AppInitializationError
	/** 时间戳 */
	timestamp: number
}

/**
 * APP 初始化服务
 * @description 用于初始化 APP 的各项服务
 * @constructor
 */
class AppService extends AbstractAppService<AppInitResultData> {
	private platformService: PlatformServiceInterface | null = null
	private pendingPostInitUser: User.UserInfo | null = null
	private isConfigInitializing = false
	private configInitPromise: Promise<void> | null = null
	private configRetryTimer: number | null = null
	private configInitStatus: "idle" | "pending" | "success" | "failed" = "idle"
	private configInitRetryCount = 0
	private readonly configInitMaxRetry = 5
	private settingsAllPromise: Promise<SettingsAll> | null = null
	private authenticatedConfigPromise: Promise<void> | null = null

	private clearConfigRetryTimer() {
		if (this.configRetryTimer) {
			window.clearTimeout(this.configRetryTimer)
			this.configRetryTimer = null
		}
	}

	private scheduleConfigRetry() {
		if (this.configInitStatus === "success") {
			return
		}

		const baseDelay = 2000
		const maxDelay = 60000
		const delay = Math.min(maxDelay, baseDelay * 2 ** this.configInitRetryCount)

		if (this.configInitRetryCount >= this.configInitMaxRetry) {
			this.logger.error("配置初始化已达最大重试次数，停止继续重试", {
				retryCount: this.configInitRetryCount,
				maxRetry: this.configInitMaxRetry,
			})
			return
		}

		this.configInitRetryCount += 1

		this.clearConfigRetryTimer()
		this.configRetryTimer = window.setTimeout(() => {
			const runRetry = () => {
				this.initializePublicConfiguration().catch((error) => {
					this.logger.warn("公开配置初始化退避重试失败", error)
				})
			}

			if ("requestIdleCallback" in window) {
				requestIdleCallback?.(() => {
					runRetry()
				})
				return
			}

			runRetry()
		}, delay)
	}

	/**
	 * 加载平台配置
	 * 包括默认语言，默认图标，平台设置等配置
	 * @returns Promise<SettingsAll>
	 * @throws AppInitializationError
	 */
	private loadSettingsAll = async () => {
		if (this.settingsAllPromise) return this.settingsAllPromise

		this.settingsAllPromise = GlobalApi.getSettingsAll(appInitSkipWaitRequestOptions).catch(
			(error) => {
				this.settingsAllPromise = null
				this.logger.error("加载平台配置失败", error)
				throw new AppInitializationError({
					code: AppInitErrorCode.PlatformSettingsRequestFailed,
					cause: error,
					message: "platform settings request failed",
				})
			},
		)

		return this.settingsAllPromise
	}

	logger = Logger.createLogger("appService")

	constructor() {
		super()
		this.initPlatformService()
	}

	private initPlatformService = async () => {
		if (this.platformService) return this.platformService

		const platformType = this.getPlatformType()

		const context: AppServiceContext = {
			logger: this.logger,
		}

		const loadPlatformService =
			platformServiceFactories[platformType] ?? platformServiceFactories[Platform.Magic]
		this.platformService = await loadPlatformService(context)
		return this.platformService
	}

	/**
	 * 创建并上报初始化结果
	 */
	private createAndReportInitResult(
		result: AppInitResult,
		pathname: string,
		isWhiteListRoute: boolean,
		hasAccessToken: boolean,
		error?: AppInitializationError,
	): AppInitResultData {
		const resultData: AppInitResultData = {
			result,
			pathname,
			isWhiteListRoute,
			hasAccessToken,
			error,
			timestamp: Date.now(),
		}

		if (error) {
			this.logger.error("appInitError", result.toLowerCase(), error)
		}

		this.logger.report({
			namespace: "appInit",
			data: {
				event: "appInitResult",
				result: resultData.result,
				pathname: resultData.pathname,
				isWhiteListRoute: resultData.isWhiteListRoute,
				hasAccessToken: resultData.hasAccessToken,
				...(error && {
					error: error.message,
					errorStack: error.stack,
				}),
			},
		})

		return resultData
	}

	private async initializePublicConfiguration() {
		if (this.isConfigInitializing) {
			this.logger.log("公开配置初始化进行中，跳过重复调用")
			return this.configInitPromise
		}

		this.isConfigInitializing = true
		this.configInitStatus = "pending"
		this.clearConfigRetryTimer()

		this.configInitPromise = (async () => {
			await service.get<ConfigService>("configService").hydrateLanguageEarly()

			this.logger.log("加载公开配置服务")
			try {
				service
					.get<ConfigService>("configService")
					.loadConfig(appInitSkipWaitRequestOptions)
			} catch (error) {
				this.logger.error("加载配置服务失败", error)
				throw new AppInitializationError({
					code: AppInitErrorCode.ConfigLoadFailed,
					cause: error,
					message: "config load failed",
				})
			}

			const response = await this.loadSettingsAll()

			this.logger.log("开始公开配置初始化")

			const languageReadyPromise = withTimeout(
				service
					.get<ConfigService>("configService")
					.init({
						initializeI18n: response.platform_settings
							?.default_language as Config.LanguageValue,
					})
					.catch((error) => {
						this.logger.error("全局配置初始化失败", error)
						throw new AppInitializationError({
							code: AppInitErrorCode.ConfigInitFailed,
							cause: error,
							message: "config init failed",
						})
					}),
				10000,
				"configService 初始化超时 (10秒)",
			).catch((error) => {
				if (error instanceof AppInitializationError) {
					throw error
				}
				throw new AppInitializationError({
					code: AppInitErrorCode.ConfigInitTimeout,
					cause: error,
					message: "config init timeout",
				})
			})

			appStore.setLanguageReadyPromise(languageReadyPromise)

			const globalConfigInitPromise = globalConfigStore
				.initGlobalConfig(response.platform_settings, i18next)
				.catch((error) => {
					this.logger.error("全局配置语言包初始化失败", error)
					throw new AppInitializationError({
						code: AppInitErrorCode.GlobalConfigInitFailed,
						cause: error,
						message: "global config init failed",
					})
				})

			await Promise.all([globalConfigInitPromise, languageReadyPromise])

			this.configInitStatus = "success"
			this.configInitRetryCount = 0
			this.logger.log("公开配置初始化完成")
		})().catch((error) => {
			const configError =
				error instanceof AppInitializationError
					? error
					: new AppInitializationError({
							code: AppInitErrorCode.Unknown,
							cause: error,
							message: "config init failed",
						})
			this.configInitStatus = "failed"
			this.logger.warn("公开配置初始化失败，但不中断登录流程", configError)
			this.scheduleConfigRetry()
			throw configError
		})
		this.configInitPromise.finally(() => {
			this.isConfigInitializing = false
		})

		appStore.setPublicConfigInitPromise(this.configInitPromise)

		return this.configInitPromise
	}

	private async initializeAuthenticatedConfiguration() {
		if (this.authenticatedConfigPromise) {
			this.logger.log("登录后配置初始化进行中，跳过重复调用")
			return this.authenticatedConfigPromise
		}

		this.authenticatedConfigPromise = (async () => {
			const response = await this.loadSettingsAll()
			botStore.setDefaultIcon({ icons: response.defaultIcons })
			this.logger.log("登录后配置初始化完成")
		})().catch((error) => {
			this.authenticatedConfigPromise = null
			this.logger.warn("登录后配置初始化失败，但不中断登录流程", error)
			throw error
		})

		return this.authenticatedConfigPromise
	}

	private getPlatformType = () => {
		const pathname = window.location.pathname
		if (pathname.startsWith("/api")) {
			return Platform.APIPlatform
		}
		if (pathname.startsWith("/admin")) {
			return Platform.AdminPlatform
		}
		return Platform.Magic
	}

	async init(): Promise<AppInitResultData> {
		if (appStore.appInitPromise) {
			this.logger.log("应用初始化进行中，复用已有 promise")
			return appStore.appInitPromise as Promise<AppInitResultData>
		}

		let resolveAppInit!: (value: AppInitResultData) => void
		let rejectAppInit!: (reason?: unknown) => void

		const initPromise = new Promise<AppInitResultData>((resolve, reject) => {
			resolveAppInit = resolve
			rejectAppInit = reject
		})

		appStore.setAppInitPromise(initPromise)
		this.schedulePostAppInitUserData(initPromise)

		const initTask = (async () => {
			appStore.setIsInitialing(true)
			let pathname = window.location.pathname
			let isWhiteListRoute = this.isWhiteListRoute(pathname)
			let hasAccessToken = false

			try {
				this.logger.log("开始应用初始化")
				const traceId = sessionStorage.getItem("traceId") ?? v4()
				sessionStorage.setItem("traceId", traceId)
				this.logger.log("设置会话追踪ID", { traceId })
				trackLogger.setConfig({
					sessionId: traceId,
				})

				this.logger.log("初始化用户服务")
				await service
					.get<UserService>("userService")
					.init()
					.catch((error) => {
						this.logger.error("用户服务初始化失败", error)
						throw new AppInitializationError({
							code: AppInitErrorCode.UserInitFailed,
							cause: error,
							message: "user service init failed",
						})
					})

				pathname = window.location.pathname
				isWhiteListRoute = this.isWhiteListRoute(pathname)
				this.logger.log("检查路由信息", { pathname, isWhiteListRoute })

				this.initializePublicConfiguration().catch((error) => {
					this.logger.warn("公开配置初始化失败，但不中断登录流程", error)
				})

				// 系统初始化检查必须先于登录/白名单分流，避免未初始化实例误入登录页
				const needsInitialization = await this.checkSystemInitialization()
				if (needsInitialization) {
					this.logger.log("系统需要初始化，已重定向到初始化页面")
					return this.createAndReportInitResult(
						AppInitResult.NEED_SYSTEM_INITIALIZATION,
						pathname,
						false,
						false,
					)
				}

				const queryAuthorization = this.getQueryAuthorization()
				const accessToken = queryAuthorization ?? userStore.user.authorization
				hasAccessToken = !!accessToken
				this.logger.log("检查授权码", { hasAccessToken, fromQuery: !!queryAuthorization })

				if (!accessToken) {
					if (this.isPublicRoute(pathname)) {
						this.logger.log("无授权码但为公开路由，走轻初始化路径")
						return this.createAndReportInitResult(
							AppInitResult.NO_TOKEN_PUBLIC_ROUTE,
							pathname,
							isWhiteListRoute,
							hasAccessToken,
						)
					}

					this.logger.log("无授权码，重定向到登录页")
					this.redirectToLogin()
					return this.createAndReportInitResult(
						AppInitResult.NO_TOKEN_REDIRECTED,
						pathname,
						isWhiteListRoute,
						hasAccessToken,
					)
				}

				// 集群初始化优先
				await service.get<ConfigService>("configService").initialCluster()

				this.initializeAuthenticatedConfiguration().catch((error) => {
					this.logger.warn("登录后配置初始化失败，但不中断登录流程", error)
				})

				this.logger.log("开始初始化账户")
				await this.initAccount().catch((error) => {
					this.logger.error("账户初始化失败", error)
					throw new AppInitializationError({
						code: AppInitErrorCode.AccountInitFailed,
						cause: error,
						message: "account init failed",
					})
				})
				this.logger.log("账户初始化完成")

				// // Wait for config initialization to complete before finishing app init
				// this.logger.log("等待公开配置初始化完成")
				// if (this.configInitPromise) {
				// 	await withTimeout(
				// 		this.configInitPromise,
				// 		15000,
				// 		"等待公开配置初始化超时 (15秒)",
				// 	).catch((error) => {
				// 		this.logger.warn("公开配置初始化等待失败，但不中断应用初始化", error)
				// 	})
				// }

				// if (this.configInitStatus === "success") {
				// 	this.logger.log("公开配置初始化已完成")
				// } else {
				// 	this.logger.warn("公开配置初始化未完成，当前状态:", this.configInitStatus)
				// }

				// if (this.authenticatedConfigPromise) {
				// 	await withTimeout(
				// 		this.authenticatedConfigPromise,
				// 		5000,
				// 		"等待登录后配置初始化超时 (5秒)",
				// 	).catch((error) => {
				// 		this.logger.warn("登录后配置初始化等待失败，但不中断应用初始化", error)
				// 	})
				// }

				this.logger.log("应用初始化成功完成")
				return this.createAndReportInitResult(
					AppInitResult.SUCCESS,
					pathname,
					isWhiteListRoute,
					hasAccessToken,
				)
			} catch (error) {
				const initError =
					error instanceof AppInitializationError
						? error
						: new AppInitializationError({
								code: AppInitErrorCode.Unknown,
								cause: error,
								message: "app init failed",
							})
				this.logger.error("应用初始化失败", initError)
				if (!isWhiteListRoute) {
					this.logger.log("非白名单路由，重定向到登录页")
					this.redirectToLogin()
				}

				return this.createAndReportInitResult(
					isWhiteListRoute
						? AppInitResult.INIT_FAILED_WHITELIST
						: AppInitResult.INIT_FAILED_REDIRECTED,
					pathname,
					isWhiteListRoute,
					hasAccessToken,
					initError,
				)
			} finally {
				appStore.setIsInitialing(false)
			}
		})()

		void initTask.then(resolveAppInit).catch(rejectAppInit)

		return initPromise
	}

	private getQueryAuthorization = () => {
		const url = new URL(window.location.href)
		const { searchParams } = url
		const authCode = searchParams.get(AuthenticationKey)
		if (authCode) {
			this.logger.log("从URL查询参数获取到授权码")
		}
		return authCode
	}

	private isLoginRoute = (pathname: string) =>
		pathname === RoutePath.Login || pathname === RoutePath.Invite

	private isPublicRoute = (pathname: string) =>
		this.isWhiteListRoute(pathname) || this.isLoginRoute(pathname)

	/**
	 * @description 判断是否为白名单路由
	 * @returns boolean
	 */
	private isWhiteListRoute = (pathname: string) => {
		const isWhiteList = whiteListRoutes.some((o) => matchPath(o, pathname))
		if (isWhiteList) {
			this.logger.log("当前路由为白名单路由", { pathname })
		}
		return isWhiteList
	}

	/**
	 * @description 重定向到登录页
	 */
	redirectToLogin = () => {
		if (![RoutePath.Login].includes(window.location.pathname as RoutePath)) {
			const redirectUrl = new URL(window.location.href).searchParams.get(
				LoginValueKey.REDIRECT_URL,
			)
			this.logger.log("重定向到登录页", {
				currentPath: window.location.pathname,
				redirectUrl: redirectUrl ?? window.location.href,
			})
			history.replace({
				name: RouteName.Login,
				query: convertSearchParams(
					new URLSearchParams({
						[LoginValueKey.REDIRECT_URL]: redirectUrl ?? window.location.href,
					}),
				),
			})
		} else {
			this.logger.log("当前已在登录页，无需重定向")
		}
	}

	/**
	 * @description 重定向到初始化页面
	 */
	private redirectToInitialization = () => {
		const pathname = window.location.pathname

		if (pathname !== RoutePath.Initialization) {
			// 保留原始的 redirect_url，以便初始化完成后跳转回原页面
			const redirectUrl = new URL(window.location.href).searchParams.get(
				LoginValueKey.REDIRECT_URL,
			)

			this.logger.log("重定向到初始化页面", {
				currentPath: pathname,
				redirectUrl: redirectUrl ?? window.location.href,
			})

			history.replace({
				name: RouteName.Initialization,
				query: convertSearchParams(
					new URLSearchParams({
						[LoginValueKey.REDIRECT_URL]: redirectUrl ?? window.location.href,
					}),
				),
			})
		} else {
			this.logger.log("当前已在初始化页面，无需重定向")
		}
	}

	/**
	 * @description 检查系统是否需要初始化
	 * @returns Promise<boolean> 如果需要初始化返回 true
	 */
	private checkSystemInitialization = async (): Promise<boolean> => {
		try {
			const pathname = window.location.pathname

			// 如果当前已经在初始化页面，直接返回 false，避免循环
			if (pathname === RoutePath.Initialization) {
				this.logger.log("当前已在初始化页面，跳过初始化检查")
				return false
			}

			// 复用公开配置请求结果，避免初始化阶段重复请求
			this.logger.log("检查系统是否需要初始化")
			const globalConfig = await this.loadSettingsAll()
				.then((response) => response.global_config)
				.catch((error) => {
					// 如果接口调用失败，假设不需要初始化，继续正常流程
					this.logger.warn("获取公开配置失败，假设系统已初始化", error)
					return {
						need_initial: false,
						is_maintenance: false,
						maintenance_description: "",
					}
				})

			if (globalConfig.need_initial) {
				this.logger.log("系统需要初始化，跳转到初始化页面")
				this.redirectToInitialization()
				return true
			}

			this.logger.log("系统不需要初始化，继续正常流程")
			return false
		} catch (error) {
			this.logger.error("检查系统初始化状态失败", error)
			return false
		}
	}

	private initAccount = async () => {
		this.logger.log("开始初始化账户")
		const accessToken = this.getQueryAuthorization() ?? userStore.user.authorization
		if (!accessToken) {
			// 没有授权码,大概率需要走重定向
			this.logger.log("无授权码，跳过账户初始化")
			this.redirectToLogin()
			return
		}

		// Memory and data persistence synchronization authorization
		this.logger.log("设置用户授权信息")
		service.get<UserService>("userService").setAuthorization(accessToken)

		this.logger.log("同步集群配置")
		const { clusterCode } = await service
			.get<LoginService>("loginService")
			.syncClusterConfig(appInitSkipWaitRequestOptions)
		this.logger.log("集群配置同步完成", { clusterCode })

		this.logger.log("获取第三方平台组织信息")
		const {
			magicOrganizationMap,
			organizationCode,
			thirdPlatformOrganizations,
			thirdPlatformOrganizationCode,
		} = await service
			.get<LoginService>("loginService")
			.getThirdPlatformOrganizations(accessToken, clusterCode, appInitSkipWaitRequestOptions)
		this.logger.log("第三方平台组织信息获取完成", {
			organizationCode,
			thirdPlatformOrganizationCode,
			organizationsCount: thirdPlatformOrganizations?.length || 0,
		})

		this.logger.log("设置用户组织信息")
		service.get<UserService>("userService").setOrganization({
			organizationCode,
			teamshareOrganizationCode: thirdPlatformOrganizationCode,
			organizations: thirdPlatformOrganizations,
			magicOrganizationMap,
		})

		// Account system synchronization
		this.logger.log("同步账户系统")
		await service.get<LoginService>("loginService").accountSync(
			{
				deployCode: clusterCode,
				access_token: accessToken,
				magicOrganizationMap,
				organizations: thirdPlatformOrganizations,
				teamshareOrganizationCode: thirdPlatformOrganizationCode,
			},
			appInitSkipWaitRequestOptions,
		)
		this.logger.log("账户系统同步完成")

		// Temporary processing
		const isSearchRoutePath = window.location.pathname.indexOf("search.html") > -1
		if (!isSearchRoutePath && ["/", RoutePath.Login].includes(window.location.pathname)) {
			this.logger.log("当前在首页或登录页，获取首页URL并重定向")
			const historyParams = await getHomeURL()
			history.replace(historyParams)
			this.logger.log("已重定向到首页", historyParams)
		}
		// Synchronize account information (refresh the status of each account)
		this.logger.log("获取账户信息")

		const user = userStore.user.userInfo
		if (user) {
			this.logger.log("账户初始化完成，准备在 app init 完成后触发后置初始化流程")
			this.pendingPostInitUser = user
		}
	}

	/**
	 * @description 初始化用户切换后的流程
	 * @param user 用户信息
	 * @param showSwitchLoading 是否显示切换加载状态
	 * @returns Promise<void>
	 */
	initUserData = async (user: User.UserInfo) => {
		if (!this.platformService) return
		return this.platformService.initUserData(user)
	}

	private triggerPostAppInitUserData(user: User.UserInfo) {
		Promise.resolve(this.initUserData(user)).catch((error) => {
			this.logger.error("应用启动后的用户数据初始化失败", error)
		})
	}

	private schedulePostAppInitUserData(initPromise: Promise<AppInitResultData>) {
		void initPromise
			.then((result) => {
				if (result.result !== AppInitResult.SUCCESS) {
					this.pendingPostInitUser = null
					return
				}

				const user = this.pendingPostInitUser
				this.pendingPostInitUser = null
				if (!user) return

				this.logger.log("app init 已完成，开始执行用户数据后置初始化")
				this.triggerPostAppInitUserData(user)
			})
			.catch((error) => {
				this.pendingPostInitUser = null
				this.logger.warn("调度用户数据后置初始化失败", error)
			})
	}

	/**
	 * @description 切换组织
	 * @param accountInfo 账号信息
	 * @param organizationInfo 组织信息
	 * @param userInfo 当前用户信息
	 * @param onSwitchAfter 切换后回调
	 */
	switchOrganization = async (
		accountInfo: User.UserAccount,
		organizationInfo: User.MagicOrganization,
		userInfo: User.UserInfo | null,
		onSwitchAfter?: () => void,
	) => {
		this.logger.log("开始切换组织", {
			targetAccountId: accountInfo?.magic_id,
			targetOrgCode: organizationInfo?.magic_organization_code,
			currentAccountId: userInfo?.magic_id,
			currentOrgCode: userInfo?.organization_code,
		})
		try {
			interfaceStore.setIsSwitchingOrganization(true)
			// 账号不一致下要切换账号(切换账号下优先判断集群是否一致，不一致情况下优先切换路由上集群再调用切换账号逻辑，这里必须先切换帐号后重定向路由!!!)
			if (accountInfo?.magic_id !== userInfo?.magic_id) {
				this.logger.log("检测到账号不一致，开始切换账号")
				// Set cluster code before switching account
				if (accountInfo.deployCode) {
					this.logger.log("设置集群代码", { deployCode: accountInfo.deployCode })
					await service
						.get<ConfigService>("configService")
						.setClusterCode(accountInfo.deployCode)
				}
				this.logger.log("执行账号切换")
				await service
					.get<AccountService>("accountService")
					.switchAccount(accountInfo.magic_id, organizationInfo.magic_organization_code)
				this.logger.log("账号切换完成，广播账号切换事件")
				// Broadcast account switch
				BroadcastChannelSender.switchAccount({
					magicId: accountInfo.magic_id,
					magicUserId: organizationInfo.magic_user_id,
					magicOrganizationCode: organizationInfo.magic_organization_code,
				})
				const routeMeta = routesMatch(window.location.pathname)
				if (routeMeta && routeMeta.route.name) {
					this.logger.log("更新路由参数", {
						routeName: routeMeta.route.name,
						clusterCode: accountInfo.deployCode || defaultClusterCode,
					})
					history.replace({
						name: routeMeta.route.name,
						params: {
							...routeMeta?.params,
							clusterCode: accountInfo.deployCode || defaultClusterCode,
						},
					})
				}

				const user = userStore.user.userInfo
				if (user) {
					this.logger.log("账号切换完成，开始初始化用户切换后的流程")
					await this.platformService?.initUserData(user)
				}
			} else if (organizationInfo?.magic_organization_code !== userInfo?.organization_code) {
				this.logger.log("检测到组织不一致，开始切换组织")
				try {
					await service
						.get<UserService>("userService")
						.switchOrganization(
							organizationInfo.magic_user_id,
							organizationInfo.magic_organization_code,
							userInfo,
						)
					this.logger.log("组织切换完成")

					const user = userStore.user.userInfo
					if (user) {
						this.logger.log("组织切换完成，开始初始化用户切换后的流程")
						await this.platformService?.initUserData(user)
					}
				} catch (err) {
					this.logger.error("组织切换失败，恢复当前组织", err)
					// 切换失败，恢复当前组织
					service
						.get<UserService>("userService")
						.setMagicOrganizationCode(userInfo?.organization_code)
					service.get<UserService>("userService").setUserInfo(userInfo)
				}
			} else {
				this.logger.log("账号和组织均一致，无需切换")
			}
			onSwitchAfter?.()
			this.logger.log("组织切换流程完成")
		} catch (err) {
			this.logger.error("切换组织过程中发生错误", err)
		} finally {
			interfaceStore.setIsSwitchingOrganization(false)
		}
	}

	private isMagicPlatform = () => {
		return this.platformService?.PlatformType === Platform.Magic
	}

	initChatDataIfNeeded = async (magicUser?: User.UserInfo) => {
		if (!this.platformService || !this.isMagicPlatform()) return

		return (this.platformService as MagicPlatformServiceInterface).initChatDataIfNeeded(
			magicUser,
		)
	}
}

export const appService = new AppService()
