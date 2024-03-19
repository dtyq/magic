const { teamshareUrl } = require("../config")

module.exports = async (fileId, baseUrl = teamshareUrl) => {
	const apiUrl = `${baseUrl}/api/anonymous/file/card?file_id=${fileId}`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			language: "zh_CN",
			"Content-Type": "application/json",
		}
	})
	return await response.json()
}
