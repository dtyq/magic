import { normalLimits } from "./limits"
const encoder = new TextEncoder()
export const byteLength = (value: string) => encoder.encode(value).byteLength
const secretKey =
	/password|passwd|token|secret|authorization|cookie|signature|credential|private.?key/i
const personalKey = /^(email|phone|mobile|address|credit.?card)$/i

function redact(text: string): string {
	return text
		.replace(/(Bearer\s+)[\w.\-~+/=]+/gi, "$1[REDACTED]")
		.replace(
			/((?:password|token|secret|authorization|cookie|signature|api[_-]?key)[\w-]*["']?\s*[:=]\s*["']?)[^\s&"',;}]+/gi,
			"$1[REDACTED]",
		)
		.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]")
}

export interface SnapshotOptions {
	bytes?: number
	stringBytes?: number
	depth?: number
	width?: number
}

/** Only Error diagnostics may invoke guarded getters; ordinary objects never do. */
export function safeSnapshot(input: unknown, options: SnapshotOptions = {}): unknown {
	const {
		bytes = normalLimits.payloadBytes,
		stringBytes = normalLimits.stringBytes,
		depth = normalLimits.depth,
		width = normalLimits.width,
	} = options
	let remaining = bytes
	let truncated = false
	const ancestors = new WeakSet<object>()
	function limited(): string {
		truncated = true
		return "[Truncated]"
	}
	function string(value: string): string {
		// Inspect a bounded prefix before redaction in ordinary logs. The suffix cannot reach a sink.
		const limit = Math.max(0, Math.min(stringBytes, remaining - 16))
		let result = ""
		let size = 0
		for (const char of value) {
			const cost = byteLength(JSON.stringify(char)) - 2
			if (size + cost > limit) {
				limited()
				break
			}
			result += char
			size += cost
		}
		const safe = redact(result)
		remaining -= byteLength(JSON.stringify(safe)) + 4
		return safe
	}
	function visit(value: unknown, level: number): unknown {
		if (remaining < 64 || level > depth) return limited()
		remaining -= 16
		if (typeof value === "string") return string(value)
		if (value === null || typeof value === "boolean") return value
		if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
		if (typeof value === "bigint") return string(`${value}n`)
		if (value === undefined) return undefined
		if (typeof value !== "object") return `[${typeof value}]`
		if (ancestors.has(value)) {
			return "[Circular]"
		}
		ancestors.add(value)
		try {
			if (value instanceof Date) return Date.prototype.toISOString.call(value)
			if (value instanceof Map) return "[Map]"
			if (value instanceof Set) return "[Set]"
			if (value instanceof RegExp) return "[RegExp]"
			if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return "[Binary]"
			const array = Array.isArray(value)
			const error = value instanceof Error
			const result: Record<string, unknown> | unknown[] = array ? [] : Object.create(null)
			let count = 0
			const keys: Iterable<string> = error
				? ["name", "message", "stack", "code", "cause"]
				: (function* () {
						if (array) {
							for (let index = 0; index < value.length; index++) yield String(index)
							return
						}
						for (const key in value) {
							// Older WebViews lack Object.hasOwn; call also supports null prototypes
							// and objects that shadow their own hasOwnProperty method.
							if (Object.prototype.hasOwnProperty.call(value, key)) yield key
						}
					})()
			for (const key of keys) {
				if (count++ >= width || remaining < 128) {
					limited()
					break
				}
				let child: unknown
				if (error && (key === "name" || key === "message" || key === "stack")) {
					// Native stacks can be lazy accessors; names/messages may be inherited.
					// Read only diagnostic strings, then apply the same redaction and budgets.
					try {
						const diagnostic: unknown = value[key]
						child =
							diagnostic === undefined || typeof diagnostic === "string"
								? diagnostic
								: "[Invalid Error field]"
					} catch {
						child = "[Unreadable]"
					}
				} else {
					const descriptor = Object.getOwnPropertyDescriptor(value, key)
					if (!descriptor) {
						if (array) child = null
						else continue
					} else child = "value" in descriptor ? descriptor.value : "[Accessor]"
				}
				const safeKey = string(key)
				const safe =
					secretKey.test(key) || personalKey.test(key) || /^api[_-]?key$/i.test(key)
						? "[REDACTED]"
						: visit(child, level + 1)
				if (array) (result as unknown[]).push(safe)
				else (result as Record<string, unknown>)[safeKey] = safe
			}
			return result
		} finally {
			ancestors.delete(value)
		}
	}
	const value = visit(input, 0)
	return truncated ? { value, truncation: { reason: "record_budget" } } : value
}
