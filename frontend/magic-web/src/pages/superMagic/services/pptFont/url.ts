import { env } from "@/utils/env"

export function getPptFontBaseUrl(): string {
	const cdnHost = env("MAGIC_CDNHOST")?.trim()
	const packagesBaseUrl = trimTrailingSlash(cdnHost || "/packages")
	return `${packagesBaseUrl}/fonts`
}

export function resolvePptFontUrl(path: string, fontBaseUrl: string): string {
	if (isAbsoluteResourcePath(path)) return path
	return `${trimTrailingSlash(fontBaseUrl)}/${path.replace(/^\/+/, "")}`
}

function isAbsoluteResourcePath(path: string): boolean {
	return (
		/^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(path) ||
		path.startsWith("/") ||
		path.startsWith("data:")
	)
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "")
}
