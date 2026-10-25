import { useMemoizedFn } from "ahooks"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"

/**
 * Downloads a research project file. The signed URL is requested at click time and never kept,
 * because temporary download links expire. With a `fileName` the content is fetched and saved
 * under that name, since the browser ignores the download name on a cross-origin signed link.
 */
export function useResearchFileDownload() {
	const fileApi = useFileApi()
	return useMemoizedFn((fileId: string | undefined, fileName?: string) => {
		if (!fileId) return
		void fileApi
			.getTemporaryDownloadUrl({ file_ids: [fileId], is_download: true })
			.then(async (res: Array<{ url?: string }>) => {
				const url = res[0]?.url
				if (!url) return
				if (!fileName) {
					void downloadFileWithAnchor(url)
					return
				}
				const data = await downloadFileContent(url, { responseType: "blob" })
				const blobUrl = window.URL.createObjectURL(data as Blob)
				void downloadFileWithAnchor(blobUrl, fileName)
				window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
			})
			.catch((error: unknown) => console.error("Failed to download research file:", error))
	})
}
