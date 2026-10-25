import { FlowApi } from "@/apis"
import { generateCallbackUrl } from "@/components/Agent/MCP/helpers"

export interface MCPOAuthRequireField {
	field_name: string
	field_value?: string
}

export interface MCPOAuthStatus {
	auth_config: {
		is_authenticated: boolean
		oauth_url?: string
		authorization_url?: string
		issuer?: string
		resource?: string
		scope?: string
		expires_at?: string
		error?: string
	}
	auth_type: 0 | 1 | 2
	require_fields: Array<MCPOAuthRequireField>
}

/**
 * Poll MCP user settings every two seconds until authorization succeeds.
 * Register lifecycle callbacks with setCallbacks, then call start(id) or restart(id).
 * An initial status avoids a duplicate first request; later polls fetch fresh settings.
 * Call destroy when the owning UI unmounts to abort requests and clear timers.
 * restart replaces the aborted controller and starts a new polling lifecycle.
 */
export class MCPOAuthService {
	private api: typeof FlowApi
	private qrRefreshTimer?: NodeJS.Timeout
	private pollTimer?: NodeJS.Timeout
	private abortController: AbortController
	private isDestroyed = false

	// Optional callbacks notify the owning UI about authorization status and failures.
	private callbacks: {
		onLoadingChange?: (loading: boolean) => void
		onSuccess?: (response: MCPOAuthStatus) => void
		onError?: (error: any) => void
		onStatusUpdate?: (response: MCPOAuthStatus) => void
	} = {}

	constructor(api: typeof FlowApi) {
		this.api = api
		this.abortController = new AbortController()
	}

	/**
	 * Merge callbacks into the current lifecycle handlers.
	 * @param callbacks Handlers supplied by the owning UI.
	 */
	setCallbacks(callbacks: {
		onLoadingChange?: (loading: boolean) => void
		onSuccess?: (response: MCPOAuthStatus) => void
		onError?: (error: any) => void
		onStatusUpdate?: (response: MCPOAuthStatus) => void
	}) {
		this.callbacks = { ...this.callbacks, ...callbacks }
	}

	/**
	 * Start the authorization status polling lifecycle.
	 */
	async start(id: string, initialStatus?: MCPOAuthStatus) {
		if (this.isDestroyed) return

		try {
			this.startPolling(id, initialStatus)
		} catch (error) {
			this.callbacks.onError?.(error)
		}
	}

	/**
	 * Fetch authorization status and schedule the next poll when authorization is incomplete.
	 * @param id MCP id
	 */
	private async startPolling(id: string, initialStatus?: MCPOAuthStatus) {
		if (this.isDestroyed) return

		try {
			const result =
				initialStatus ??
				(await this.api.getMCPUserSettings(
					{
						code: id,
						redirectUrl: generateCallbackUrl(),
					},
					{
						signal: this.abortController.signal,
					},
				))

			this.callbacks.onStatusUpdate?.(result)

			if (result.auth_config.is_authenticated) {
				// Stop polling and notify the UI when authorization succeeds.
				this.clearTimers()
				this.callbacks.onSuccess?.(result)
			} else {
				// Poll again while authorization remains incomplete.
				this.pollTimer = setTimeout(() => {
					this.startPolling(id)
				}, 2000)
			}
		} catch (error) {
			if (!this.abortController.signal.aborted) {
				this.callbacks.onError?.(error)
			}
		}
	}

	/**
	 * Clear all timers owned by this authorization lifecycle.
	 */
	private clearTimers() {
		if (this.qrRefreshTimer) {
			clearTimeout(this.qrRefreshTimer)
			this.qrRefreshTimer = undefined
		}
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	/**
	 * Stop polling, abort the current request, and release lifecycle resources.
	 */
	destroy() {
		this.isDestroyed = true
		this.abortController.abort()
		this.clearTimers()
	}

	/**
	 * Restart authorization polling with a fresh abort controller.
	 */
	restart(id: string, initialStatus?: MCPOAuthStatus) {
		this.destroy()
		this.abortController = new AbortController()
		this.isDestroyed = false
		this.start(id, initialStatus)
	}
}
