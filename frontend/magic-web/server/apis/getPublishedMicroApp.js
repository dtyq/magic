const { baseUrl } = require("../config")

/**
 * Resolve the public metadata needed by the installable micro app shell.
 * This endpoint is intentionally read-only and does not accept share passwords.
 */
module.exports = async function getPublishedMicroApp(appId) {
	const normalizedAppId = String(appId || "").trim()
	if (!normalizedAppId) throw new Error("appId is required")

	const apiUrl = `${baseUrl}/api/v1/share/micro-apps/${encodeURIComponent(normalizedAppId)}`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		signal: AbortSignal.timeout(5_000),
	})

	if (!response.ok) {
		const error = new Error(`Published micro app request failed with ${response.status}`)
		error.statusCode = response.status
		throw error
	}

	const result = await response.json()
	const data = result?.data ?? result
	if (!data?.resource_id) {
		const error = new Error("Published micro app metadata is missing")
		error.statusCode = 404
		throw error
	}

	return data
}
