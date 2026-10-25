import type {
	AuthIntent,
	AuthLoginRequired,
	AuthRequestLogout,
	AuthSessionInvalidationRequest,
	AuthSessionInvalidated,
} from "./contracts"

/**
 * Stable event identifiers used by the authentication domain bus.
 *
 * Keeping event names in one runtime enum prevents string literals from
 * drifting between event producers and consumers while preserving the
 * string values required by the typed EventBus.
 */
export enum AuthEventName {
	/** Request navigation to the host login entry. */
	RequestLogin = "auth/request-login",
	/** Request logout handling, optionally followed by login navigation. */
	RequestLogout = "auth/request-logout",
	/** Request invalidation of one authenticated account session. */
	InvalidateSession = "auth/invalidate-session",
	/** Notify observers that an account session has been invalidated. */
	SessionInvalidated = "auth/session-invalidated",
	/** Notify the navigation layer that an authenticated session is required. */
	LoginRequired = "auth/login-required",
}

/**
 * One-to-one mapping between each auth event name and its payload type.
 *
 * This mapping is the compile-time contract for authEventBus: changing an
 * event payload requires updating its corresponding entry here.
 */
export interface AuthEvents {
	[AuthEventName.RequestLogin]: AuthIntent
	[AuthEventName.RequestLogout]: AuthRequestLogout
	[AuthEventName.InvalidateSession]: AuthSessionInvalidationRequest
	[AuthEventName.SessionInvalidated]: AuthSessionInvalidated
	[AuthEventName.LoginRequired]: AuthLoginRequired
}
