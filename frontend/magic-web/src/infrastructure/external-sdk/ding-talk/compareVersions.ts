/**
 * Compare two version numbers
 * @param version1 The first version number
 * @param version2 The second version number
 * @returns {number}
 * - 1: version1 > version2
 * - -1: version1 < version2
 * - 0: version1 = version2
 */
export function compareVersions(version1: string, version2: string): number {
	try {
		// Clean version strings by removing possible prefixes (e.g., 'v')
		const v1 = (version1 || "").replace(/^v/, "")
		const v2 = (version2 || "").replace(/^v/, "")

		// Split version numbers into arrays
		const v1Parts = v1.split(".").map(Number)
		const v2Parts = v2.split(".").map(Number)

		// Ensure both arrays have the same length
		const maxLength = Math.max(v1Parts.length, v2Parts.length)
		while (v1Parts.length < maxLength) v1Parts.push(0)
		while (v2Parts.length < maxLength) v2Parts.push(0)

		// Compare each part
		for (let i = 0; i < maxLength; i += 1) {
			if (v1Parts[i] > v2Parts[i]) return 1
			if (v1Parts[i] < v2Parts[i]) return -1
		}

		return 0
	} catch (error) {
		console.error(error)
		return 0
	}
}
