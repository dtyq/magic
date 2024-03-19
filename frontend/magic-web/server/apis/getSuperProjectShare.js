const { baseUrl } = require("../config")

/** 获取超级麦吉项目资源分享信息 */
module.exports = async (resourceId, password) => {
	const apiUrl = `${baseUrl}/api/v1/share/resources/${resourceId}/detail`
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			page: 1,
			page_size: 1,
			pwd: password,
		}),
	})
	return await response.json()
}
