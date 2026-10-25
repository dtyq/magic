import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import FileInfoPanel from "../components/FileInfoPanel"
import type { AttachmentItem } from "./types"

export function useFileInfoPanel() {
	const [infoItem, setInfoItem] = useState<AttachmentItem | null>(null)

	const handleShowInfo = useMemoizedFn((item: AttachmentItem) => {
		setInfoItem(item)
	})

	const handleCloseInfoPanel = useMemoizedFn(() => {
		setInfoItem(null)
	})

	return {
		handleShowInfo,
		handleCloseInfoPanel,
		fileInfoPanel: (
			<FileInfoPanel
				open={Boolean(infoItem)}
				item={infoItem}
				onClose={handleCloseInfoPanel}
			/>
		),
	}
}
