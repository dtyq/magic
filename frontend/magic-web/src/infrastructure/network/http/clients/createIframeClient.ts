import { createMagicClient } from "./createMagicClient"
import { iframeBusinessErrorInterceptor } from "./magicResponse"
import type { ServiceClientBindings } from "./types"

export function createIframeClient<Scope extends object>(bindings: ServiceClientBindings<Scope>) {
	return createMagicClient({
		...bindings,
		responseInterceptors: [
			iframeBusinessErrorInterceptor,
			...(bindings.responseInterceptors ?? []),
		],
	})
}
