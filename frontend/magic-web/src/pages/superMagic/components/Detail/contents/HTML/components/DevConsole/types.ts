/**
 * Shared type definitions for DevConsole
 * Mirrors the entry types from iframe-runtime
 */

// ─── Console Entry (matches iframe-runtime/features/ConsoleProxy) ────────

export type ConsoleLevel = "log" | "info" | "warn" | "error"

/** Structured representation of a JS value for tree rendering */
export interface SerializedValue {
	type:
		| "string"
		| "number"
		| "boolean"
		| "null"
		| "undefined"
		| "symbol"
		| "bigint"
		| "function"
		| "object"
		| "array"
		| "date"
		| "regexp"
		| "error"
		| "map"
		| "set"
		| "promise"
		| "htmlelement"
	/** Preview text for collapsed display */
	preview: string
	/** Primitive value if applicable */
	value?: string | number | boolean | null
	/** Object/array child properties */
	properties?: { key: string; value: SerializedValue }[]
	/** Length for arrays/sets/maps */
	length?: number
	/** True if properties were truncated */
	truncated?: boolean
	/** Constructor/class name for objects */
	className?: string
}

export interface ConsoleEntry {
	id: string
	level: ConsoleLevel
	args: string[]
	timestamp: number
	stack?: string
	/** "console" | "magicApi" | "uncaughtError" | "unhandledRejection" */
	source: string
	/** Structured value for eval results (enables tree rendering) */
	structuredResult?: SerializedValue
}

// ─── Network Entry (matches iframe-runtime/features/NetworkInterceptor) ──

export interface NetworkEntry {
	id: string
	method: string
	url: string
	status: number
	statusText: string
	duration: number
	requestHeaders: Record<string, string>
	requestBody: string | null
	responseHeaders: Record<string, string>
	responseBody: string | null
	startTime: number
	endTime: number
	error?: string
	/** Original URL before fetch interception resolved it (parent-side enrichment) */
	originalUrl?: string
	/** Resolved URL after fetch interception, e.g. OSS temporary URL (parent-side enrichment) */
	resolvedUrl?: string
}

// ─── API Call Entry (captures Magic API postMessage calls) ───────────────

export type ApiCallStatus = "pending" | "success" | "error" | "timeout"

export interface ApiCallEntry {
	id: string
	/** API class name, e.g. "MagicFSApi", "MagicLLMApi" */
	api: string
	/** Operation event, e.g. "request:start", "request:success" */
	event: string
	/** Structured details (type, requestId, etc.) */
	details?: Record<string, unknown>
	status: ApiCallStatus
	startTime: number
	endTime?: number
	duration?: number
	/** Error message if failed */
	error?: string
}

// ─── Message Entry (captures postMessage traffic) ───────────────────────

export type MessageDirection = "outgoing" | "incoming"

export interface MessageEntry {
	id: string
	direction: MessageDirection
	/** The message type (event.data.type) if available */
	type: string
	/** The full message payload */
	payload: unknown
	timestamp: number
	/** Origin of the message for incoming */
	origin?: string
}

// ─── Storage Snapshot ────────────────────────────────────────────────────

export interface StorageSnapshot {
	cookies: Record<string, string>
	localStorage: Record<string, string>
	sessionStorage: Record<string, string>
	indexedDB: { name: string; version: number; objectStores: string[] }[]
}

// ─── Dependency Entry (external resource URL mapping) ────────────────────

export type DependencyType =
	| "script"
	| "stylesheet"
	| "image"
	| "font"
	| "media"
	| "iframe"
	| "other"
export type DependencySource = "static" | "dynamic"

export interface DependencyEntry {
	id: string
	/** Resource type */
	type: DependencyType
	/** Original URL/path in the HTML source */
	originalUrl: string
	/** Resolved URL after replacement (OSS URL, CDN URL, etc.) */
	resolvedUrl: string
	/** HTML tag name that referenced this resource */
	tagName: string
	/** Attribute name (src, href, etc.) */
	attrName: string
	/** Whether this was resolved statically or dynamically */
	source: DependencySource
	/** Timestamp when the resolution was recorded */
	timestamp: number
}

// ─── DevConsole state ────────────────────────────────────────────────────

export type DevConsoleTab =
	| "console"
	| "network"
	| "api"
	| "messages"
	| "storage"
	| "sources"
	| "dependencies"

export type DevConsoleMode = "basic" | "advanced"

// ─── Message types (keep in sync with iframe-runtime DevToolsCollector) ──

export const DEVTOOLS_MSG = {
	TOGGLE: "MAGIC_DEVTOOLS_TOGGLE",
	CONSOLE_ENTRY: "MAGIC_DEVTOOLS_CONSOLE_ENTRY",
	NETWORK_ENTRY: "MAGIC_DEVTOOLS_NETWORK_ENTRY",
	SNAPSHOT: "MAGIC_DEVTOOLS_SNAPSHOT",
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
