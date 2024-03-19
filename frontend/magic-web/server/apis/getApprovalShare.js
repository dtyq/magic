const { teamshareUrl } = require("../config")

module.exports = async (approvalId, baseUrl = teamshareUrl, query = {}) => {
	const queryString = new URLSearchParams(query).toString()
	// /api/open-api/approval/instances/826106377211142144
	const apiUrl = `${baseUrl}/api/open-api/approval/instances/${approvalId}?${queryString}`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		}
	})
	return await response.json()
}
