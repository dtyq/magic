/**
 * DevToolsCollector
 * Coordinates ConsoleProxy, NetworkInterceptor, and ApiCallProxy,
 * and forwards collected entries to the parent window via postMessage.
 */

import { ConsoleProxy } from "./ConsoleProxy"
import { NetworkInterceptor } from "./NetworkInterceptor"
import { ApiCallProxy } from "./ApiCallProxy"
import { MessageProxy } from "./MessageProxy"
import { StorageInspector } from "./StorageInspector"
import { getParentOrigin } from "../utils/parentOrigin"

// Message types for parent ↔ iframe communication
export const DEVTOOLS_MSG = {
	/** parent → iframe: toggle devtools on/off */
	TOGGLE: "MAGIC_DEVTOOLS_TOGGLE",
	/** iframe → parent: single console entry */
	CONSOLE_ENTRY: "MAGIC_DEVTOOLS_CONSOLE_ENTRY",
	/** iframe → parent: single network entry */
	NETWORK_ENTRY: "MAGIC_DEVTOOLS_NETWORK_ENTRY",
	/** iframe → parent: full snapshot (on enable) */
	SNAPSHOT: "MAGIC_DEVTOOLS_SNAPSHOT",
	/** parent → iframe: request to clear entries */
	CLEAR: "MAGIC_DEVTOOLS_CLEAR",
	/** parent → iframe: evaluate JS code */
	EVAL: "MAGIC_DEVTOOLS_EVAL",
	/** iframe → parent: eval result */
	EVAL_RESULT: "MAGIC_DEVTOOLS_EVAL_RESULT",
	/** parent → iframe: request completions for expression */
	EVAL_COMPLETIONS: "MAGIC_DEVTOOLS_EVAL_COMPLETIONS",
	/** iframe → parent: completions result */
	EVAL_COMPLETIONS_RESULT: "MAGIC_DEVTOOLS_EVAL_COMPLETIONS_RESULT",
	/** iframe → parent: API call event */
	API_CALL_ENTRY: "MAGIC_DEVTOOLS_API_CALL_ENTRY",
	/** iframe → parent: message entry */
	MESSAGE_ENTRY: "MAGIC_DEVTOOLS_MESSAGE_ENTRY",
	/** parent → iframe: request storage snapshot */
	STORAGE_REQUEST: "MAGIC_DEVTOOLS_STORAGE_REQUEST",
	/** iframe → parent: storage snapshot response */
	STORAGE_SNAPSHOT: "MAGIC_DEVTOOLS_STORAGE_SNAPSHOT",
} as const

export class DevToolsCollector {
	private consoleProxy: ConsoleProxy
	private networkInterceptor: NetworkInterceptor
	private apiCallProxy: ApiCallProxy
	private messageProxy: MessageProxy
	private storageInspector: StorageInspector
	private enabled = false

	constructor() {
		this.consoleProxy = new ConsoleProxy()
		this.networkInterceptor = new NetworkInterceptor()
		this.apiCallProxy = new ApiCallProxy()
		this.messageProxy = new MessageProxy()
		this.storageInspector = new StorageInspector()

		// Wire up listeners that forward entries to parent
		this.consoleProxy.onEntry((entry) => {
			this.postToParent(DEVTOOLS_MSG.CONSOLE_ENTRY, entry)
		})
		this.networkInterceptor.onEntry((entry) => {
			this.postToParent(DEVTOOLS_MSG.NETWORK_ENTRY, entry)
		})
		this.apiCallProxy.onEntry((entry) => {
			this.postToParent(DEVTOOLS_MSG.API_CALL_ENTRY, entry)
		})
		this.messageProxy.onEntry((entry) => {
			this.postToParent(DEVTOOLS_MSG.MESSAGE_ENTRY, entry)
		})
	}

	enable(): void {
		if (this.enabled) return
		this.enabled = true
		// MessageProxy must be enabled BEFORE ConsoleProxy so that outgoing
		// postMessage calls (including the snapshot) are captured.
		// Wrap in try-catch so a single proxy failure doesn't block others.
		try {
			this.messageProxy.enable()
		} catch {
			// MessageProxy may fail in restrictive cross-origin environments
		}
		this.consoleProxy.enable()
		this.networkInterceptor.enable()
		this.apiCallProxy.enable()

		// Send initial snapshot so parent gets any entries captured before enable
		this.postToParent(DEVTOOLS_MSG.SNAPSHOT, {
			consoleEntries: this.consoleProxy.getEntries(),
			networkEntries: this.networkInterceptor.getEntries(),
			apiCallEntries: this.apiCallProxy.getEntries(),
			messageEntries: this.messageProxy.getEntries(),
		})
	}

	disable(): void {
		if (!this.enabled) return
		this.enabled = false
		this.consoleProxy.disable()
		this.networkInterceptor.disable()
		this.apiCallProxy.disable()
		this.messageProxy.disable()
	}

	clear(): void {
		this.consoleProxy.clear()
		this.networkInterceptor.clear()
		this.apiCallProxy.clear()
		this.messageProxy.clear()
	}

	destroy(): void {
		this.disable()
		this.consoleProxy.destroy()
		this.apiCallProxy.destroy()
		this.messageProxy.destroy()
		this.clear()
	}

	isEnabled(): boolean {
		return this.enabled
	}

	/** Handle storage snapshot request from parent */
	async sendStorageSnapshot(): Promise<void> {
		try {
			const data = await this.storageInspector.snapshotAsync()
			this.postToParent(DEVTOOLS_MSG.STORAGE_SNAPSHOT, data)
		} catch {
			// ignore storage read errors
		}
	}

	private postToParent(type: string, payload: unknown): void {
		try {
			window.parent.postMessage({ type, payload, timestamp: Date.now() }, getParentOrigin())
		} catch {
			// Silently ignore if parent is not available
		}
	}
}
