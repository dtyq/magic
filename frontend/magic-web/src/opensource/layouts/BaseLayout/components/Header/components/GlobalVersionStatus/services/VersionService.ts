import { env } from "@/opensource/utils/env"

interface VersionState {
	MAGIC_APP_VERSION: string
	MAGIC_APP_SHA: string
}

export class VersionService {
	private pollTimer?: NodeJS.Timeout
	private isDestroyed = false
	private pollingRequestFrequency = 10 * 60 * 1000

	private MAGIC_APP_VERSION = env("MAGIC_APP_VERSION")
	private MAGIC_APP_SHA = env("MAGIC_APP_SHA")

	// Callback function type definitions
	private callbacks: {
		onVersionUpdate?: (status: VersionState) => void
		onError?: (error: any) => void
	} = {}

	setCallbacks(callbacks: {
		onVersionUpdate?: (status: VersionState) => void
		onError?: (error: any) => void
	}) {
		this.callbacks = { ...this.callbacks, ...callbacks }
	}

	async start() {
		if (this.isDestroyed) return

		try {
			this.startPolling()
		} catch (error) {
			this.callbacks.onError?.(error)
		}
	}

	private getVersion(): Promise<VersionState> {
		return new Promise<VersionState>((resolve, reject) => {
			fetch("/config.json")
				.then((response) => {
					if (!response.ok) {
						reject(`HTTP error! status: ${response.status}`)
					}
					return response.json()
				})
				.then((config) => {
					resolve(config)
				})
				.catch((error) => {
					reject(error)
				})
		})
	}

	private async startPolling() {
		if (this.isDestroyed) return

		try {
			const { MAGIC_APP_VERSION, MAGIC_APP_SHA } = await this.getVersion()

			if (
				this.MAGIC_APP_VERSION !== MAGIC_APP_VERSION ||
				this.MAGIC_APP_SHA !== MAGIC_APP_SHA
			) {
				this.clearTimers()
				this.callbacks.onVersionUpdate?.({
					MAGIC_APP_VERSION,
					MAGIC_APP_SHA,
				})
			} else {
				// Continue polling
				this.pollTimer = setTimeout(() => {
					this.startPolling()
				}, this.pollingRequestFrequency)
			}
		} catch (error) {
			this.callbacks.onError?.(error)
		}
	}

	private clearTimers() {
		if (this.pollTimer) {
			clearTimeout(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	destroy() {
		this.isDestroyed = true
		this.clearTimers()
	}

	restart() {
		this.destroy()
		this.isDestroyed = false
		this.start()
	}

	getStatus() {
		return {
			isDestroyed: this.isDestroyed,
			hasPollTimer: !!this.pollTimer,
		}
	}
}
