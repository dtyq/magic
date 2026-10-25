import { startDefaultHttpRuntime } from "@/infrastructure/network/http/runtime"
import { createMagicClient, createIframeClient } from "@/infrastructure/network/http/clients"
import { createMagicClientOptions } from "./options/magic"
import { createIframeClientOptions } from "./options/iframe"
import type { OwnedServiceClient } from "@/infrastructure/network/http/clients/types"

/** Owns default application bindings. API calls use the infrastructure's stable clients. */
export class AppHttpService {
	private owned?: { dispose(): void }
	private magic?: OwnedServiceClient
	private magicBaseURL = ""

	init() {
		if (this.owned) return
		const pending: { dispose(): void }[] = []
		try {
			const options = createMagicClientOptions(
				() => this.magicBaseURL,
				(baseURL) => this.recoverMagicBaseURL(baseURL),
			)
			this.magicBaseURL = options.baseURL
			const magic = createMagicClient(options)
			pending.push(magic)
			const iframe = createIframeClient(createIframeClientOptions())
			pending.push(iframe)
			this.owned = startDefaultHttpRuntime({ magic, iframe })
			this.magic = magic
			// Ownership transfers to the runtime; clients must not be disposed twice.
			pending.length = 0
		} catch (error) {
			this.magic = undefined
			for (const resource of pending.reverse()) resource.dispose()
			throw error
		}
	}

	private recoverMagicBaseURL(baseURL: string): void {
		if (!this.magic || baseURL === this.magicBaseURL) return
		this.magic.client.setBaseURL(baseURL)
		this.magicBaseURL = baseURL
	}

	/** OSS has no cluster-dependent default addresses and installs no idle subscription. */
	syncClusterBaseURLs(_clusterCode?: string): void {
		// Deliberately inert: the matching enterprise service owns cluster routing.
	}

	dispose() {
		this.owned?.dispose()
		this.owned = undefined
		this.magic = undefined
		this.magicBaseURL = ""
	}
}

export const httpService = new AppHttpService()
if (import.meta.hot) import.meta.hot.dispose(() => httpService.dispose())
