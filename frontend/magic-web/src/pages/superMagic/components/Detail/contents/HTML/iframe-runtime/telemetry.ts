type TelemetryWindow = Window & {
	__MAGIC_SANDBOX_TELEMETRY_INSTALLED__?: boolean
	__MAGIC_FILE_ID__?: string
	__MAGIC_RELATIVE_PATH__?: string
	__MAGIC_IFRAME_CHAIN__?: unknown[]
}

type TelemetryEvent =
	| {
			type: "runtime_error"
			errorType: "error" | "unhandledrejection"
			message: string
			stack: string
			source?: string
			lineno?: number
			colno?: number
	  }
	| {
			type: "resource_load_failed"
			tagName: string
			url: string
			resourceType: string
	  }

interface ResourceTarget extends EventTarget {
	tagName?: string
	currentSrc?: string
	src?: string
	href?: string
	data?: string
	poster?: string
}

function errorProperty(error: unknown, property: "message" | "stack"): unknown {
	return error && typeof error === "object" && property in error
		? (error as Record<string, unknown>)[property]
		: undefined
}

function sanitizeTelemetryText(value: unknown, maxLength: number): string {
	let text = value == null ? "" : String(value)
	if (text.length > maxLength) text = text.slice(0, maxLength) + "...[truncated]"
	if (!text) return ""
	try {
		const url = new URL(text, "http://sandbox.invalid")
		for (const key of ["token", "access_token", "signature", "x-oss-signature", "Expires"]) {
			if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]")
		}
		const serialized = url.toString()
		return text.indexOf("http") === 0
			? serialized
			: serialized.replace("http://sandbox.invalid", "")
	} catch {
		return text.replace(
			/([?&](?:token|access_token|signature|x-oss-signature|Expires)=)[^&#\s]+/gi,
			"$1[redacted]",
		)
	}
}

function createDedupeKey(event: TelemetryEvent): string {
	if (event.type === "runtime_error") {
		return [
			event.type,
			event.errorType || "",
			event.message || "",
			event.source || "",
			event.lineno || "",
			event.colno || "",
		].join("|")
	}
	return [event.type, event.resourceType || "", event.url || ""].join("|")
}

/** Install only inside a sandbox frame; repeated content bootstraps share one listener set. */
export default function install({ fileId }: { fileId?: string }): void {
	const sandbox = window as TelemetryWindow
	if (window.top === window || sandbox.__MAGIC_SANDBOX_TELEMETRY_INSTALLED__) return
	sandbox.__MAGIC_SANDBOX_TELEMETRY_INSTALLED__ = true
	if (fileId && !sandbox.__MAGIC_FILE_ID__) sandbox.__MAGIC_FILE_ID__ = fileId

	let sequence = 0
	const dedupeCounts: Record<string, number> = {}
	function send(event: TelemetryEvent): void {
		const dedupeKey = createDedupeKey(event)
		const dedupeCount = (dedupeCounts[dedupeKey] || 0) + 1
		dedupeCounts[dedupeKey] = dedupeCount
		if (dedupeCount > 5) return
		sequence += 1
		const chainFileIds = Array.isArray(sandbox.__MAGIC_IFRAME_CHAIN__)
			? sandbox.__MAGIC_IFRAME_CHAIN__.slice()
			: []
		const message = {
			type: "MAGIC_HTML_SANDBOX_TELEMETRY",
			payload: {
				eventId: "sandbox_tel_" + Date.now() + "_" + sequence,
				severity: "error",
				event,
				source: {
					depth: chainFileIds.length,
					fileId: sandbox.__MAGIC_FILE_ID__ || "",
					path: sandbox.__MAGIC_RELATIVE_PATH__ || "",
					chainFileIds,
				},
				page: {
					href: sanitizeTelemetryText(window.location?.href || "", 1000),
					referrer: sanitizeTelemetryText(document.referrer || "", 1000),
					readyState: document.readyState || "loading",
				},
				timestamp: Date.now(),
				dedupeKey,
				dedupeCount,
			},
		}
		const targets: Window[] = []
		if (window.parent && window.parent !== window) targets.push(window.parent)
		if (window.top && window.top !== window) targets.push(window.top)
		if (window.top?.parent && window.top.parent !== window.top) targets.push(window.top.parent)
		const seen: Window[] = []
		for (const target of targets) {
			if (seen.includes(target)) continue
			seen.push(target)
			try {
				target.postMessage(message, "*")
			} catch (error) {
				console.error("Failed to post nested sandbox telemetry:", error)
			}
		}
	}

	window.addEventListener(
		"error",
		(event: ErrorEvent) => {
			const target = event.target
			if (target && target !== window) {
				const resource = target as ResourceTarget
				const tagName = resource.tagName ? String(resource.tagName).toLowerCase() : ""
				const url =
					resource.currentSrc ||
					resource.src ||
					resource.href ||
					resource.data ||
					resource.poster ||
					""
				if (!tagName || !url) return
				let resourceType = "unknown"
				if (tagName === "script") resourceType = "script"
				else if (tagName === "link") resourceType = "stylesheet"
				else if (tagName === "img") resourceType = "image"
				else if (tagName === "iframe") resourceType = "iframe"
				else if (["video", "audio", "source"].includes(tagName)) resourceType = "media"
				send({
					type: "resource_load_failed",
					tagName,
					url: sanitizeTelemetryText(url, 1000),
					resourceType,
				})
				return
			}
			send({
				type: "runtime_error",
				errorType: "error",
				message: sanitizeTelemetryText(event.message || "Unknown runtime error", 500),
				stack: sanitizeTelemetryText(errorProperty(event.error, "stack") || "", 2000),
				source: sanitizeTelemetryText(event.filename || "", 1000),
				lineno: event.lineno,
				colno: event.colno,
			})
		},
		true,
	)
	window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
		const reason: unknown = event.reason
		const message =
			typeof reason === "string"
				? reason
				: errorProperty(reason, "message") || "Unknown promise rejection"
		send({
			type: "runtime_error",
			errorType: "unhandledrejection",
			message: sanitizeTelemetryText(message, 500),
			stack: sanitizeTelemetryText(errorProperty(reason, "stack") || "", 2000),
		})
	})
}
