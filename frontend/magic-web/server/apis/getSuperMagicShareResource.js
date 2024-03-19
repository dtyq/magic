const { baseUrl } = require("../config")

/** 获取超级麦吉文件分享信息 */
module.exports = async (resourceId) => {
	const apiUrl = `${baseUrl}/api/internal/${resourceId}/share_title`
	const response = await fetch(apiUrl, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	})
	return await response.json()
}
