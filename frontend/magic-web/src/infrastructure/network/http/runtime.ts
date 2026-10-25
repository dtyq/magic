import { ServiceHttpClient } from "./clients/ServiceHttpClient"
import { HttpNotInitializedError } from "./errors"
import type { OwnedServiceClient } from "./clients/types"

/** A slot has stable identity; imports/API closures never capture an obsolete runtime. */
export function createHttpClientSlot(name: string) {
	let current: OwnedServiceClient | undefined
	const target = new ServiceHttpClient({ baseURL: "" })
	const client = new Proxy(target, {
		get(_target, key) {
			if (key === "then") return undefined
			return (...args: unknown[]) => {
				if (!current) {
					const error = new HttpNotInitializedError(name)
					if (
						[
							"get",
							"post",
							"put",
							"patch",
							"delete",
							"request",
							"retry",
							"abort",
						].includes(String(key))
					)
						return Promise.reject(error)
					throw error
				}
				const method = Reflect.get(current.client, key)
				return Reflect.apply(method, current.client, args)
			}
		},
	})
	return {
		client,
		bind(owned: OwnedServiceClient) {
			const previous = current
			current = owned
			previous?.dispose()
			return {
				dispose() {
					// An old HMR owner cannot tear down the replacement binding.
					if (current === owned) current = undefined
					owned.dispose()
				},
			}
		},
	}
}

const magicSlot = createHttpClientSlot("magic")
const iframeSlot = createHttpClientSlot("iframe")
export const http = magicSlot.client
export const defaultMagicClient = http
export const defaultIframeClient = iframeSlot.client

/** Clients are fully assembled before publishing either default entry. */
export function startDefaultHttpRuntime(clients: {
	magic: OwnedServiceClient
	iframe: OwnedServiceClient
}) {
	const handles = [magicSlot.bind(clients.magic), iframeSlot.bind(clients.iframe)]
	return { dispose: () => [...handles].reverse().forEach((handle) => handle.dispose()) }
}
