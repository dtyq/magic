import { useEffect, useRef, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { getFileManagerRequest } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/fileManagerTabs"

/** 用户文件与管理器进入现有 Detail Tab；切换左侧视图不创建预览弹窗。 */
export function useUserSpacePreview({
	detailRef,
	isFilesViewActive,
	showFilesView,
}: {
	detailRef: RefObject<DetailRef | null>
	isFilesViewActive: boolean
	showFilesView: () => void
}) {
	const pending = useRef<AttachmentItem | null>(null)
	const openPending = useMemoizedFn(() => {
		if (!pending.current || !detailRef.current) return false
		detailRef.current.openFileTab(pending.current)
		pending.current = null
		return true
	})
	const handleUserFileClick = useMemoizedFn((file: AttachmentItem) => {
		if (!getFileManagerRequest(file) && (!file.file_id || file.is_directory)) return
		pending.current = file
		if (isFilesViewActive && openPending()) return
		showFilesView()
	})
	useEffect(() => {
		if (isFilesViewActive) openPending()
	}, [isFilesViewActive, openPending])
	return { handleUserFileClick }
}
