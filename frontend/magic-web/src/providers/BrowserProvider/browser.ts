/**
 * Browser detection utilities
 */

interface BrowserInfo {
	name: string
	version: number
	isOutdated: boolean
}

/**
 * Minimum supported versions for different browsers
 */
export const MIN_SUPPORTED_VERSIONS = {
	Chrome: 111,
	Edge: 111,
	Firefox: 114,
	Safari: 16.4,
	Unknown: 0,
}

/**
 * Checks if the current browser version is outdated
 */
export function isBrowserOutdated(browserName: string, version: number): boolean {
	const minVersion =
		MIN_SUPPORTED_VERSIONS[browserName as keyof typeof MIN_SUPPORTED_VERSIONS] || 0
	return version < minVersion
}

/**
 * Detects the current browser and its version
 */
export function getBrowserInfo(): BrowserInfo {
	const userAgent = navigator.userAgent
	let name = "Unknown"
	let version = 0

	// Edge includes a Chrome token in its user agent, so detect it first.
	if (userAgent.indexOf("Edg") !== -1) {
		const edgeMatch = userAgent.match(/Edg\/(\d+)/)
		if (edgeMatch && edgeMatch[1]) {
			name = "Edge"
			version = parseInt(edgeMatch[1], 10)
		}
	}
	// Chrome detection
	else if (userAgent.indexOf("Chrome") !== -1) {
		const chromeMatch = userAgent.match(/Chrome\/(\d+)/)
		if (chromeMatch?.[1]) {
			name = "Chrome"
			version = parseInt(chromeMatch[1], 10)
		}
	}
	// Firefox detection
	else if (userAgent.indexOf("Firefox") !== -1) {
		const firefoxMatch = userAgent.match(/Firefox\/(\d+)/)
		if (firefoxMatch && firefoxMatch[1]) {
			name = "Firefox"
			version = parseInt(firefoxMatch[1], 10)
		}
	}
	// Safari detection
	else if (userAgent.indexOf("Safari") !== -1 && userAgent.indexOf("Chrome") === -1) {
		const safariMatch = userAgent.match(/Version\/(\d+(\.\d+)?)/)
		if (safariMatch && safariMatch[1]) {
			name = "Safari"
			version = parseFloat(safariMatch[1])
		}
	}

	// Check if browser is outdated
	const isOutdated = isBrowserOutdated(name, version)

	return { name, version, isOutdated }
}
