import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"

interface ResolveResourceUrlsWithVersionOverridesParams {
	fileIds: string[]
	resourceFileVersions?: Record<string, number | undefined>
	fetchUnversionedUrls: (fileIds: string[]) => Promise<GetTemporaryDownloadUrlItem[]>
}

interface InlineDashboardDataJsParams {
	html: string
	dataJsContent?: string | null
}

export async function resolveResourceUrlsWithVersionOverrides({
	fileIds,
	resourceFileVersions,
	fetchUnversionedUrls,
}: ResolveResourceUrlsWithVersionOverridesParams): Promise<GetTemporaryDownloadUrlItem[]> {
	const versionedFileIds = fileIds.filter(
		(fileId) => typeof resourceFileVersions?.[fileId] === "number",
	)
	const unversionedFileIds = fileIds.filter(
		(fileId) => typeof resourceFileVersions?.[fileId] !== "number",
	)

	const urlData = await fetchUnversionedUrls(unversionedFileIds)
	if (versionedFileIds.length === 0) return urlData

	const fileVersions = versionedFileIds.reduce<Record<string, number>>((acc, fileId) => {
		const version = resourceFileVersions?.[fileId]
		if (typeof version === "number") {
			acc[fileId] = version
		}
		return acc
	}, {})

	const versionedUrls = await getTemporaryDownloadUrl({
		file_ids: versionedFileIds,
		file_versions: fileVersions,
	})

	return [...urlData, ...(versionedUrls || [])]
}

export function inlineDashboardDataJs({
	html,
	dataJsContent,
}: InlineDashboardDataJsParams): string {
	if (!dataJsContent) return html

	const escapedContent = dataJsContent.replace(/<\/script/gi, "<\\/script")

	return html.replace(
		/<script\b([^>]*?)src=(["'])(\.\/)?data\.js\2([^>]*)>\s*<\/script>/i,
		`<script$1$4>${escapedContent}</script>`,
	)
}
