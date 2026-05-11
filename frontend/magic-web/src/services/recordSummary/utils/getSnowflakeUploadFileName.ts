import { SuperMagicApi } from "@/apis"

export async function getSnowflakeUploadFileName(): Promise<string> {
	const response = await SuperMagicApi.getSnowflakeIds({
		count: 1,
	})
	const snowflakeId = response.ids[0]

	if (!snowflakeId) {
		throw new Error("Failed to get snowflake upload file name")
	}

	return snowflakeId
}
