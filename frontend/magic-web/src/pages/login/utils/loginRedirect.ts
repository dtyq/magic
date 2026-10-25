import { RoutePath } from "@/constants/routes"
import { LOGIN_STRATEGY_QUERY_KEY, LoginValueKey } from "../constants"

interface BuildLoginRedirectSearchParamsOptions {
	currentHref: string
	redirectTarget?: string | null
}

function getSearchParamFromUrl(url: string | null | undefined, key: string) {
	if (!url) return null

	try {
		return new URL(url, window.location.origin).searchParams.get(key)
	} catch {
		return null
	}
}

export function buildLoginRedirectSearchParams({
	currentHref,
	redirectTarget,
}: BuildLoginRedirectSearchParamsOptions) {
	const currentUrl = new URL(currentHref, window.location.origin)
	const resolvedRedirectTarget =
		redirectTarget ??
		currentUrl.searchParams.get(LoginValueKey.REDIRECT_URL) ??
		currentUrl.toString()

	const searchParams = new URLSearchParams({
		[LoginValueKey.REDIRECT_URL]: resolvedRedirectTarget,
	})

	const loginStrategy =
		currentUrl.searchParams.get(LOGIN_STRATEGY_QUERY_KEY) ??
		getSearchParamFromUrl(resolvedRedirectTarget, LOGIN_STRATEGY_QUERY_KEY)

	if (loginStrategy) {
		// Keep the strategy at the login route level so deployment-specific login pages
		// can select the matching form before reading the encoded redirect target.
		searchParams.set(LOGIN_STRATEGY_QUERY_KEY, loginStrategy)
	}

	return searchParams
}

/**
 * Generates the login redirect URL.
 * @returns The login redirect URL
 */
export const genLoginRedirectUrl = () => {
	const redirectUrl = new URL(RoutePath.Login, window.location.origin)
	if (window.location.pathname !== RoutePath.Login) {
		const redirectTarget = new URLSearchParams(window.location.search).get(
			LoginValueKey.REDIRECT_URL,
		)

		// Keep login-related query state when API auth expires inside embedded routes.
		redirectUrl.search = buildLoginRedirectSearchParams({
			currentHref: window.location.href,
			redirectTarget: redirectTarget ?? window.location.href,
		}).toString()
	}
	return redirectUrl.toString()
}
