const { baseUrl } = require("../config")

/** 获取超级麦吉文件分享信息 */
module.exports = async (fileId, password) => {
	const apiUrl = `${baseUrl}/api/v1/super-agent/file/${fileId}/file-name`
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
