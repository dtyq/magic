const { baseUrl } = require("../config")

/** 获取超级麦吉项目名称 */
module.exports = async (projectId) => {
	const apiUrl = `${baseUrl}/api/v1/open-api/super-magic/projects/${projectId}`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	})
	return await response.json()
}
