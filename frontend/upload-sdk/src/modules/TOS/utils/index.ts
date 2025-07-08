import type { ISigCredentials, ISigOptions, SignersV4 } from "./signatureV4"

export const VOLCENGINE_MIN_PART_SIZE = 5 * 1024 * 1024

const ignoreHeaders = ["host"]

export function formatHeaders(optionHeaders: Record<string, string>) {
	const reqHeaders = { ...optionHeaders }
	Object.keys(reqHeaders).forEach((key) => {
		if (ignoreHeaders.includes(key)) {
			delete reqHeaders[key]
		}
	})
	return reqHeaders
}

export function removeProtocol(host: string) {
	const idx = host.indexOf("://")
	if (idx !== -1) {
		return host.substring(idx + 3)
	}
	return host
}

export function getAuthHeaders(
	signOpt: ISigOptions,
	signers: SignersV4,
	expiredAt: number,
	credentials?: ISigCredentials,
) {
	const signatureHeaders = signers.signatureHeader(signOpt, expiredAt, credentials)
	const optionHeaders: Record<string, string> = {}

	signatureHeaders.forEach((value, mapKey) => {
		optionHeaders[mapKey] = value
	})

	return formatHeaders(optionHeaders)
}
