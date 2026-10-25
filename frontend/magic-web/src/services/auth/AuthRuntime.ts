import { authNavigationCoordinator } from "./AuthNavigationCoordinator"

/**
 * Initialize the authentication runtime before any protected request can run.
 *
 * The coordinator is a singleton whose constructor subscribes to the auth event
 * bus. Keeping this explicit in every edition's composition root prevents the
 * enterprise overlay from relying on a lazily loaded login page to install the
 * navigation subscriber.
 */
export function initializeAuthRuntime(): void {
	void authNavigationCoordinator
}
