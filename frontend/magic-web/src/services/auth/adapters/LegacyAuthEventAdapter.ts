import { authEventBus } from "../AuthEventBus"
import { AuthEventName } from "../AuthEvents"

/**
 * Converts the legacy cross-tab delete-account payload into a local auth intent.
 * Account cleanup remains owned by the legacy event handler; this adapter only
 * bridges the navigation part so the old transport does not navigate directly.
 */
export function emitLegacyDeleteAccountAuthEvent(data: {
	magicId?: string
	navigateToLogin?: boolean
}) {
	if (!data.navigateToLogin) return

	authEventBus.emit(AuthEventName.RequestLogout, {
		reason: "account-deleted",
		redirect: true,
		returnTo: window.location.href,
	})
}
