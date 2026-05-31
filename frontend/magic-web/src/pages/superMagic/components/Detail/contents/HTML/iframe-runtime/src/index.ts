/**
 * Iframe Editor Runtime
 * Entry point for HTML editing runtime in iframe
 *
 * Two-phase initialization:
 * - Phase 1 (installAPIs): Runs immediately on DOMContentLoaded — installs
 *   window.Magic.fs and window.Magic.llm. Always available in both preview
 *   and edit mode.
 * - Phase 2 (activateEditorRuntime): Runs only when parent sends
 *   { type: "activateEditorRuntime" } — initializes the full EditorRuntime
 *   (DOM selector, undo/redo, style editing, etc.).
 */
import { EditorRuntime } from "./runtime/EditorRuntime"
import { EditorLogger } from "./utils/EditorLogger"
import { DevToolsCollector, DEVTOOLS_MSG } from "./features/DevToolsCollector"
import { ElementInspectorHandler } from "./features/ElementInspectorHandler"
import { installMagicAPIs } from "./magic-api"

// ─── Phase 1: Install APIs (always runs) ───────────────────────────────────

let editorRuntime: EditorRuntime | null = null
// Pre-create DevToolsCollector immediately so its ConsoleProxy registers
// window.onerror / unhandledrejection before any page scripts run.
const devToolsCollector: DevToolsCollector = new DevToolsCollector()
// Element inspector — lightweight, independent of editor runtime
const elementInspector: ElementInspectorHandler = new ElementInspectorHandler()

// ─── Value serialization for structured eval output ─────────────────────────

interface SerializedValue {
	type: string
	preview: string
	value?: string | number | boolean | null
	properties?: { key: string; value: SerializedValue }[]
	length?: number
	truncated?: boolean
	className?: string
}

const MAX_PROPERTIES = 50
const MAX_STRING_PREVIEW = 200

function getValueType(val: unknown): SerializedValue["type"] {
	if (val === null) return "null"
	if (val === undefined) return "undefined"
	if (typeof val === "string") return "string"
	if (typeof val === "number") return "number"
	if (typeof val === "boolean") return "boolean"
	if (typeof val === "symbol") return "symbol"
	if (typeof val === "bigint") return "bigint"
	if (typeof val === "function") return "function"
	if (val instanceof Error) return "error"
	if (val instanceof Date) return "date"
	if (val instanceof RegExp) return "regexp"
	if (val instanceof Map) return "map"
	if (val instanceof Set) return "set"
	if (val instanceof Promise) return "promise"
	if (Array.isArray(val)) return "array"
	if (val instanceof HTMLElement) return "htmlelement"
	return "object"
}

function serializeValue(val: unknown, depth: number): SerializedValue {
	const type = getValueType(val)

	if (type === "null") return { type, preview: "null", value: null }
	if (type === "undefined") return { type, preview: "undefined" }
	if (type === "boolean") return { type, preview: String(val), value: val as boolean }
	if (type === "number") return { type, preview: String(val), value: val as number }
	if (type === "bigint") return { type, preview: `${val}n` }
	if (type === "symbol") return { type, preview: String(val) }

	if (type === "string") {
		const s = val as string
		const truncated = s.length > MAX_STRING_PREVIEW
		return {
			type,
			preview: truncated ? `"${s.slice(0, MAX_STRING_PREVIEW)}…"` : `"${s}"`,
			value: s,
		}
	}

	if (type === "function") {
		const fn = val as (...args: unknown[]) => unknown
		const name = fn.name || "anonymous"
		return { type, preview: `ƒ ${name}()` }
	}

	if (type === "date") return { type, preview: (val as Date).toISOString(), className: "Date" }
	if (type === "regexp") return { type, preview: String(val), className: "RegExp" }
	if (type === "promise") return { type, preview: "Promise {<…>}", className: "Promise" }

	if (type === "error") {
		const err = val as Error
		const result: SerializedValue = {
			type,
			preview: `${err.name}: ${err.message}`,
			className: err.constructor?.name ?? "Error",
		}
		if (depth > 0) {
			result.properties = [
				{ key: "message", value: serializeValue(err.message, 0) },
				{ key: "stack", value: serializeValue(err.stack, 0) },
			]
		}
		return result
	}

	if (type === "htmlelement") {
		const el = val as HTMLElement
		const tag = el.tagName.toLowerCase()
		const id = el.id ? `#${el.id}` : ""
		const cls = el.className
			? `.${String(el.className).split(" ").filter(Boolean).join(".")}`
			: ""
		return { type, preview: `<${tag}${id}${cls}>`, className: el.constructor?.name }
	}

	if (type === "map") {
		const map = val as Map<unknown, unknown>
		const result: SerializedValue = {
			type,
			preview: `Map(${map.size})`,
			length: map.size,
			className: "Map",
		}
		if (depth > 0) {
			let count = 0
			result.properties = []
			for (const [k, v] of map) {
				if (count >= MAX_PROPERTIES) {
					result.truncated = true
					break
				}
				result.properties.push({ key: String(k), value: serializeValue(v, depth - 1) })
				count++
			}
		}
		return result
	}

	if (type === "set") {
		const set = val as Set<unknown>
		const result: SerializedValue = {
			type,
			preview: `Set(${set.size})`,
			length: set.size,
			className: "Set",
		}
		if (depth > 0) {
			let count = 0
			result.properties = []
			for (const v of set) {
				if (count >= MAX_PROPERTIES) {
					result.truncated = true
					break
				}
				result.properties.push({ key: String(count), value: serializeValue(v, depth - 1) })
				count++
			}
		}
		return result
	}

	if (type === "array") {
		const arr = val as unknown[]
		const result: SerializedValue = {
			type,
			preview: `Array(${arr.length})`,
			length: arr.length,
			className: "Array",
		}
		if (depth > 0) {
			const limit = Math.min(arr.length, MAX_PROPERTIES)
			result.properties = []
			for (let i = 0; i < limit; i++) {
				result.properties.push({ key: String(i), value: serializeValue(arr[i], depth - 1) })
			}
			if (arr.length > MAX_PROPERTIES) result.truncated = true
		}
		return result
	}

	// Plain object
	const obj = val as Record<string, unknown>
	const className = obj.constructor?.name !== "Object" ? obj.constructor?.name : undefined
	const keys = Object.keys(obj)
	const result: SerializedValue = {
		type,
		preview: className ? `${className} {…}` : `{…}`,
		className,
	}
	if (depth > 0) {
		const limit = Math.min(keys.length, MAX_PROPERTIES)
		result.properties = []
		for (let i = 0; i < limit; i++) {
			try {
				result.properties.push({
					key: keys[i],
					value: serializeValue(obj[keys[i]], depth - 1),
				})
			} catch {
				result.properties.push({
					key: keys[i],
					value: { type: "string", preview: "[error reading property]" },
				})
			}
		}
		if (keys.length > MAX_PROPERTIES) result.truncated = true
	}
	// Update preview with short property list
	if (result.properties && result.properties.length <= 5) {
		const pairs = result.properties.map((p) => `${p.key}: ${p.value.preview}`)
		result.preview = className ? `${className} {${pairs.join(", ")}}` : `{${pairs.join(", ")}}`
	}
	return result
}

// ─── Completions for autocomplete ────────────────────────────────────────────

function getCompletions(expression: string): string[] {
	try {
		const trimmed = expression.trim()
		if (!trimmed) {
			// Return top-level globals
			return getObjectKeys(window)
				.filter((k) => !k.startsWith("_"))
				.slice(0, 100)
		}

		// Find the object path: e.g. "document.getE" → prefix="document", partial="getE"
		const lastDot = trimmed.lastIndexOf(".")
		if (lastDot === -1) {
			// Partial global name
			return getObjectKeys(window)
				.filter((k) => k.toLowerCase().startsWith(trimmed.toLowerCase()))
				.slice(0, 50)
		}

		const objExpr = trimmed.slice(0, lastDot)
		const partial = trimmed.slice(lastDot + 1).toLowerCase()

		// Evaluate the object expression to get its properties
		// eslint-disable-next-line no-eval
		const obj = (0, eval)(objExpr)
		if (obj == null) return []

		return getObjectKeys(obj)
			.filter((k) => k.toLowerCase().startsWith(partial))
			.slice(0, 50)
	} catch {
		return []
	}
}

function getObjectKeys(obj: unknown): string[] {
	if (obj == null) return []
	const keys = new Set<string>()
	try {
		// Walk prototype chain
		let current = obj
		let depth = 0
		while (current != null && depth < 5) {
			for (const key of Object.getOwnPropertyNames(current)) {
				keys.add(key)
			}
			current = Object.getPrototypeOf(current)
			depth++
		}
	} catch {
		// ignore
	}
	return Array.from(keys).sort()
}

// ─── Phase 2: Activate editor (on demand) ──────────────────────────────────

function activateEditorRuntime(scaleRatio: number): void {
	// Destroy existing runtime to prevent duplicate instances
	if (editorRuntime) {
		EditorLogger.info("Destroying existing editor runtime before re-activation")
		try {
			editorRuntime.destroy()
		} catch (error) {
			EditorLogger.warn("Failed to destroy existing runtime:", error)
		}
		editorRuntime = null
	}

	// Also clean up legacy global references that messenger-content may have set
	if (typeof window !== "undefined") {
		if ((window as unknown as Record<string, unknown>).__elementSelectorV2__) {
			try {
				; (
					(window as unknown as Record<string, unknown>).__elementSelectorV2__ as {
						destroy?: () => void
					}
				).destroy?.()
			} catch (_) {
				// ignore
			}
			delete (window as unknown as Record<string, unknown>).__elementSelectorV2__
		}
		delete (window as unknown as Record<string, unknown>).__editingAPIV2__
		delete (window as unknown as Record<string, unknown>).__EDITING_FEATURES_V2_INJECTED__
	}

	// Store scale ratio for EditorRuntime
	if (typeof window !== "undefined") {
		window.__MAGIC_SCALE_RATIO__ = scaleRatio
	}

	EditorLogger.info("Activating iframe editor runtime, scaleRatio =", scaleRatio)
	editorRuntime = new EditorRuntime()

	if (typeof window !== "undefined") {
		window.__iframeEditorRuntime__ = editorRuntime
		window.__EDITING_FEATURES_V2_INJECTED__ = true
	}
}

// ─── Message listener for Phase 2 ──────────────────────────────────────────

window.addEventListener("message", (event: MessageEvent) => {
	if (!event.data) return

	// Activate editor runtime on demand
	if (event.data.type === "activateEditorRuntime") {
		const scaleRatio = typeof event.data.scaleRatio === "number" ? event.data.scaleRatio : 1
		activateEditorRuntime(scaleRatio)
		return
	}

	// Element Inspector start/stop (parent → iframe)
	if (event.data.type === "MAGIC_INSPECTOR_START") {
		elementInspector.activate()
		return
	}
	if (event.data.type === "MAGIC_INSPECTOR_STOP") {
		elementInspector.deactivate()
		return
	}

	// DevTools toggle (parent → iframe)
	if (event.data.type === DEVTOOLS_MSG.TOGGLE) {
		const enabled = Boolean(event.data.enabled)
		if (enabled) {
			devToolsCollector.enable()
			EditorLogger.info("DevTools enabled")
		} else {
			devToolsCollector.disable()
			EditorLogger.info("DevTools disabled")
		}
		return
	}

	// DevTools clear (parent → iframe)
	if (event.data.type === DEVTOOLS_MSG.CLEAR) {
		devToolsCollector.clear()
		return
	}

	// DevTools storage request (parent → iframe)
	if (event.data.type === DEVTOOLS_MSG.STORAGE_REQUEST) {
		devToolsCollector.sendStorageSnapshot()
		return
	}

	// DevTools eval (parent → iframe)
	if (event.data.type === DEVTOOLS_MSG.EVAL) {
		const { code, evalId } = event.data as { code?: string; evalId?: string }
		if (typeof code !== "string" || !evalId) return
		let result: string
		let isError = false
		let structured: ReturnType<typeof serializeValue> | undefined
		try {
			// eslint-disable-next-line no-eval
			const value = (0, eval)(code)
			structured = serializeValue(value, 3)
			result =
				typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "undefined")
		} catch (err) {
			isError = true
			result = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
			structured = serializeValue(err, 2)
		}
		try {
			window.parent.postMessage(
				{
					type: DEVTOOLS_MSG.EVAL_RESULT,
					evalId,
					result,
					isError,
					structured,
					timestamp: Date.now(),
				},
				"*",
			)
		} catch {
			// ignore
		}
		return
	}

	// DevTools completions (parent → iframe)
	if (event.data.type === DEVTOOLS_MSG.EVAL_COMPLETIONS) {
		const { expression, requestId } = event.data as {
			expression?: string
			requestId?: string
		}
		if (!requestId) return
		const completions = getCompletions(expression ?? "")
		try {
			window.parent.postMessage(
				{
					type: DEVTOOLS_MSG.EVAL_COMPLETIONS_RESULT,
					requestId,
					completions,
					timestamp: Date.now(),
				},
				"*",
			)
		} catch {
			// ignore
		}
		return
	}
})

// ─── Bootstrap ─────────────────────────────────────────────────────────────
// APIs do not require DOM readiness — run immediately so that window.Magic.*
// is available to inline scripts, matching the previous getMagicMethodsScript behavior.
installMagicAPIs()

// Notify parent that iframe-runtime is ready. This allows the parent to
// re-enable DevTools after an iframe content refresh.
try {
	window.parent.postMessage({ type: "MAGIC_DEVTOOLS_RUNTIME_READY", timestamp: Date.now() }, "*")
} catch {
	// ignore if parent is not available
}

// ─── Type declarations ──────────────────────────────────────────────────────

declare global {
	/** Tiptap JSON 文档结构（用于 createTopicAndSend / sendMessage 的 message 参数） */
	interface TiptapJSONContent {
		type: string
		attrs?: Record<string, unknown>
		content?: TiptapJSONContent[]
		text?: string
		[key: string]: unknown
	}

	interface Window {
		__iframeEditorRuntime__?: EditorRuntime
		__MAGIC_SCALE_RATIO__?: number
		__EDITING_FEATURES_V2_INJECTED__?: boolean
		/** 由 full-content.ts 注入的初始语言代码，供 MagicI18nApi 读取 */
		__MAGIC_INITIAL_LANG__?: string
		Magic: {
			// ─── 新命名空间 ──────────────────────────────────────────────
			agent?: {
				getAgents?: () => Promise<
					Array<{
						id: string
						name: string
						icon: string
						color: string
						type: "official" | "custom" | "public"
					}>
				>
			}
			project?: {
				uploadFiles?: (files: unknown[]) => Promise<unknown>
				downloadFiles?: (filePaths: string[]) => Promise<unknown>
				addFilesToMessage?: (files: unknown[], agentMode?: string) => Promise<unknown>
				createTopicAndSend?: (
					message: string | TiptapJSONContent,
					options?: { agentId?: string; model?: string },
				) => Promise<{ topicId: string }>
				sendMessage?: (
					message: string | TiptapJSONContent,
					options?: { model?: string },
				) => Promise<void>
			}
			// ─── 顶层 API ────────────────────────────────────────────────
			/** 返回应用在 workspace 中的根目录路径（例如 "个人财务记账/"） */
			getAppBasePath?: () => Promise<string>
			// ─── 向后兼容（deprecated）────────────────────────────────────
			reload?: () => void
			setInputMessage?: (message: string) => void
			/** @deprecated 使用 window.Magic.project.uploadFiles */
			uploadFiles?: (files: unknown[]) => Promise<unknown>
			/** @deprecated 使用 window.Magic.project.downloadFiles */
			downloadFiles?: (filePaths: string[]) => Promise<unknown>
			/** @deprecated 使用 window.Magic.project.addFilesToMessage */
			addFilesToMessage?: (files: unknown[], agentMode?: string) => Promise<unknown>
			/** @deprecated 使用 window.Magic.agent.getAgents */
			getAgents?: () => Promise<
				Array<{
					id: string
					name: string
					icon: string
					color: string
					type: "official" | "custom" | "public"
				}>
			>
			/** @deprecated 使用 window.Magic.project.createTopicAndSend */
			createTopicAndSend?: (
				message: string | TiptapJSONContent,
				options?: { agentId?: string; model?: string },
			) => Promise<{ topicId: string }>
			/** @deprecated 使用 window.Magic.project.sendMessage */
			sendMessage?: (
				message: string | TiptapJSONContent,
				options?: { model?: string },
			) => Promise<void>
			i18n?: {
				lang: string
				subscribe: (callback: (result: { lang: string }) => void) => () => void
				unsubscribe: (callback: (result: { lang: string }) => void) => void
			}
			fs?: {
				readFile: (path: string) => Promise<string>
				writeFile: (path: string, content: string) => Promise<void>
				listFiles: (dir?: string) => Promise<string[]>
				deleteFile: (path: string) => Promise<void>
				deleteDir: (path: string) => Promise<void>
				moveFile: (path: string, targetDir: string) => Promise<void>
				renameFile: (path: string, newName: string) => Promise<void>
				watchFile: (
					path: string,
					callback: (e: { path: string; timestamp: number }) => void,
				) => () => void
			}
			llm?: {
				getModels: (options?: {
					timeout?: number
				}) => Promise<Array<{ id: string; object?: string; owned_by?: string }>>
				chat: (
					messages: Array<{ role: string; content: string }>,
					options?: Record<string, unknown>,
				) => Promise<string>
				stream: (
					messages: Array<{ role: string; content: string }>,
					onChunk: (delta: string, done: boolean) => void,
					options?: Record<string, unknown>,
				) => () => void
			}
			user?: {
				getInfo: () => Promise<{
					user_id: string
					magic_id: string
					nickname: string
					real_name: string
					name: string
					avatar: string
					organization_code: string
				}>
			}
		}
	}
}

export { EditorRuntime }
