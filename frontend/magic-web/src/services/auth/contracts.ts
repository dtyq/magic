import type { AppInitializationError } from "@/services/app/errors"

// -----------------------------------------------------------------------------
// Shared vocabulary
// -----------------------------------------------------------------------------

/**
 * Failure categories that may be observed while resolving an authenticated
 * session. Network and transport failures are represented here for shared
 * classification, even when they do not result in a login redirect.
 */
export type AuthFailureKind =
	/** No usable session was available. */
	| "missing-session"
	/** The session token is no longer valid because it expired. */
	| "token-expired"
	/** The account is authenticated but is not authorized for the resource. */
	| "account-unauthorized"
	/** A network request failed before a valid response was received. */
	| "network"
	/** The authentication-related operation exceeded its time limit. */
	| "timeout"
	/** The operation was explicitly cancelled. */
	| "abort"
	/** The response could not be parsed or decoded. */
	| "response-parse"
	/** The server returned an authentication-related failure. */
	| "server"
	/** A permission or policy check rejected the operation. */
	| "permission"
	/** The selected organization is not valid for the current session. */
	| "invalid-organization"
	/** A third-party authentication callback could not be accepted. */
	| "third-party-callback"
	/** The failure cannot be classified more precisely. */
	| "unknown"

/** User-facing intent that can be consumed by the navigation coordinator. */
export type AuthIntentReason =
	/** The application has no usable session. */
	| "missing-session"
	/** An existing authenticated session became unusable. */
	| "auth-expired"
	/** A protected share resource requires authentication. */
	| "share-access-required"
	/** A third-party login or callback flow failed. */
	| "third-party-auth-failed"
	/** The user explicitly requested an authentication action. */
	| "manual"
	/** The request originated from a cross-tab compatibility flow. */
	| "cross-tab"

/** Origin of an authentication command or lifecycle event. */
export type AuthSource =
	/** Application bootstrap or initialization. */
	| "app-init"
	/** HTTP request or response handling. */
	| "http"
	/** WebSocket or chat-session handling. */
	| "websocket"
	/** Explicit logout handling. */
	| "logout"
	/** Legacy cross-tab broadcast compatibility. */
	| "broadcast"
	/** Share-page or share-resource handling. */
	| "share"
	/** Third-party authentication integration. */
	| "third-party"
	/** Anta-specific authentication integration. */
	| "anta"
	/** Teamshare-specific authentication integration. */
	| "teamshare"
	/** Crew conversation authentication recovery. */
	| "crew"

// -----------------------------------------------------------------------------
// Commands and event payloads
// -----------------------------------------------------------------------------

export interface AuthIntent {
	/** High-level reason why authentication is required. */
	reason: AuthIntentReason
	/** Component or domain that originated the intent. */
	source: AuthSource
	/** Optional account identifier associated with the intent. */
	accountId?: string
	/** URL to restore after the authentication flow completes. */
	returnTo?: string
	/** Whether login-specific query state should be preserved. */
	preserveQuery?: boolean
}

/** Input used by the session coordinator to invalidate one account session. */
export interface AuthSessionInvalidationRequest {
	/** Account whose session should be removed; omitted means the current account. */
	accountId?: string
	/** Failure category that caused the invalidation request. */
	reason: AuthFailureKind
	/** Component or domain that detected the invalid session. */
	source: AuthSource
	/** URL to restore if invalidation eventually requires login. */
	returnTo?: string
}

export interface AuthRequestLogout {
	/** User or lifecycle reason for the logout request. */
	reason: "manual" | "account-deleted" | "cross-tab"
	/** Whether logout should continue into the login navigation flow. */
	redirect: boolean
	/** URL to restore after the logout/login flow. */
	returnTo?: string
}

export interface AuthLoginRequired {
	/** Authentication intent that explains why login is now required. */
	intent: AuthIntent
}

export interface AuthSessionInvalidated {
	/** Account whose session was invalidated, when known. */
	accountId?: string
	/** Failure category associated with the invalidation. */
	reason: AuthFailureKind
	/** Component or domain that detected the invalid session. */
	source: AuthSource
	/** Unique identifier for this invalidation event. */
	eventId: string
	/** Monotonic generation used to distinguish successive session transitions. */
	sessionGeneration: number
	/** Whether local cleanup completed before the lifecycle event was published. */
	cleanupStatus: "completed" | "partial" | "failed"
}

// -----------------------------------------------------------------------------
// Coordinator results and initialization context
// -----------------------------------------------------------------------------

/** Result vocabulary reserved for future callers that need an explicit resolution result. */
export type SessionResolution =
	/** The response belongs to an obsolete session generation and is ignored. */
	| { kind: "ignore-stale-response" }
	/** A valid cached account can replace the invalidated account. */
	| { kind: "switch-account"; accountId: string }
	/** No usable account remains and the user must authenticate again. */
	| { kind: "login-required"; intent: AuthIntent }

/** Authentication-related context attached to app initialization failures. */
export interface AppInitAuthContext {
	/** Route that was being initialized when the failure occurred. */
	pathname: string
	/** Structured initialization error used for authentication classification. */
	initError: AppInitializationError
}
