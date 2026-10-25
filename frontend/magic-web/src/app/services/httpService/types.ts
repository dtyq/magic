import type { ServiceClientBindings } from "@/infrastructure/network/http/clients/types"

/** Business state captured together for one application request. */
export interface HttpRequestSnapshot {
	readonly scopeId: string
	readonly sessionEpoch: number
	readonly authorization?: string
	readonly organizationCode?: string
	readonly language: string
	readonly baseURL?: string
}

export type AppHttpClientBindings = ServiceClientBindings<HttpRequestSnapshot>
