import { useState } from "react"
import { downloadFileWithAnchor } from "../../utils/handleFIle"
import { SuperMagicApi } from "@/opensource/apis"

export const useDownloadAll = ({ projectId }: { projectId?: string }) => {
	const [allLoading, setAllLoading] = useState(false)

	// Download all files in the topic
	const handleDownloadAll = async () => {
		if (!projectId) return
		setAllLoading(true)
		try {
			// Call backend to create batch download task for all files
			const data = await SuperMagicApi.createBatchDownload({
				file_ids: [],
				project_id: projectId,
			})
			if (data.status === "ready" && data.download_url) {
				downloadFileWithAnchor(data.download_url)
				setAllLoading(false)
				return
			}
			if (data.status === "processing") {
				// Polling for batch status every 2 seconds
				const timer = setInterval(async () => {
					const checkData = await SuperMagicApi.checkBatchDownloadStatus(data.batch_key)
					if (checkData.status === "ready" && checkData.download_url) {
						downloadFileWithAnchor(checkData.download_url)
						setAllLoading(false)
						clearInterval(timer)
					}
				}, 2000)
			}
		} catch (error) {
			setAllLoading(false)
			console.error("Download all files failed:", error)
		}
	}

	return {
		handleDownloadAll,
		allLoading,
	}
}
