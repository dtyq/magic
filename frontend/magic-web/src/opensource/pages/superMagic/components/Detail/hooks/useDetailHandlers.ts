import pubsub from "@/opensource/utils/pubsub"
import { DetailType } from "../types"
import { useMemoizedFn } from "ahooks"

interface UseDetailHandlersProps {
	setUserSelectDetail?: (detail: any) => void
	isMobile?: boolean
	filesViewerRef?: React.RefObject<any>
}

interface UseDetailHandlersReturn {
	handleBackToLatest: () => void
	openNewTab: (file: any, autoEdit?: boolean) => void
}

function useDetailHandlers({
	setUserSelectDetail,
	isMobile = false,
	filesViewerRef,
}: UseDetailHandlersProps): UseDetailHandlersReturn {
	// 处理回到最新进展
	const handleBackToLatest = useMemoizedFn(() => {
		setUserSelectDetail?.(null)
	})

	const openNewTab = useMemoizedFn((file: any, autoEdit?: boolean) => {
		if (!isMobile) {
			filesViewerRef?.current?.openFileTab(file, autoEdit)
			pubsub.publish("super_magic_switch_detail_mode", "files")
		} else {
			setUserSelectDetail?.({
				type: DetailType.Html,
				data: {
					file_id: file.file_id,
					file_name: file.file_name,
					file_extension: file.file_extension,
					file_url: file.file_url,
				},
			})
		}
	})

	return {
		handleBackToLatest,
		openNewTab,
	}
}

export default useDetailHandlers
export type { UseDetailHandlersProps, UseDetailHandlersReturn }
