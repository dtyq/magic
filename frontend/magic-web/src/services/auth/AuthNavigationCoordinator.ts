import { RoutePath } from "@/constants/routes"
import { LoginValueKey } from "@/pages/login/constants"
import { buildLoginRedirectSearchParams } from "@/pages/login/utils/loginRedirect"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { convertSearchParams } from "@/routes/history/helpers"
import { authEventBus } from "./AuthEventBus"
import { AuthEventName } from "./AuthEvents"
import type { AuthIntent } from "./contracts"

class AuthNavigationCoordinator {
	private isNavigating = false
	private unsubscribeRequestLogin: (() => void) | null = null
	private unsubscribeLoginRequired: (() => void) | null = null
	private unsubscribeRequestLogout: (() => void) | null = null

	constructor() {
		this.unsubscribeRequestLogin = authEventBus.on(AuthEventName.RequestLogin, (intent) => {
			this.requestLogin(intent)
		})
		this.unsubscribeLoginRequired = authEventBus.on(
			AuthEventName.LoginRequired,
			({ intent }) => {
				this.requestLogin(intent)
			},
		)
		this.unsubscribeRequestLogout = authEventBus.on(AuthEventName.RequestLogout, (request) => {
			if (!request.redirect) return
			this.requestLogin({
				reason: "manual",
				source: "logout",
				returnTo: request.returnTo ?? window.location.href,
				preserveQuery: true,
			})
		})
	}

	requestLogin(intent: AuthIntent): void {
		if (window.location.pathname === RoutePath.Login) {
			// A login page is the terminal destination for the current request;
			// clear the guard so a later successful login can start a new flow.
			this.isNavigating = false
			return
		}
		if (this.isNavigating) return

		this.isNavigating = true
		const currentHref = intent.returnTo ?? window.location.href
		const currentUrl = new URL(currentHref, window.location.origin)
		const redirectTarget = currentUrl.searchParams.get(LoginValueKey.REDIRECT_URL)

		history.replace({
			name: RouteName.Login,
			query: convertSearchParams(
				buildLoginRedirectSearchParams({
					currentHref,
					redirectTarget: redirectTarget ?? currentHref,
				}),
			),
		})
	}

	reset(): void {
		this.isNavigating = false
	}

	dispose(): void {
		this.unsubscribeRequestLogin?.()
		this.unsubscribeLoginRequired?.()
		this.unsubscribeRequestLogout?.()
		this.unsubscribeRequestLogin = null
		this.unsubscribeLoginRequired = null
		this.unsubscribeRequestLogout = null
	}
}

export const authNavigationCoordinator = new AuthNavigationCoordinator()
