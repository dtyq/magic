import { env } from "@/utils/env"

export const getPackageAssetUrl = (path: string): string => {
	const cdnHost = env("MAGIC_CDNHOST")?.trim()
	const baseUrl = trimTrailingSlash(cdnHost)
	const assetPath = trimLeadingSlash(path)

	return assetPath ? `${baseUrl}/${assetPath}` : baseUrl
}

function trimLeadingSlash(value: string): string {
	return value.replace(/^\/+/, "")
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "")
}
