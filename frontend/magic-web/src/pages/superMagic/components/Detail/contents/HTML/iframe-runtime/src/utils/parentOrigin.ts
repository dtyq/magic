/**
 * Resolve the trusted parent origin for postMessage communication.
 *
 * Uses `location.ancestorOrigins` (Chrome/Safari) or falls back to
 * parsing `document.referrer`. Returns "*" only when neither is available
 * (same-origin iframe scenario where the check is redundant).
 */

let cachedOrigin: string | null = null

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

    // Same-origin scenario (no cross-origin sandbox configured)
    cachedOrigin = "*"
    return cachedOrigin
}

/**
 * Validate whether a MessageEvent comes from the trusted parent origin.
 * In same-origin mode (parentOrigin === "*"), only source check is required.
 */
export function isFromTrustedParent(event: MessageEvent): boolean {
    if (event.source !== window.parent) return false

    const trusted = getParentOrigin()
    // If we couldn't determine the origin (same-origin), trust source check alone
    if (trusted === "*") return true

    return event.origin === trusted
}
