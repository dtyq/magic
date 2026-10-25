import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"

interface ResolveResourceUrlsWithVersionOverridesParams {
	fileIds: string[]
	resourceFileVersions?: Record<string, number | undefined>
	fetchUnversionedUrls: (fileIds: string[]) => Promise<GetTemporaryDownloadUrlItem[]>
	access?: FileAccessContext | null
	fileApi?: Pick<FileApi, "getTemporaryDownloadUrl">
}

interface InlineDashboardDataJsParams {
	html: string
	dataJsContent?: string | null
}

export async function resolveResourceUrlsWithVersionOverrides({
	fileIds,
	resourceFileVersions,
	fetchUnversionedUrls,
	access,
	fileApi,
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

	const versionedUrls = await (fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl)({
		file_ids: versionedFileIds,
		file_versions: fileVersions,
		access: access ?? undefined,
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
