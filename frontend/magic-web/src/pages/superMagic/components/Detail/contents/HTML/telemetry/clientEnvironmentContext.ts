interface NetworkInformationLike {
	effectiveType?: string
	downlink?: number
	rtt?: number
	saveData?: boolean
}

/**
 * Client facts that separate "slow network / throttled background tab" from a real
 * rendering fault when a preview failure has no stack. No content or identity is read.
 */
export function collectClientEnvironmentContext() {
	const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
	return {
		userAgent: navigator.userAgent,
		online: navigator.onLine,
		visibilityState: document.visibilityState,
		// Not available in Safari/Firefox, hence optional.
		network: connection
			? {
					effectiveType: connection.effectiveType,
					downlinkMbps: connection.downlink,
					rttMs: connection.rtt,
					saveData: connection.saveData,
				}
			: undefined,
	}
}
