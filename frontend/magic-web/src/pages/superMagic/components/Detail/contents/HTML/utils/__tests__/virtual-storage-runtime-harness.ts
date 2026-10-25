import { JSDOM } from "jsdom"
import {
	createVirtualStorageContext,
	createVirtualStorageMessageHandler,
	getVirtualStorageBridgeScript,
	virtualStorageRegistry,
} from "../virtual-storage"

/** Execute the real generated bridge and real host handler; replace transport only. */
export async function createStorageRuntime(
	namespace: string,
	hostRuntime = {
		createVirtualStorageContext,
		createVirtualStorageMessageHandler,
		getVirtualStorageBridgeScript,
		virtualStorageRegistry,
	},
) {
	const dom = new JSDOM("", { url: "https://iframe.example", runScripts: "outside-only" })
	const frame = dom.window
	const context = await hostRuntime.createVirtualStorageContext({
		namespace,
		source: frame as unknown as Window,
		origin: frame.location.origin,
		targetOrigin: window.location.origin,
	})
	hostRuntime.virtualStorageRegistry.register(context)
	const handle = hostRuntime.createVirtualStorageMessageHandler()
	const pending = new Set<Promise<void>>()
	const host = {
		postMessage(data: unknown) {
			const operation = handle(
				new MessageEvent("message", {
					data,
					source: frame as unknown as Window,
					origin: frame.location.origin,
				}),
			)
			pending.add(operation)
			void operation.finally(() => pending.delete(operation))
		},
	}
	Object.defineProperty(frame, "parent", { value: host })
	Reflect.set(frame, "__MAGIC_POST_MESSAGE_TARGET_STRATEGY__", "cross-origin-parent")
	frame.postMessage = (data: unknown) => {
		frame.dispatchEvent(
			new frame.MessageEvent("message", {
				data,
				source: host as unknown as Window,
				origin: window.location.origin,
			}),
		)
	}
	frame.eval(hostRuntime.getVirtualStorageBridgeScript(context))
	return {
		frame,
		async flush() {
			while (pending.size) await Promise.all(pending)
		},
		close: () => dom.window.close(),
	}
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onabort = () =>
			reject(transaction.error ?? new DOMException("Aborted", "AbortError"))
	})
}
