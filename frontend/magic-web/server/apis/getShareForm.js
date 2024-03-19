const { teamshareUrl } = require("../config")

module.exports = async (fileId, viewId, baseUrl = teamshareUrl) => {
	const apiUrl = `${baseUrl}/api/anonymous/file/card??sheet_id=${fileId}&view_id=${viewId}`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			language: "zh_CN",
			"Content-Type": "application/json",
		},
	})
	return await response.json()
}
