/** Legacy DOMException.code for quota errors (WebKit / older browsers). */
const LEGACY_QUOTA_ERROR_CODE = 22
/** Firefox nsresult mapped onto DOMException.code for quota errors. */
const FIREFOX_QUOTA_ERROR_CODE = 1014

/** Identify QuotaExceededError across Chromium, legacy WebKit codes, and Firefox names. */
export function isQuotaExceeded(error: unknown): boolean {
	if (!error || typeof error !== "object") return false
	const name = "name" in error ? String(error.name) : ""
	const code = "code" in error ? Number(error.code) : Number.NaN
	return (
		name === "QuotaExceededError" ||
		name === "NS_ERROR_DOM_QUOTA_REACHED" ||
		code === LEGACY_QUOTA_ERROR_CODE ||
		code === FIREFOX_QUOTA_ERROR_CODE
	)
}
