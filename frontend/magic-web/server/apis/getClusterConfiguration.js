const { teamshareUrl, keewoodUrl } = require("../config")

module.exports = async (clusterCode) => {
	if (clusterCode === "global") {
		return {
			teamshareUrl: teamshareUrl,
			keewoodUrl: keewoodUrl,
		}
	}

	const response = await fetch(`${keewoodUrl}/v4/private-deployments/configuration`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			identifier: clusterCode,
		}),
	})
	const data = await response.json()

	return {
		teamshareUrl: data?.data?.config?.services?.teamshareAPI?.url,
		keewoodUrl: data?.data?.config?.services?.keewoodAPI?.url,
	}
}
