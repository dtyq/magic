/**
 * Resolve the trusted parent origin for postMessage communication.
 *
 * Uses `location.ancestorOrigins` (Chrome/Safari) or falls back to
 * parsing `document.referrer`. If the parent origin cannot be determined,
 * falls back to this window's origin so cross-origin messages fail closed.
 */

let cachedOrigin: string | null = null
// Capture the browser-provided parent before MessageProxy can replace
// window.parent with a recording Proxy.
const trustedParentWindow = typeof window !== "undefined" ? window.parent : null

export function getParentOrigin(): string {
	if (cachedOrigin !== null) return cachedOrigin

	// Chrome / Safari expose ancestor origins directly
	if (location.ancestorOrigins && location.ancestorOrigins.length > 0) {
		cachedOrigin = location.ancestorOrigins[0]
		return cachedOrigin
	}

	// Firefox fallback: parse document.referrer
	if (document.referrer) {
		try {
			cachedOrigin = new URL(document.referrer).origin
			return cachedOrigin
		} catch {
			// malformed referrer — fall through
		}
	}

	// Same-origin scenario, including test environments without referrer data.
	// For an unknown cross-origin parent this value intentionally does not match
	// the real parent origin, so inbound and outbound messaging fail closed.
	try {
		if (window.parent === window || window.parent.location.origin === window.location.origin) {
			cachedOrigin = window.location.origin
			return cachedOrigin
		}
	} catch {
		// Cross-origin parent access is expected to fail here.
	}

	cachedOrigin = window.location.origin
	return cachedOrigin
}

/** Send to the parent using the resolved origin, optionally transferring buffers. */
export function postMessageToParent(message: unknown, transfer?: Transferable[]): boolean {
	const origin = getParentOrigin()
	if (transfer && transfer.length > 0) {
		window.parent.postMessage(message, origin, transfer)
	} else {
		window.parent.postMessage(message, origin)
	}
	return true
}

/**
 * Validate whether a MessageEvent comes from the trusted parent origin.
 * The source and exact origin must both match. Unknown origins are rejected by
 * resolving the local window origin as a fail-closed fallback.
 */
export function isFromTrustedParent(event: MessageEvent): boolean {
	if (trustedParentWindow && event.source !== trustedParentWindow) return false

	const trusted = getParentOrigin()
	return event.origin === trusted
}
