import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { useDebounceEffect } from "ahooks"
import { useState } from "react"

export const useFileUrl = ({
	file_id,
	type = "download",
}: {
	file_id: string
	type?: "preview" | "download"
}) => {
	const [fileUrl, setFileUrl] = useState<string>("")

	useDebounceEffect(
		() => {
			if (!file_id) return
			getTemporaryDownloadUrl({
				file_ids: [file_id],
			}).then((res: any) => {
				setFileUrl(res[0]?.url)
			})
		},
		[file_id],
		{
			wait: 16,
		},
	)

	return { fileUrl }
}
