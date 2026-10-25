import { v4 as uuidv4 } from "uuid"
import type { Container } from "@/services/ServiceContainer"
import type { AccountService } from "@/services/user/AccountService"
import { userStore } from "@/models/user"
import { authEventBus } from "./AuthEventBus"
import { AuthEventName } from "./AuthEvents"
import type { AuthIntent, AuthSessionInvalidationRequest } from "./contracts"
import { logger as Logger } from "@/infrastructure/logger"
import { isSessionInvalidationExemptRoute } from "./authSessionRouteWhitelist"

const logger = Logger.createLogger("AuthSessionCoordinator")

class AuthSessionCoordinator {
	private readonly inFlight = new Map<string, Promise<void>>()
	private sessionGeneration = 0

	async invalidate({
		service,
		accountId,
		reason,
		source,
		returnTo,
	}: AuthSessionInvalidationRequest & { service: Container }): Promise<void> {
		// Share pages prompt for access on their own. Tearing the session down here
		// redirects guests to login when an unauthenticated request fails.
		if (isSessionInvalidationExemptRoute(window.location.pathname)) return

		// Coalesce HTTP and WebSocket failures for the same active account even when
		// their server-side reason codes differ during one invalid-session window.
		const key = accountId ?? userStore.user.userInfo?.magic_id ?? "current"
		const existing = this.inFlight.get(key)
		if (existing) return existing

		const task = (async () => {
			this.sessionGeneration += 1
			const currentAccountId = userStore.user.userInfo?.magic_id
			const targetAccountId = accountId ?? currentAccountId
			let cleanupStatus: "completed" | "partial" | "failed" = "completed"
			try {
				const cleanupResult = await service
					.get<AccountService>("accountService")
					.invalidateSession({
						accountId: targetAccountId,
					})
				cleanupStatus = cleanupResult.cleanupStatus
			} catch (error) {
				cleanupStatus = "failed"
				logger.error({
					eventKey: "auth_session_cleanup_failed",
					errorKind: "lifecycle",
					error,
					message: "Failed to clean up an invalid authentication session",
					context: { source, reason },
				})
			}
			const remainingAccount = userStore.account.accounts[0]
			let fallbackRestored = false
			if (targetAccountId === currentAccountId && remainingAccount) {
				try {
					await service
						.get<AccountService>("accountService")
						.switchAccount(remainingAccount.magic_id, remainingAccount.organizationCode)
					fallbackRestored = true
				} catch {
					// A fallback account is only considered usable after its session is restored.
					// Failed restoration falls through to the single login-required path below.
				}
			}
			const event = {
				accountId: targetAccountId,
				reason,
				source,
				eventId: uuidv4(),
				sessionGeneration: this.sessionGeneration,
				cleanupStatus,
			}
			const intent: AuthIntent = {
				reason: reason === "missing-session" ? "missing-session" : "auth-expired",
				source,
				returnTo,
			}
			const loginRequired =
				cleanupStatus === "failed" ||
				userStore.account.accounts.length === 0 ||
				!userStore.user.authorization ||
				(targetAccountId === currentAccountId && remainingAccount && !fallbackRestored)

			// A faulty observer must not prevent the terminal login-required event.
			try {
				authEventBus.emit(AuthEventName.SessionInvalidated, event)
			} catch (error) {
				logger.error({
					eventKey: "auth_session_invalidated_listener_failed",
					errorKind: "lifecycle",
					error,
					message: "An auth session invalidation listener failed",
					context: { source, reason },
				})
			}

			if (loginRequired) {
				try {
					authEventBus.emit(AuthEventName.LoginRequired, { intent })
				} catch (error) {
					logger.error({
						eventKey: "auth_login_required_listener_failed",
						errorKind: "lifecycle",
						error,
						message: "An auth login-required listener failed",
						context: { source, reason },
					})
				}
			}
		})()

		this.inFlight.set(key, task)
		try {
			await task
		} finally {
			this.inFlight.delete(key)
		}
	}
}

export const authSessionCoordinator = new AuthSessionCoordinator()
