const ENABLE_CANVAS_ELEMENT_CLIPBOARD_LOG = false

type CanvasElementClipboardLogData = Record<string, unknown>

function sanitizeLogData(value: unknown, key?: string): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeLogData(item))
	}

	if (value instanceof Blob) {
		return {
			blobType: value.type,
			blobSize: value.size,
		}
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([entryKey, entryValue]) => [
				entryKey,
				sanitizeLogData(entryValue, entryKey),
			]),
		)
	}

	if (typeof value === "string" && key && ["ossUrl", "url", "src"].includes(key)) {
		try {
			const parsedUrl = new URL(value)
			if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
				return {
					origin: parsedUrl.origin,
					pathname: parsedUrl.pathname,
					hasQuery: parsedUrl.search.length > 0,
					redacted: true,
				}
			}
		} catch {
			return value
		}
	}

	return value
}

/**
 * Local debug channel for CanvasDesign clipboard development and troubleshooting.
 *
 * Keep this logger inside CanvasDesign so clipboard utilities stay portable and
 * do not depend on app-level logging modules.
 */
export function logCanvasElementClipboard(
	event: string,
	data: CanvasElementClipboardLogData = {},
): void {
	if (!ENABLE_CANVAS_ELEMENT_CLIPBOARD_LOG) {
		return
	}

	if (typeof console !== "undefined") {
		// console.log("[CanvasElementClipboard]", event, data)
		console.log("[CanvasElementClipboard]", event, JSON.stringify(sanitizeLogData(data)))
	}
}
