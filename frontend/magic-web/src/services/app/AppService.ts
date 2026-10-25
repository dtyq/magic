import { service } from "../index"
import { initializeBrowserApm } from "@/services/app/browser-apm"
import { GlobalApi } from "@/apis"
import { botStore } from "@/stores/bot"
import { globalConfigStore } from "@/stores/globalConfig"
import { withTimeout } from "@/utils/promise"
import { logger as Logger } from "@/infrastructure/logger"
import { userStore } from "@/models/user"
import { RoutePath } from "@/constants/routes"
import { getHomeURL } from "@/utils/redirect"
import { history } from "@/routes/history"
import { matchPath } from "react-router"
import { LoginValueKey } from "@/pages/login/constants"
import { RouteName } from "@/routes/constants"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { AppInitErrorCode, AppInitializationError, isAuthenticationFailure } from "./errors"
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
import { DEFAULT_MAINTENANCE_CONFIG, shouldForceSiteClose } from "@/constants/maintenance"
import { refreshAccountContextPage } from "@/broadcastChannel/eventFactory/accountContextRefresh"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"

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
 * Application initialization result enum.
 */
export enum AppInitResult {
	/** Initialization succeeded */
	SUCCESS = "SUCCESS",
	/** No access token, but the current route is public, so lightweight initialization may continue */
	NO_TOKEN_PUBLIC_ROUTE = "NO_TOKEN_PUBLIC_ROUTE",
	/** No access token, but the route is allowlisted, so initialization may continue */
	NO_TOKEN_WHITELIST = "NO_TOKEN_WHITELIST",
	/** No access token; redirected to the login page */
	NO_TOKEN_REDIRECTED = "NO_TOKEN_REDIRECTED",
	/** Initialization failed; redirected to the login page */
	INIT_FAILED_REDIRECTED = "INIT_FAILED_REDIRECTED",
	/** Initialization failed for a non-authentication reason; kept the current route */
	INIT_FAILED_NO_REDIRECT = "INIT_FAILED_NO_REDIRECT",
	/** Initialization failed on an allowlisted route */
	INIT_FAILED_WHITELIST = "INIT_FAILED_WHITELIST",
	/** System initialization is required; redirected to the initialization page */
	NEED_SYSTEM_INITIALIZATION = "NEED_SYSTEM_INITIALIZATION",
	/** The system is under maintenance; redirected to the maintenance page */
	SITE_MAINTENANCE = "SITE_MAINTENANCE",
}

/**
 * Application initialization result data.
 */
export interface AppInitResultData {
	/** Initialization result enum value */
	result: AppInitResult
	/** Current path */
	pathname: string
	/** Whether the route is allowlisted */
	isWhiteListRoute: boolean
	/** Whether an access token is present */
	hasAccessToken: boolean
	/** Error details, if any */
	error?: AppInitializationError
	/** Timestamp */
	timestamp: number
}

/**
 * Application initialization service.
 * @description Initializes the application's services.
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

	/** Cancels the pending configuration retry and clears its stored timer handle. */
	private clearConfigRetryTimer() {
		if (this.configRetryTimer) {
			window.clearTimeout(this.configRetryTimer)
			this.configRetryTimer = null
		}
	}

	/**
	 * Schedules configuration recovery with capped exponential backoff and idle scheduling.
	 * Successful initialization stops retries; exhausting the limit reports the latest failure.
	 * @param error Original failure that triggered this retry decision.
	 */
	private scheduleConfigRetry(error: unknown) {
		if (this.configInitStatus === "success") {
			return
		}

		const baseDelay = 2000
		const maxDelay = 60000
		const delay = Math.min(maxDelay, baseDelay * 2 ** this.configInitRetryCount)

		if (this.configInitRetryCount >= this.configInitMaxRetry) {
			this.logger.error({
				eventKey: "config_initialization_retry_exhausted",
				errorKind: "unknown",
				error,
				message:
					"Configuration initialization reached the retry limit; no further retries will run",
				context: {
					retryCount: this.configInitRetryCount,
					maxRetry: this.configInitMaxRetry,
				},
			})
			return
		}

		this.configInitRetryCount += 1

		this.clearConfigRetryTimer()
		this.configRetryTimer = window.setTimeout(() => {
			const runRetry = () => {
				this.initializePublicConfiguration().catch((error) => {
					this.logger.warn(
						"Public configuration initialization failed during a backoff retry",
						error,
					)
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
	 * Shares platform settings across startup consumers and retains successful results.
	 * Request rejection clears the shared promise, reports the failure, and classifies it.
	 * @returns Platform language defaults, icons, configuration, and related settings.
	 * @throws AppInitializationError When the platform settings request rejects.
	 */
	private loadSettingsAll = async () => {
		if (this.settingsAllPromise) return this.settingsAllPromise

		this.settingsAllPromise = GlobalApi.getSettingsAll(appInitSkipWaitRequestOptions).catch(
			(error) => {
				this.settingsAllPromise = null
				this.logger.error({
					eventKey: "load_config_failed",
					errorKind: "unknown",
					error: error,
					message: "Failed to load platform settings",
				})
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

	/** Starts loading the platform service without waiting for application bootstrap. */
	constructor() {
		super()
		this.initPlatformService()
	}

	/**
	 * Loads the service selected by the current route, reusing an existing instance.
	 * @returns The service that owns platform-specific user and chat initialization.
	 */
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
	 * Creates the application initialization result and reports its outcome and optional failure.
	 * @param result Outcome of the current initialization path.
	 * @param pathname Route evaluated during initialization.
	 * @param isWhiteListRoute Whether the route matches the initialization allowlist.
	 * @param hasAccessToken Whether initialization found an access token.
	 * @param error Classified initialization failure, when present.
	 * @returns The reported outcome with its timestamp and routing context.
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
			this.logger.error({
				eventKey: "app_init_failed",
				errorKind: "unknown",
				error: error,
				message: "appInitError",
				context: { result: result.toLowerCase() },
			})
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

	/**
	 * Shares an active public configuration attempt and manages its status and retry lifecycle.
	 * Resolves after language setup and selectable lists finish; failures retain their identity.
	 * @returns The current attempt, with failed attempts scheduled for background recovery.
	 */
	private async initializePublicConfiguration() {
		if (this.isConfigInitializing) {
			this.logger.log(
				"Public configuration initialization is in progress; reusing the current attempt",
			)
			return this.configInitPromise
		}

		this.isConfigInitializing = true
		this.configInitStatus = "pending"
		this.clearConfigRetryTimer()

		// Track this attempt only: each parallel step reports its own failure, while
		// the lifecycle catch reports unexpected failures without duplicating them.
		const reportedFailures = new Set<unknown>()
		const retryCount = this.configInitRetryCount
		this.configInitPromise = this.runPublicConfigurationInitialization(reportedFailures)
			.then(() => {
				this.configInitStatus = "success"
				this.configInitRetryCount = 0
				this.logger.log("Public configuration initialization completed")
			})
			.catch((error) => {
				this.configInitStatus = "failed"
				if (!reportedFailures.has(error)) {
					this.logger.error({
						eventKey: "public_configuration_initialization_failed",
						errorKind: "unknown",
						error,
						message: "Public configuration initialization failed",
						context: { stage: "public_configuration", retryCount },
					})
				}
				this.logger.warn(
					"Public configuration initialization failed; login will continue",
					error,
				)
				this.scheduleConfigRetry(error)
				throw error
			})
			.finally(() => {
				this.isConfigInitializing = false
			})

		appStore.setPublicConfigInitPromise(this.configInitPromise)

		return this.configInitPromise
	}

	/**
	 * Restores the saved language alongside platform settings, then applies language defaults.
	 * Selectable lists wait for application bootstrap to settle; language readiness does not.
	 * @param reportedFailures Failures already reported by this attempt, preventing duplicate fallback reports.
	 * @returns Completion of language setup, global configuration, and selectable list loading.
	 */
	private async runPublicConfigurationInitialization(reportedFailures: Set<unknown>) {
		const retryCount = this.configInitRetryCount
		/** Reports a step failure and records the original error for lifecycle deduplication. */
		const reportFailure = (
			stage: string,
			eventKey: string,
			error: unknown,
			errorKind = "unknown",
		) => {
			reportedFailures.add(error)
			this.logger.error({
				eventKey,
				errorKind,
				error,
				message: "A public configuration initialization step failed",
				context: { stage, retryCount },
			})
		}
		/**
		 * Observes each step independently so late parallel failures are reported and rethrown unchanged.
		 */
		const runStep = async <T>(
			stage: string,
			eventKey: string,
			task: () => Promise<T>,
		): Promise<T> => {
			try {
				return await task()
			} catch (error) {
				// Observe every branch, including failures after Promise.all has rejected.
				reportFailure(stage, eventKey, error)
				throw error
			}
		}

		const configService = service.get<ConfigService>("configService")
		this.logger.log("Starting public configuration initialization")
		// Platform settings are language-independent; wait for both before applying defaults.
		const [, response] = await Promise.all([
			runStep("hydrate_language", "hydrate_language_failed", () =>
				configService.hydrateLanguageEarly(),
			),
			this.loadSettingsAll().catch((error) => {
				// Only the classified rejection is guaranteed to have a load_config_failed report;
				// unexpected synchronous API failures still need the lifecycle fallback.
				if (
					error instanceof AppInitializationError &&
					error.code === AppInitErrorCode.PlatformSettingsRequestFailed
				) {
					reportedFailures.add(error)
				}
				throw error
			}),
		])
		const languageReadyPromise = withTimeout(
			runStep("initialize_config", "config_initialize_failed", () =>
				configService.init({
					initializeI18n: response.platform_settings
						?.default_language as Config.LanguageValue,
				}),
			),
			10000,
			"ConfigService initialization timed out (10 seconds)",
		).catch((error) => {
			// The original init remains observed if it rejects after the timeout.
			if (!reportedFailures.has(error)) {
				reportFailure("initialize_config", "config_initialize_failed", error, "timeout")
			}
			throw error
		})
		appStore.setLanguageReadyPromise(languageReadyPromise)

		await Promise.all([
			languageReadyPromise,
			runStep("initialize_global_config", "config_initialize_failed", () =>
				globalConfigStore.initGlobalConfig(
					response.platform_settings,
					i18next,
					response.global_config,
				),
			),
		])

		// App bootstrap does not wait for public configuration. Read the selectable
		// lists after its identity restoration finishes, keeping languageReady independent.
		await Promise.allSettled([appStore.appInitPromise])
		await runStep("load_language_options", "load_config_service_failed", () =>
			configService.loadConfig(appInitSkipWaitRequestOptions),
		)
	}

	/**
	 * Shares post-login configuration loading and applies the platform's default bot icons.
	 * Failures clear the shared attempt, emit a warning, and propagate to the caller.
	 * @returns Completion of the icon configuration update.
	 */
	private async initializeAuthenticatedConfiguration() {
		if (this.authenticatedConfigPromise) {
			this.logger.log(
				"Post-login configuration initialization is in progress; reusing the current attempt",
			)
			return this.authenticatedConfigPromise
		}

		this.authenticatedConfigPromise = (async () => {
			const response = await this.loadSettingsAll()
			botStore.setDefaultIcon({ icons: response.defaultIcons })
			this.logger.log("Post-login configuration initialization completed")
		})().catch((error) => {
			this.authenticatedConfigPromise = null
			this.logger.warn(
				"Post-login configuration initialization failed; login will continue",
				error,
			)
			throw error
		})

		return this.authenticatedConfigPromise
	}

	/**
	 * Determines the application platform from the current route.
	 * @returns The API, admin, or main platform selected by the pathname.
	 */
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

	/**
	 * Bootstraps user identity, routing, and account context through one shared application promise.
	 * Public configuration remains in the background; startup failures become classified results.
	 * Failed startup redirects protected routes only for authentication failures.
	 * @returns The startup outcome used to release deferred user-data initialization.
	 */
	async init(): Promise<AppInitResultData> {
		if (appStore.appInitPromise) {
			this.logger.log(
				"Application initialization is in progress; reusing the existing promise",
			)
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
				this.logger.log("Starting application initialization")
				const traceId = initializeBrowserApm()
				this.logger.log("Setting the session trace ID", { traceId })

				this.logger.log("Initializing the user service")
				await service
					.get<UserService>("userService")
					.init()
					.catch((error) => {
						this.logger.error({
							eventKey: "user_service_initialize_failed",
							errorKind: "unknown",
							error: error,
							message: "User service initialization failed",
						})
						throw new AppInitializationError({
							code: AppInitErrorCode.UserInitFailed,
							cause: error,
							message: "user service init failed",
						})
					})

				pathname = window.location.pathname
				isWhiteListRoute = this.isWhiteListRoute(pathname)
				this.logger.log("Checking route information", { pathname, isWhiteListRoute })

				// Selectable lists wait for this init to settle. Keep public configuration in
				// the background here so bootstrap cannot wait on its own completion.
				void this.initializePublicConfiguration().catch((error) => {
					this.logger.warn(
						"Public configuration initialization failed; login will continue",
						error,
					)
				})

				// Check system initialization before login and allowlist routing to keep uninitialized instances off the login page.
				const needsInitialization = await this.checkSystemInitialization()
				if (needsInitialization) {
					this.logger.log(
						"System initialization is required; redirected to the initialization page",
					)
					return this.createAndReportInitResult(
						AppInitResult.NEED_SYSTEM_INITIALIZATION,
						pathname,
						false,
						false,
					)
				}

				const isSiteMaintenance = await this.checkSiteMaintenance()
				if (isSiteMaintenance) {
					this.logger.log(
						"The site is closed for maintenance; redirected to the maintenance page",
					)
					return this.createAndReportInitResult(
						AppInitResult.SITE_MAINTENANCE,
						pathname,
						true,
						false,
					)
				}

				const queryAuthorization = this.getQueryAuthorization()
				const accessToken = queryAuthorization ?? userStore.user.authorization
				hasAccessToken = !!accessToken
				this.logger.log("Checking the access token", {
					hasAccessToken,
					fromQuery: !!queryAuthorization,
				})

				if (!accessToken) {
					if (this.isPublicRoute(pathname)) {
						this.logger.log(
							"No access token on a public route; continuing with lightweight initialization",
						)
						return this.createAndReportInitResult(
							AppInitResult.NO_TOKEN_PUBLIC_ROUTE,
							pathname,
							isWhiteListRoute,
							hasAccessToken,
						)
					}

					this.logger.log("No access token; redirecting to the login page")
					this.redirectToLogin()
					return this.createAndReportInitResult(
						AppInitResult.NO_TOKEN_REDIRECTED,
						pathname,
						isWhiteListRoute,
						hasAccessToken,
					)
				}

				// Initialize the cluster first.
				await service.get<ConfigService>("configService").initialCluster()

				this.initializeAuthenticatedConfiguration().catch((error) => {
					this.logger.warn(
						"Post-login configuration initialization failed; login will continue",
						error,
					)
				})

				this.logger.log("Starting account initialization")
				await this.initAccount().catch((error) => {
					this.logger.error({
						eventKey: "account_initialize_failed",
						errorKind: "unknown",
						error: error,
						message: "Account initialization failed",
					})
					throw new AppInitializationError({
						code: AppInitErrorCode.AccountInitFailed,
						cause: error,
						message: "account init failed",
					})
				})
				this.logger.log("Account initialization completed")

				// if (this.authenticatedConfigPromise) {
				// 	await withTimeout(
				// 		this.authenticatedConfigPromise,
				// 		5000,
				// 		"Timed out waiting for post-login configuration initialization (5 seconds)",
				// 	).catch((error) => {
				// 		this.logger.warn("Waiting for post-login configuration initialization failed without interrupting application initialization", error)
				// 	})
				// }

				this.logger.log("Application initialization completed successfully")
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
				this.logger.error({
					eventKey: "initialize_failed",
					errorKind: "unknown",
					error: initError,
					message: "Application initialization failed",
				})
				const shouldRedirectToLogin =
					!isWhiteListRoute && isAuthenticationFailure(initError)
				if (shouldRedirectToLogin) {
					this.logger.log("The route is not allowlisted; redirecting to the login page")
					this.redirectToLogin()
				}

				return this.createAndReportInitResult(
					isWhiteListRoute
						? AppInitResult.INIT_FAILED_WHITELIST
						: shouldRedirectToLogin
							? AppInitResult.INIT_FAILED_REDIRECTED
							: AppInitResult.INIT_FAILED_NO_REDIRECT,
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

	/**
	 * Reads an access token from the current URL without logging the token value.
	 * @returns The authorization query parameter, or null when it is absent.
	 */
	private getQueryAuthorization = () => {
		const url = new URL(window.location.href)
		const { searchParams } = url
		const authCode = searchParams.get(AuthenticationKey)
		if (authCode) {
			this.logger.log("Found an access token in the URL query parameters")
		}
		return authCode
	}

	/**
	 * Checks the anonymous login and invitation entry points.
	 * @param pathname Route pathname to evaluate.
	 * @returns Whether the route is the login or invitation page.
	 */
	private isLoginRoute = (pathname: string) =>
		pathname === RoutePath.Login || pathname === RoutePath.Invite

	/**
	 * Checks whether the route permits startup without an access token.
	 * @param pathname Route pathname to evaluate.
	 * @returns Whether an allowlisted, login, or invitation route matches.
	 */
	private isPublicRoute = (pathname: string) =>
		this.isWhiteListRoute(pathname) || this.isLoginRoute(pathname)

	/**
	 * Matches a route against the allowlist used by application initialization.
	 * @param pathname Route pathname to evaluate.
	 * @returns Whether any allowlisted route pattern matches.
	 */
	private isWhiteListRoute = (pathname: string) => {
		const isWhiteList = whiteListRoutes.some((o) => matchPath(o, pathname))
		if (isWhiteList) {
			this.logger.log("The current route is allowlisted", { pathname })
		}
		return isWhiteList
	}

	/**
	 * Requests login through the authentication event owner, preserving the current return URL.
	 * Does nothing when the application is already on the login page.
	 */
	redirectToLogin = () => {
		if (window.location.pathname === RoutePath.Login) return
		this.logger.log("Requesting login", { currentPath: window.location.pathname })
		authEventBus.emit(AuthEventName.RequestLogin, {
			reason: "missing-session",
			source: "app-init",
			returnTo: window.location.href,
			preserveQuery: true,
		})
	}

	/**
	 * Redirects to system initialization while preserving the existing or current return URL.
	 * Does nothing when the application is already on the initialization page.
	 */
	private redirectToInitialization = () => {
		const pathname = window.location.pathname

		if (pathname !== RoutePath.Initialization) {
			// Preserve the original redirect_url so initialization can return to the original page.
			const redirectUrl = new URL(window.location.href).searchParams.get(
				LoginValueKey.REDIRECT_URL,
			)

			this.logger.log("Redirecting to the initialization page", {
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
			this.logger.log("Already on the initialization page; no redirect is needed")
		}
	}

	/** Redirects to the maintenance page unless the application is already there. */
	private redirectToMaintenance = () => {
		const pathname = window.location.pathname

		if (pathname !== RoutePath.Maintenance) {
			this.logger.log("Redirecting to the maintenance page", { currentPath: pathname })
			history.replace({ name: RouteName.Maintenance })
		} else {
			this.logger.log("Already on the maintenance page; no redirect is needed")
		}
	}

	/**
	 * Applies maintenance settings and redirects the main platform when site closure is required.
	 * Other platforms skip the check; request failures are reported and allow startup to continue.
	 * @returns Whether a maintenance redirect was required.
	 */
	private checkSiteMaintenance = async (): Promise<boolean> => {
		if (this.getPlatformType() !== Platform.Magic) {
			return false
		}

		try {
			const response = await this.loadSettingsAll()
			globalConfigStore.setMaintenanceConfig(response.global_config)

			if (shouldForceSiteClose(response.global_config)) {
				this.redirectToMaintenance()
				return true
			}

			return false
		} catch (error) {
			this.logger.error({
				eventKey: "check_status_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to check system maintenance status",
			})
			return false
		}
	}

	/**
	 * Checks public settings and redirects instances that still require system initialization.
	 * The initialization page skips this check, and failed reads assume initialization is complete.
	 * @returns Whether startup must stop for system initialization.
	 */
	private checkSystemInitialization = async (): Promise<boolean> => {
		try {
			const pathname = window.location.pathname

			// Return false on the initialization page to avoid a redirect loop.
			if (pathname === RoutePath.Initialization) {
				this.logger.log(
					"Already on the initialization page; skipping the initialization check",
				)
				return false
			}

			// Reuse the public configuration request to avoid duplicate initialization requests.
			this.logger.log("Checking whether system initialization is required")
			const globalConfig = await this.loadSettingsAll()
				.then((response) => response.global_config)
				.catch((error) => {
					// If the request fails, assume initialization is not required and continue normally.
					this.logger.warn(
						"Failed to load public configuration; assuming the system is initialized",
						error,
					)
					return {
						...DEFAULT_MAINTENANCE_CONFIG,
						need_initial: false,
					}
				})
			globalConfigStore.setMaintenanceConfig(globalConfig)

			if (globalConfig.need_initial) {
				this.logger.log(
					"System initialization is required; redirecting to the initialization page",
				)
				this.redirectToInitialization()
				return true
			}

			this.logger.log("System initialization is not required; continuing startup")
			return false
		} catch (error) {
			this.logger.error({
				eventKey: "check_initialize_status_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to check system initialization status",
			})
			return false
		}
	}

	/**
	 * Restores authorization, cluster, and organization state before synchronizing the account.
	 * Missing tokens request login; service failures propagate to application bootstrap.
	 * A restored user is queued for data initialization after successful application startup.
	 * @returns Completion of account restoration and any entry-route redirect.
	 */
	private initAccount = async () => {
		this.logger.log("Starting account initialization")
		const accessToken = this.getQueryAuthorization() ?? userStore.user.authorization
		if (!accessToken) {
			// Without an access token, a redirect is most likely required.
			this.logger.log("No access token; skipping account initialization")
			this.redirectToLogin()
			return
		}

		// Memory and data persistence synchronization authorization
		this.logger.log("Setting user authorization")
		service.get<UserService>("userService").setAuthorization(accessToken)

		this.logger.log("Synchronizing cluster configuration")
		const { clusterCode } = await service
			.get<LoginService>("loginService")
			.syncClusterConfig(appInitSkipWaitRequestOptions)
		this.logger.log("Cluster configuration synchronized", { clusterCode })

		this.logger.log("Loading third-party platform organization information")
		const {
			magicOrganizationMap,
			organizationCode,
			thirdPlatformOrganizations,
			thirdPlatformOrganizationCode,
		} = await service
			.get<LoginService>("loginService")
			.getThirdPlatformOrganizations(accessToken, clusterCode, appInitSkipWaitRequestOptions)
		this.logger.log("Third-party platform organization information loaded", {
			organizationCode,
			thirdPlatformOrganizationCode,
			organizationsCount: thirdPlatformOrganizations?.length || 0,
		})

		this.logger.log("Setting user organization information")
		service.get<UserService>("userService").setOrganization({
			organizationCode,
			teamshareOrganizationCode: thirdPlatformOrganizationCode,
			organizations: thirdPlatformOrganizations,
			magicOrganizationMap,
		})

		// Account system synchronization
		this.logger.log("Synchronizing the account system")
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
		this.logger.log("Account system synchronized")

		// Temporary processing
		const isSearchRoutePath = window.location.pathname.indexOf("search.html") > -1
		if (!isSearchRoutePath && ["/", RoutePath.Login].includes(window.location.pathname)) {
			this.logger.log("On the home or login page; resolving the home URL and redirecting")
			const historyParams = await getHomeURL()
			history.replace(historyParams)
			this.logger.log("Redirected to the home page", historyParams)
		}
		// Synchronize account information (refresh the status of each account)
		this.logger.log("Reading account information")

		const user = userStore.user.userInfo
		if (user) {
			this.logger.log(
				"Account initialization completed; queuing user data initialization after application startup",
			)
			this.pendingPostInitUser = user
		}
	}

	/**
	 * Delegates user-data initialization after startup or an account or organization change.
	 * Does nothing until the platform service is available; delegated failures propagate.
	 * @param user User whose platform-specific data must be initialized.
	 * @returns Completion of the platform's user-data initialization.
	 */
	initUserData = async (user: User.UserInfo) => {
		if (!this.platformService) return
		return this.platformService.initUserData(user)
	}

	/**
	 * Starts deferred user-data initialization without delaying completed application startup.
	 * Reports failures instead of propagating them back into the startup result.
	 * @param user Restored user awaiting platform-specific initialization.
	 */
	private triggerPostAppInitUserData(user: User.UserInfo) {
		Promise.resolve(this.initUserData(user)).catch((error) => {
			this.logger.error({
				eventKey: "start_user_initialize_failed",
				errorKind: "unknown",
				error: error,
				message: "Post-startup user data initialization failed",
			})
		})
	}

	/**
	 * Releases queued user data only after successful bootstrap and clears it on other outcomes.
	 * Scheduling failures are logged without changing the application initialization result.
	 * @param initPromise Application startup result that gates the deferred work.
	 */
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

				this.logger.log(
					"Application initialization completed; starting deferred user data initialization",
				)
				this.triggerPostAppInitUserData(user)
			})
			.catch((error) => {
				this.pendingPostInitUser = null
				this.logger.warn("Failed to schedule deferred user data initialization", error)
			})
	}

	/**
	 * Switches account or organization context, restores user data, and refreshes account-scoped stores.
	 * Organization failures restore the prior organization; other failures are logged and loading is cleared.
	 * @param accountInfo Account that owns the target organization.
	 * @param organizationInfo Organization to activate.
	 * @param userInfo Current user used to compare and restore context.
	 * @param onSwitchAfter Callback invoked after switch handling, before the account-context refresh.
	 * @returns Completion of switch handling and loading-state cleanup.
	 */
	switchOrganization = async (
		accountInfo: User.UserAccount,
		organizationInfo: User.MagicOrganization,
		userInfo: User.UserInfo | null,
		onSwitchAfter?: () => void,
	) => {
		this.logger.log("Starting organization switch", {
			targetAccountId: accountInfo?.magic_id,
			targetOrgCode: organizationInfo?.magic_organization_code,
			currentAccountId: userInfo?.magic_id,
			currentOrgCode: userInfo?.organization_code,
		})
		try {
			interfaceStore.setIsSwitchingOrganization(true)
			let shouldRefreshAccountContext = false
			// When accounts differ, compare clusters first. If clusters also differ, switch the account before redirecting the route to the target cluster.
			if (accountInfo?.magic_id !== userInfo?.magic_id) {
				this.logger.log(
					"The target account differs from the current account; starting account switch",
				)
				// Set cluster code before switching account
				if (accountInfo.deployCode) {
					this.logger.log("Setting the cluster code", {
						deployCode: accountInfo.deployCode,
					})
					await service
						.get<ConfigService>("configService")
						.setClusterCode(accountInfo.deployCode)
				}
				this.logger.log("Switching accounts")
				await service
					.get<AccountService>("accountService")
					.switchAccount(accountInfo.magic_id, organizationInfo.magic_organization_code)
				this.logger.log("Account switch completed; broadcasting the account switch event")
				// Broadcast account switch
				BroadcastChannelSender.switchAccount({
					magicId: accountInfo.magic_id,
					magicUserId: organizationInfo.magic_user_id,
					magicOrganizationCode: organizationInfo.magic_organization_code,
				})
				const routeMeta = routesMatch(window.location.pathname)
				if (routeMeta && routeMeta.route.name) {
					this.logger.log("Updating route parameters", {
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
					this.logger.log("Account switch completed; initializing user data")
					await this.platformService?.initUserData(user)
				}
				shouldRefreshAccountContext = true
			} else if (organizationInfo?.magic_organization_code !== userInfo?.organization_code) {
				this.logger.log(
					"The target organization differs from the current organization; starting organization switch",
				)
				try {
					await service
						.get<UserService>("userService")
						.switchOrganization(
							organizationInfo.magic_user_id,
							organizationInfo.magic_organization_code,
							userInfo,
						)
					this.logger.log("Organization switch completed")

					const user = userStore.user.userInfo
					if (user) {
						this.logger.log("Organization switch completed; initializing user data")
						await this.platformService?.initUserData(user)
					}
					shouldRefreshAccountContext = true
				} catch (err) {
					this.logger.error({
						eventKey: "organization_switch_restore_organization_failed",
						errorKind: "unknown",
						error: err,
						message: "Organization switch failed; restoring the current organization",
					})
					// Restore the current organization after a failed switch.
					service
						.get<UserService>("userService")
						.setMagicOrganizationCode(userInfo?.organization_code)
					service.get<UserService>("userService").setUserInfo(userInfo)
				}
			} else {
				this.logger.log("The account and organization are unchanged; no switch is needed")
			}
			onSwitchAfter?.()
			// Let panel cleanup finish first, then reload so account-scoped stores rebuild under the new account.
			if (shouldRefreshAccountContext) {
				refreshAccountContextPage()
			}
			this.logger.log("Organization switch flow completed")
		} catch (err) {
			this.logger.error({
				eventKey: "switch_organization_failed",
				errorKind: "unknown",
				error: err,
				message: "An error occurred while switching organizations",
			})
		} finally {
			interfaceStore.setIsSwitchingOrganization(false)
		}
	}

	/**
	 * Checks the loaded platform before using main-application chat operations.
	 * @returns Whether an available service belongs to the main platform.
	 */
	private isMagicPlatform = () => {
		return this.platformService?.PlatformType === Platform.Magic
	}

	/**
	 * Delegates lazy chat initialization to an available main-platform service.
	 * Other platforms and unavailable services perform no work.
	 * @param magicUser Optional user context accepted by the platform's chat initializer.
	 * @returns Completion of delegated chat initialization, propagating its failures.
	 */
	initChatDataIfNeeded = async (magicUser?: User.UserInfo) => {
		if (!this.platformService || !this.isMagicPlatform()) return

		return (this.platformService as MagicPlatformServiceInterface).initChatDataIfNeeded(
			magicUser,
		)
	}
}

export const appService = new AppService()
