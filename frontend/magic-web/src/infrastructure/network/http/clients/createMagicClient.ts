import { ServiceHttpClient } from "./ServiceHttpClient"
import type { OwnedServiceClient, ServiceClientBindings } from "./types"

/** Independent construction requires explicit application context and readiness. */
export class MagicHttpClient<Scope extends object = object> extends ServiceHttpClient<Scope> {
	constructor(bindings: ServiceClientBindings<Scope>) {
		super(bindings, bindings)
	}
}

export function createMagicClient<Scope extends object>(
	bindings: ServiceClientBindings<Scope>,
): OwnedServiceClient {
	const client = new MagicHttpClient(bindings)
	return { client, dispose: () => client.dispose() }
}
